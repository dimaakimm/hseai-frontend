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

  /**
   * Устанавливаем токены из ответа /api/me
   */
  setFromMeResponse(me: MeWithModelTokensResponse | null | undefined): void {
    const t = me?.model_tokens ?? null;

    if (!t?.access_token) {
      this.tokens$.next(null);
      return;
    }

    // expires_at иногда float — нормализуем
    const normalized: ModelTokensResponse = {
      ...t,
      expires_at: Math.floor(Number(t.expires_at)),
    };

    this.tokens$.next(normalized);
  }

  private isValid(t: ModelTokensResponse | null): t is ModelTokensResponse {
    if (!t?.access_token || !t?.expires_at) return false;

    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec < Math.floor(t.expires_at) - 10;
  }

  /**
   * Возвращает access_token или кидает ошибку.
   * НИКАКИХ сетевых запросов внутри — чтобы не было дублей и undefined.
   */
  getAccessToken(): Observable<string> {
    const current = this.tokens$.value;

    if (this.isValid(current)) {
      return of(current.access_token);
    }

    return throwError(
      () => new Error('Model access token is missing or expired. Call /api/me first.'),
    );
  }

  tokensState$(): Observable<ModelTokensResponse | null> {
    return this.tokens$.asObservable();
  }

  clear(): void {
    this.tokens$.next(null);
  }
}
