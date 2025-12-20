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

  private buildHeaders(token: string): HttpHeaders | null {
    const safe = (token ?? '').trim();
    if (!safe) return null;

    return new HttpHeaders({
      Authorization: `Bearer ${safe}`,
      'Content-Type': 'application/json',
    });
  }

  classify(question: string): Observable<any | null> {
    // echo_request как ты просил
    const echo_request = {
      inputs: [
        {
          name: 'question',
          data: question,
          datatype: 'str',
          shape: question.length, // как ты написал: len(question)
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

        const headers = new HttpHeaders({
          Authorization: `Bearer ${safe}`,
          'Content-Type': 'application/json',
        });

        return this.http.post<any>(this.CLASSIFIER_URL, echo_request, { headers }).pipe(
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
        const headers = this.buildHeaders(token);
        if (!headers) {
          return of<PredictResult>({
            answer: 'Не удалось получить токен модели. Перезайдите.',
            sources: 'auth',
          });
        }

        return this.http.post<RagRawResponse>(this.RAG_URL, payload, { headers }).pipe(
          map((response) => {
            const answerOutput = response.outputs.find((o) => o.name === 'answer');
            const sourcesOutput = response.outputs.find((o) => o.name === 'sources');

            return {
              answer: (answerOutput?.data ?? null) as string | null,
              sources: (sourcesOutput?.data ?? null) as string | null,
            };
          }),
          catchError((err) => {
            console.error('Ошибка RAG predict', err);
            return of<PredictResult>({ answer: 'HTTP error / network error', sources: 'error' });
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
}
