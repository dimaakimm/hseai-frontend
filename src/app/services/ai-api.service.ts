import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, defer, throwError, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../shared/auth/auth.service';
import { UserProfile } from '../models/user-profile.model';
import { ModelTokensService } from '../shared/auth/model-tokens.service';

export interface PredictResult {
  answer: string | null;
  sources: string | null;
}

interface RagOutput {
  name: string;
  datatype: string;
  data: string | null;
  shape?: number | number[];
}
interface RagRawResponse {
  outputs: RagOutput[];
}

@Injectable({ providedIn: 'root' })
export class AiApiService {
  private readonly CLASSIFIER_URL =
    'https://platform.stratpro.hse.ru/pu-sp4-pa-newcls/deploy_version/predict';
  private readonly RAG_URL =
    'https://platform.stratpro.hse.ru/pu-sp4-pa-hse-model/deploy_version/predict';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private modelTokens: ModelTokensService,
  ) {}

  private isAuthLikeError(err: any): boolean {
    const s = err?.status;
    return s === 401 || s === 403;
  }

  /** универсальная обёртка: если токен протух — refresh /me, потом retry один раз */
  private withMeRefreshRetry<T>(requestFactory: () => Observable<T>): Observable<T> {
    return defer(() => requestFactory()).pipe(
      catchError((err) => {
        if (!this.isAuthLikeError(err)) {
          return throwError(() => err);
        }

        // 1) пробуем обновить сессию через /me (бэк там обновит model_tokens)
        return this.auth.refreshMe().pipe(
          // 2) если /me ок — повторяем исходный запрос
          switchMap(() => defer(() => requestFactory())),
          catchError((meErr) => {
            // если /me тоже 401/403 — значит реально не авторизован
            if (this.isAuthLikeError(meErr)) {
              this.auth.setUnauthorized();
              return throwError(() => ({ code: 'UNAUTHORIZED' as const }));
            }
            return throwError(() => meErr);
          }),
        );
      }),
    );
  }

  /** classifier в формате echo_request (как ты требовал) + Authorization: Bearer <model_access_token> */
  classify(question: string): Observable<any> {
    return this.withMeRefreshRetry(() =>
      this.modelTokens.getAccessToken().pipe(
        switchMap((token) => {
          const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          });

          const body = {
            inputs: [
              {
                name: 'question',
                data: question,
                datatype: 'str',
                shape: question.length,
              },
            ],
            output_fields: [
              { name: 'question', datatype: 'str' },
              { name: 'predicted_category', datatype: 'str' },
              { name: 'confidence', datatype: 'str' },
              { name: 'is_inappropriate', datatype: 'str' },
              { name: 'top_categories', datatype: 'str' },
            ],
          };

          return this.http.post<any>(this.CLASSIFIER_URL, body, { headers });
        }),
      ),
    );
  }

  askWithClassification(params: {
    question: string;
    userProfile: UserProfile;
    chatHistory: any[];
  }): Observable<PredictResult> {
    const { question, userProfile, chatHistory } = params;

    return this.classify(question).pipe(
      // если classify вернул RagRawResponse(outputs) — преобразуем в {predicted_category, confidence, ...}
      map((res: any) => {
        // если у тебя classify уже отдаёт "плоский" объект — просто верни res
        if (!res?.outputs) return res;

        const get = (name: string) => res.outputs.find((o: any) => o?.name === name)?.data;

        const predicted_category = get('predicted_category');
        const confidenceRaw = get('confidence');

        return {
          predicted_category,
          confidence: confidenceRaw != null ? Number(confidenceRaw) : 0,
          is_inappropriate: get('is_inappropriate') === 'true',
          top_categories: get('top_categories'),
        };
      }),
      catchError((err) => {
        // если classifier упал — идём дальше с пустыми фильтрами
        console.error('Ошибка classifier', err);
        return of({});
      }),
      switchMap((questionFilters) =>
        this.predict({
          question,
          questionFilters,
          userProfile,
          chatHistory,
        }),
      ),
    );
  }

  /** RAG predict: авторизация Bearer тем же model access token */
  predict(params: {
    question: string;
    questionFilters: any;
    userProfile: UserProfile;
    chatHistory: any[];
  }): Observable<PredictResult> {
    const { question, questionFilters, userProfile } = params;

    const questionFiltersToSend =
      questionFilters === null || questionFilters === undefined
        ? {}
        : questionFilters.predicted_category;

    const payload = {
      inputs: [
        { name: 'question', datatype: 'str', data: question, shape: 0 },
        {
          name: 'question_filters',
          datatype: 'str',
          data: JSON.stringify([questionFiltersToSend]),
          shape: 0,
        },
        {
          name: 'user_filters',
          datatype: 'str',
          data: JSON.stringify([userProfile.level]),
          shape: 0,
        },
        {
          name: 'campus_filters',
          datatype: 'str',
          data: JSON.stringify([userProfile.campus]),
          shape: 0,
        },
        { name: 'chat_history', datatype: 'str', data: '{}', shape: 0 },
      ],
      output_fields: [
        { name: 'answer', datatype: 'str' },
        { name: 'sources', datatype: 'str' },
      ],
    };

    return this.withMeRefreshRetry(() =>
      this.modelTokens.getAccessToken().pipe(
        switchMap((token) => {
          const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          });

          return this.http.post<RagRawResponse>(this.RAG_URL, payload, { headers });
        }),
        map((response) => {
          const answerOutput = response.outputs.find((o) => o.name === 'answer');
          const sourcesOutput = response.outputs.find((o) => o.name === 'sources');

          return {
            answer: (answerOutput?.data ?? null) as string | null,
            sources: (sourcesOutput?.data ?? null) as string | null,
          };
        }),
      ),
    );
  }
}
