import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
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
  content_type?: string | null;
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
    private modelTokens: ModelTokensService,
  ) {}

  private buildHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  private pickOutput(response: RagRawResponse, name: string): string | null {
    const out = response?.outputs?.find((o) => o?.name === name);
    return out?.data ?? null;
  }

  /** ✅ classifier "как было": inputs/output_fields */
  classify(question: string): Observable<{
    question?: string;
    predicted_category?: string;
    confidence?: number;
    is_inappropriate?: boolean;
    top_categories?: any;
  } | null> {
    const echo_request = {
      inputs: [
        {
          name: 'question',
          data: question,
          datatype: 'str',
          // shape как было у тебя: len(question). В JS это question.length
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

    return this.modelTokens.getAccessToken().pipe(
      switchMap((token) => {
        const safe = (token ?? '').trim();
        if (!safe) {
          console.error('Classifier: пустой access_token');
          return of(null);
        }

        return this.http
          .post<RagRawResponse>(this.CLASSIFIER_URL, echo_request, {
            headers: this.buildHeaders(safe),
          })
          .pipe(
            map((resp) => {
              const predicted_category = this.pickOutput(resp, 'predicted_category');
              const confidenceStr = this.pickOutput(resp, 'confidence');
              const is_inappropriateStr = this.pickOutput(resp, 'is_inappropriate');
              const top_categoriesStr = this.pickOutput(resp, 'top_categories');

              return {
                question: this.pickOutput(resp, 'question') ?? question,
                predicted_category: predicted_category ?? undefined,
                confidence: confidenceStr != null ? Number(confidenceStr) : 0,
                is_inappropriate: is_inappropriateStr === 'true',
                top_categories:
                  top_categoriesStr != null ? this.safeJsonParse(top_categoriesStr) : undefined,
              };
            }),
            catchError((err) => {
              console.error('Ошибка classifier', err);
              return of(null);
            }),
          );
      }),
      catchError((err) => {
        console.error('Classifier token error', err);
        return of(null);
      }),
    );
  }

  /** ✅ RAG predict (у тебя уже был "как было", оставил) */
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

    return this.modelTokens.getAccessToken().pipe(
      switchMap((token) => {
        const safe = (token ?? '').trim();
        if (!safe) {
          return of<PredictResult>({
            answer: 'Не удалось получить токен модели. Перезайдите.',
            sources: 'auth',
          });
        }

        return this.http
          .post<RagRawResponse>(this.RAG_URL, payload, {
            headers: this.buildHeaders(safe),
          })
          .pipe(
            map((response) => {
              return {
                answer: this.pickOutput(response, 'answer'),
                sources: this.pickOutput(response, 'sources'),
              };
            }),
            catchError((err) => {
              console.error('Ошибка RAG predict', err);
              return of<PredictResult>({
                answer: 'HTTP error / network error',
                sources: 'error',
              });
            }),
          );
      }),
      catchError((err) => {
        console.error('RAG token error', err);
        return of<PredictResult>({
          answer: 'Вы не авторизованы или токен модели истёк. Перезайдите.',
          sources: 'auth',
        });
      }),
    );
  }

  askWithClassification(params: {
    question: string;
    userProfile: UserProfile;
    chatHistory: any[];
  }): Observable<PredictResult> {
    const { question, userProfile, chatHistory } = params;

    return this.classify(question).pipe(
      switchMap((questionFilters) =>
        this.predict({
          question,
          questionFilters,
          userProfile,
          chatHistory,
        }),
      ),
      catchError((err) => {
        console.error('askWithClassification fallback', err);
        return this.predict({
          question,
          questionFilters: {},
          userProfile,
          chatHistory,
        });
      }),
    );
  }

  private safeJsonParse(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
