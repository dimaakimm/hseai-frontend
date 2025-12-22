import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  throwError,
} from 'rxjs';

export interface ModelTokens {
  access_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
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

  // чтобы при нескольких одновременных 401/403 было ОДНО обновление токена
  private refreshInFlight$: Observable<ModelTokens> | null = null;

  constructor(private http: HttpClient) {}

  tokensState$(): Observable<ModelTokens | null> {
    return this.tokens$.asObservable();
  }

  clear(): void {
    this.tokens$.next(null);
  }

  /** Достать access_token, если уже есть */
  getCachedAccessToken(): string | null {
    const t = this.tokens$.value;
    const token = (t?.access_token ?? '').trim();
    return token ? token : null;
  }

  /** Принудительно обновить токены через /get_model_tokens */
  refreshTokens(): Observable<ModelTokens> {
    if (this.refreshInFlight$) return this.refreshInFlight$;

    this.refreshInFlight$ = this.http
      .get<GetModelTokensResponse>(this.TOKENS_URL, { withCredentials: true })
      .pipe(
        map((resp) => {
          const token = (resp?.model_tokens?.access_token ?? '').trim();
          if (!token) {
            throw new Error('model_tokens.access_token is empty');
          }
          // сохраняем весь объект model_tokens (не только строку)
          this.tokens$.next(resp.model_tokens);
          return resp.model_tokens;
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1),
        catchError((err) => throwError(() => err)),
      );

    return this.refreshInFlight$;
  }

  /**
   * Отдать access_token: если есть в кеше — отдаем,
   * иначе пробуем обновить через /get_model_tokens.
   */
  getAccessToken(): Observable<string> {
    const cached = this.getCachedAccessToken();
    if (cached) return of(cached);

    return this.refreshTokens().pipe(map((t) => t.access_token));
  }
}
