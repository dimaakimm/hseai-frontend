import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';

export interface ModelTokensResponse {
  access_token: string;
  expires_at: number; // unix seconds
  expires_in: number; // seconds
  token_type: string; // "Bearer"
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  session_state?: string;
  [key: string]: any;
}

/**
 * Новый формат, который приходит с /api/me:
 * {
 *   user: {...},
 *   session_created_at: ...,
 *   model_tokens: {...}
 * }
 */
export interface MeWithModelTokensResponse {
  user: Record<string, any>;
  session_created_at: number;
  model_tokens?: ModelTokensResponse | null;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class ModelTokensService {
  private readonly API_BASE = 'https://api.hse-ai.ru';
  private readonly TOKENS_URL = `${this.API_BASE}/get_model_tokens`;

  private readonly tokens$ = new BehaviorSubject<ModelTokensResponse | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Установить токены из ответа /api/me (где они лежат в поле model_tokens).
   * Вызывай это сразу после успешного ME_URL.
   */
  setFromMeResponse(me: MeWithModelTokensResponse | null | undefined): void {
    const t = me?.model_tokens ?? null;

    // если бэк внезапно не прислал токены — просто очистим, чтобы не использовать мусор
    if (!t?.access_token) {
      this.tokens$.next(null);
      return;
    }

    this.tokens$.next(t);
  }

  /** Явно дернуть токены отдельной ручкой (обязательно с куками) — fallback */
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
   * Отдаёт access token.
   * - Если токен уже есть и валиден — возвращаем его.
   * - Если токена нет/протух — пробуем обновить через /get_model_tokens (fallback).
   */
  getAccessToken(): Observable<string> {
    const current = this.tokens$.value;

    if (this.hasValidAccessToken(current)) {
      return of(current.access_token);
    }

    return this.fetchTokens().pipe(
      map((t) => t.access_token),
      catchError((err) => throwError(() => err)),
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
