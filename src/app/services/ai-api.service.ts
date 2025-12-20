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
  // === classifier ===
  private readonly CLASSIFIER_URL = 'https://194.169.160.2:8443/predict';

  // === RAG / predict ===
  private readonly RAG_URL =
    'https://platform.stratpro.hse.ru/pu-vleviczkaya-pa-hsetest/hsetest/predict';

  constructor(
    private http: HttpClient,
    private modelTokens: ModelTokensService,
  ) {}

  /** общая функция: строим headers с Bearer */
  private withBearerHeaders(): Observable<HttpHeaders> {
    return this.modelTokens.getAccessToken().pipe(
      map((token) => {
        return new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
      }),
    );
  }

  /**
   * classifier
   */
  classify(text: string): Observable<any | null> {
    const body = { text };

    return this.withBearerHeaders().pipe(
      switchMap((headers) =>
        this.http.post<any>(this.CLASSIFIER_URL, body, { headers }).pipe(
          catchError((err) => {
            // ⚠️ если тут ERR_CERT_AUTHORITY_INVALID — это TLS на IP, фронтом не лечится
            console.error('Ошибка classifier', err);
            return of(null);
          }),
        ),
      ),
      catchError((err) => {
        console.error('Token error for classifier', err);
        return of(null);
      }),
    );
  }

  /**
   * RAG predict
   */
  predict(params: {
    question: string;
    questionFilters: any;
    userProfile: UserProfile;
    chatHistory: any[];
  }): Observable<PredictResult> {
    const { question, questionFilters, userProfile, chatHistory } = params;

    const questionFiltersToSend =
      questionFilters === null || questionFilters === undefined
        ? {}
        : questionFilters.predicted_category;

    const userFilters = userProfile.level;
    const campusFilters = userProfile.campus;

    // chatHistory пока не используешь — оставляю как у тебя было
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
        {
          name: 'chat_history',
          datatype: 'str',
          data: '{}',
          shape: 0,
        },
      ],
      output_fields: [
        { name: 'answer', datatype: 'str' },
        { name: 'sources', datatype: 'str' },
      ],
    };

    return this.withBearerHeaders().pipe(
      switchMap((headers) =>
        this.http.post<RagRawResponse>(this.RAG_URL, payload, { headers }).pipe(
          map((response) => {
            const answerOutput = response.outputs.find((o) => o.name === 'answer');
            const sourcesOutput = response.outputs.find((o) => o.name === 'sources');

            const answer = (answerOutput?.data ?? null) as string | null;
            const sources = (sourcesOutput?.data ?? null) as string | null;

            return { answer, sources };
          }),
          catchError((err) => {
            console.error('Ошибка RAG predict', err);
            return of<PredictResult>({
              answer: 'HTTP error / network error',
              sources: 'error',
            });
          }),
        ),
      ),
      catchError((err) => {
        console.error('Token error for RAG', err);
        return of<PredictResult>({
          answer: 'Вы не авторизованы или токен модели истёк. Перезайдите.',
          sources: 'auth',
        });
      }),
    );
  }

  /**
   * 1) classifier
   * 2) predict
   */
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
