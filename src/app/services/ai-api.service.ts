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
  private readonly CLASSIFIER_URL = 'https://194.169.160.2:8443/predict';

  private readonly RAG_URL =
    'https://platform.stratpro.hse.ru/pu-vleviczkaya-pa-hsetest/hsetest/predict';

  constructor(
    private http: HttpClient,
    private modelTokens: ModelTokensService,
  ) {}

  private buildHeaders(token: string): HttpHeaders {
    const safe = (token ?? '').trim();
    if (!safe) {
      // это страховка: сюда мы вообще не должны попадать
      throw new Error('Empty token while building Authorization header');
    }

    return new HttpHeaders({
      Authorization: `Bearer ${safe}`,
      'Content-Type': 'application/json',
    });
  }

  classify(text: string): Observable<any | null> {
    const body = { text };

    return this.modelTokens.getAccessToken().pipe(
      switchMap((token) => {
        let headers: HttpHeaders;
        try {
          headers = this.buildHeaders(token);
        } catch (e) {
          console.error('Classifier token build error', e);
          return of(null);
        }

        return this.http.post<any>(this.CLASSIFIER_URL, body, { headers }).pipe(
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

    const userFilters = userProfile.level;
    const campusFilters = userProfile.campus;

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
          data: JSON.stringify([userFilters]),
          shape: 0,
        },
        {
          name: 'campus_filters',
          datatype: 'str',
          data: JSON.stringify([campusFilters]),
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
        let headers: HttpHeaders;
        try {
          headers = this.buildHeaders(token);
        } catch (e) {
          console.error('RAG token build error', e);
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
        console.error('askWithClassification: ошибка, fallback без classifier', err);
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
