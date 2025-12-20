import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';

export interface ModelTokensResponse {
  access_token: string;
  expires_at: number; // unix seconds (судя по твоему примеру)
  expires_in: number; // seconds
  token_type: string; // "Bearer"
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  session_state?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class ModelTokensService {
  private readonly API_BASE = 'https://api.hse-ai.ru';
  private readonly TOKENS_URL = `${this.API_BASE}/get_model_tokens`;

  private readonly tokens$ = new BehaviorSubject<ModelTokensResponse | null>(null);

  constructor(private http: HttpClient) {}

  /** Явно дернуть токены (обязательно с куками) */
  fetchTokens(): Observable<ModelTokensResponse> {
    return this.http
      .get<ModelTokensResponse>(this.TOKENS_URL, { withCredentials: true })
      .pipe(tap((t) => this.tokens$.next(t)));
  }

  /** Есть ли валидный токен прямо сейчас */
  private hasValidAccessToken(t: ModelTokensResponse | null): t is ModelTokensResponse {
    if (!t?.access_token || !t?.expires_at) return false;

    const nowSec = Math.floor(Date.now() / 1000);
    // небольшой запас, чтобы не ловить 401 на границе
    return nowSec < t.expires_at - 10;
  }

  /**
   * Отдаёт access token. Если нет/протух — обновляет через /get_model_tokens.
   * Это удобно дергать перед каждым запросом к модели/классификатору.
   */
  getAccessToken(): Observable<string> {
    const current = this.tokens$.value;

    if (this.hasValidAccessToken(current)) {
      return of(current.access_token);
    }

    return this.fetchTokens().pipe(
      map((t) => t.access_token),
      catchError((err) => {
        // здесь важно не молча проглатывать, иначе ты не поймешь, почему модель не отвечает
        return throwError(() => err);
      }),
    );
  }

  /** Если нужно где-то читать "сырые" токены */
  tokensState$(): Observable<ModelTokensResponse | null> {
    return this.tokens$.asObservable();
  }

  /** Сбросить токены (например при смене аккаунта) */
  clear(): void {
    this.tokens$.next(null);
  }
}
