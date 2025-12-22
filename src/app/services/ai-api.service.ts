import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
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

  private buildHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  private isAuthError(err: unknown): boolean {
    const e = err as HttpErrorResponse;
    return !!e && (e.status === 401 || e.status === 403);
  }

  private reload(): never {
    // можно предварительно чистить токены, чтобы после reload не было мусора
    this.modelTokens.clear();
    window.location.reload();
    // TS: never
    throw new Error('reloading');
  }

  /**
   * Выполняет запрос с access token.
   * Если запрос упал 401/403 — обновляет токен через /get_model_tokens и повторяет запрос 1 раз.
   * Если refresh или повтор тоже падают — reload страницы.
   */
  private withTokenRetryOnAuthError<T>(
    makeRequest: (headers: HttpHeaders) => Observable<T>,
  ): Observable<T> {
    return this.modelTokens.getAccessToken().pipe(
      switchMap((token) => {
        const safe = (token ?? '').trim();
        if (!safe) {
          // нет токена — пробуем обновить
          return this.modelTokens.refreshTokens().pipe(
            switchMap((t) => makeRequest(this.buildHeaders(t.access_token))),
            catchError(() => this.reload()),
          );
        }

        return makeRequest(this.buildHeaders(safe)).pipe(
          catchError((err) => {
            if (!this.isAuthError(err)) return throwError(() => err);

            // 401/403 → обновляем токены и повторяем запрос
            return this.modelTokens.refreshTokens().pipe(
              switchMap((t) => makeRequest(this.buildHeaders(t.access_token))),
              catchError(() => this.reload()),
            );
          }),
        );
      }),
      catchError((err) => {
        // если даже получение access token упало — reload
        if (this.isAuthError(err)) return this.reload();
        return throwError(() => err);
      }),
    );
  }

  // ====== CLASSIFIER ======

  classify(question: string): Observable<any | null> {
    // твой нужный echo_request
    const payload = {
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

    return this.withTokenRetryOnAuthError((headers) =>
      this.http.post<any>(this.CLASSIFIER_URL, payload, { headers }),
    ).pipe(
      catchError((err) => {
        console.error('Ошибка classifier', err);
        return of(null);
      }),
    );
  }

  // ====== RAG / MODEL ======

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

    return this.withTokenRetryOnAuthError((headers) =>
      this.http.post<RagRawResponse>(this.RAG_URL, payload, { headers }),
    ).pipe(
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
