import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';

export interface ModelTokensResponse {
  access_token: string;
  expires_at: number; // unix seconds (может быть float)
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  session_state?: string;
  [key: string]: any;
}

export interface TokensEnvelopeResponse {
  user: Record<string, any>;
  session_created_at: number;
  model_tokens: ModelTokensResponse;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class ModelTokensService {
  private readonly API_BASE = 'https://api.hse-ai.ru';
  private readonly TOKENS_URL = `${this.API_BASE}/get_model_tokens`;

  private readonly tokens$ = new BehaviorSubject<ModelTokensResponse | null>(null);

  constructor(private http: HttpClient) {}

  /** Нормализуем токены (expires_at может быть float) */
  private normalize(t: ModelTokensResponse): ModelTokensResponse {
    return {
      ...t,
      access_token: (t.access_token ?? '').trim(),
      expires_at: Math.floor(Number(t.expires_at)),
    };
  }

  private isValid(t: ModelTokensResponse | null): t is ModelTokensResponse {
    if (!t?.access_token || !t?.expires_at) return false;

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = Math.floor(Number(t.expires_at));

    return Number.isFinite(expSec) && nowSec < expSec - 10;
  }

  /**
   * ✅ Правильный fetchTokens:
   * /get_model_tokens возвращает ОБЁРТКУ, токены внутри model_tokens
   */
  fetchTokens(): Observable<ModelTokensResponse> {
    return this.http.get<TokensEnvelopeResponse>(this.TOKENS_URL, { withCredentials: true }).pipe(
      map((resp) => resp?.model_tokens),
      map((t) => {
        if (!t || typeof t.access_token !== 'string' || t.access_token.trim().length === 0) {
          throw new Error('get_model_tokens: model_tokens.access_token is empty');
        }
        return this.normalize(t);
      }),
      tap((t) => this.tokens$.next(t)),
    );
  }

  /**
   * Установить токены из любого объекта, где есть model_tokens
   * (если ты получаешь их из /api/me или из /get_model_tokens — без разницы)
   */
  setFromEnvelope(resp: Partial<TokensEnvelopeResponse> | null | undefined): void {
    const t = resp?.model_tokens;
    if (!t || typeof t.access_token !== 'string' || t.access_token.trim().length === 0) {
      this.tokens$.next(null);
      return;
    }
    this.tokens$.next(this.normalize(t));
  }

  /**
   * Возвращает access token.
   * Если токена нет/протух — обновляем через /get_model_tokens (и уже корректно парсим!)
   */
  getAccessToken(): Observable<string> {
    const current = this.tokens$.value;

    if (this.isValid(current)) {
      return of(current.access_token);
    }

    return this.fetchTokens().pipe(
      map((t) => t.access_token),
      catchError((err) => throwError(() => err)),
    );
  }

  clear(): void {
    this.tokens$.next(null);
  }
}
