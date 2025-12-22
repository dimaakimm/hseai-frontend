import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

export interface ModelTokens {
  access_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  session_state?: string;
  [key: string]: any;
}

export interface GetModelTokensResponse {
  user: any;
  session_created_at: number;
  model_tokens: ModelTokens;
}

@Injectable({ providedIn: 'root' })
export class ModelTokensService {
  private readonly API_BASE = 'https://api.hse-ai.ru';
  private readonly TOKENS_URL = `${this.API_BASE}/get_model_tokens`;

  private readonly tokens$ = new BehaviorSubject<ModelTokens | null>(null);

  constructor(private http: HttpClient) {}

  /** ✅ Как ты хотел: явно дернуть /get_model_tokens (с куками) и сохранить model_tokens */
  fetchTokens(): Observable<ModelTokens> {
    return this.http.get<GetModelTokensResponse>(this.TOKENS_URL, { withCredentials: true }).pipe(
      map((res) => res?.model_tokens),
      tap((t) => {
        if (!t?.access_token) {
          throw new Error('NO_ACCESS_TOKEN_IN_RESPONSE');
        }
        this.tokens$.next(t);
      }),
      catchError((err) => throwError(() => err)),
    );
  }

  /** Для AiApiService: получить токен из памяти, либо ошибка */
  getAccessToken(): Observable<string> {
    const t = this.tokens$.value;
    if (t?.access_token) return of(t.access_token);
    return throwError(() => new Error('NO_MODEL_TOKEN'));
  }

  /** Если /api/me тоже содержит model_tokens — можно класть сюда */
  setTokens(tokens: ModelTokens | null): void {
    this.tokens$.next(tokens);
  }

  tokensState$(): Observable<ModelTokens | null> {
    return this.tokens$.asObservable();
  }

  clear(): void {
    this.tokens$.next(null);
  }
}
