import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { UserProfile } from '../models/user-profile.model';

export interface PredictResult {
  answer: string | null;
  sources: string | null;
}

interface RagOutput {
  name: string;
  datatype: string;
  data: string | null;
  // shape может быть чем угодно — нам не важно
  shape?: number | number[];
}

interface RagRawResponse {
  outputs: RagOutput[];
}

@Injectable({
  providedIn: 'root',
})
export class AiApiService {
  // === classifier ===
  private readonly CLASSIFIER_URL = 'https://api.hse-ai.ru/predict';
  private readonly CLASSIFIER_TOKEN =
    '496d41cce2ec6a77f1bb7e1afc70c50b5636443c686b1da46bdb760f7fb7e3e4';

  // === RAG / predict ===
  private readonly RAG_URL =
    'https://platform.stratpro.hse.ru/pu-vleviczkaya-pa-hsetest/hsetest/predict';
  private readonly RAG_AUTH_HEADER = 'Basic ZGV2ZWxvcGVyOmExNTU2MmViYjNjOTk3NmU=';

  constructor(private http: HttpClient) {}

  /**
   * classifier: отправляем текст и получаем категории.
   * Тип ответа оставляю any, чтобы не наврать — можно посмотреть в консоли и типизировать.
   */
  classify(text: string): Observable<any | null> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.CLASSIFIER_TOKEN}`,
    });

    const body = { text };

    return this.http.post<any>(this.CLASSIFIER_URL, body, { headers }).pipe(
      catchError((err) => {
        console.error('Ошибка classifier', err);
        return of(null);
      }),
    );
  }


  /**
   * Чистый запрос к RAG (predict).
   */
  predict(params: {
    question: string;
    questionFilters: any;
    userProfile: UserProfile;
    chatHistory: any[];
  }): Observable<PredictResult> {
    const { question, questionFilters, userProfile, chatHistory } = params;

    const headers = new HttpHeaders({
      Authorization: this.RAG_AUTH_HEADER,
      'Content-Type': 'application/json',
    });

    const questionFiltersToSend =
      questionFilters === null || questionFilters === undefined
        ? {}
        : questionFilters.predicted_category;

    const userFilters = userProfile.level;
    const campusFilters = userProfile.campus;

    const payload = {
      inputs: [
        {
          name: 'question',
          datatype: 'str',
          data: question,
          shape: 0,
        },
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

    return this.http.post<RagRawResponse>(this.RAG_URL, payload, { headers }).pipe(
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
          answer: `HTTP error / network error`,
          sources: 'error',
        });
      }),
    );
  }

  /**
   * Высокоуровневая функция:
   * 1) вызывает classifier
   * 2) кладёт его результат в question_filters
   * 3) затем вызывает predict
   * Если classifier упал — идём в predict с пустыми question_filters.
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
