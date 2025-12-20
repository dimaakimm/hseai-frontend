import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';

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

export interface MeWithModelTokensResponse {
  user: Record<string, any>;
  session_created_at: number;
  model_tokens?: ModelTokensResponse | null;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class ModelTokensService {
  private readonly tokens$ = new BehaviorSubject<ModelTokensResponse | null>(null);

  setFromMeResponse(me: MeWithModelTokensResponse | null | undefined): void {
    const t = me?.model_tokens ?? null;

    if (!t || typeof t.access_token !== 'string' || t.access_token.trim().length === 0) {
      console.warn('[ModelTokensService] model_tokens отсутствует или access_token пустой', t);
      this.tokens$.next(null);
      return;
    }

    const expiresAtSec = Math.floor(Number(t.expires_at));
    if (!Number.isFinite(expiresAtSec) || expiresAtSec <= 0) {
      console.warn('[ModelTokensService] expires_at некорректный, сохраняю как есть', t.expires_at);
    }

    const normalized: ModelTokensResponse = {
      ...t,
      expires_at: Number.isFinite(expiresAtSec) ? expiresAtSec : t.expires_at,
      access_token: t.access_token.trim(),
    };

    this.tokens$.next(normalized);

    // 🔍 диагностический лог (убери потом)
    console.log('[ModelTokensService] token set, exp=', normalized.expires_at);
  }

  private isValid(t: ModelTokensResponse | null): t is ModelTokensResponse {
    if (!t?.access_token || !t?.expires_at) return false;

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = Math.floor(Number(t.expires_at));

    return Number.isFinite(expSec) && nowSec < expSec - 10;
  }

  /**
   * Никогда не возвращает undefined:
   * - либо валидный token (string)
   * - либо ошибка
   */
  getAccessToken(): Observable<string> {
    const current = this.tokens$.value;

    if (this.isValid(current)) {
      return of(current.access_token);
    }

    return throwError(
      () =>
        new Error(
          'Model access token is missing or expired. Ensure /api/me was called and returned model_tokens.',
        ),
    );
  }

  clear(): void {
    this.tokens$.next(null);
  }
}
