import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

import { MeResponse } from '../auth/auth.models';

export interface ModelTokens {
  access_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class ModelTokensService {
  private readonly tokens$ = new BehaviorSubject<ModelTokens | null>(null);

  constructor(private http: HttpClient) {}

  /** Кладём токены из /api/me */
  setFromMe(me: MeResponse): void {
    const t = (me as any)?.model_tokens;
    if (t?.access_token) {
      this.tokens$.next(t);
    }
  }

  /** Достать access token (если уже есть) */
  getAccessToken(): Observable<string> {
    const t = this.tokens$.value;
    if (t?.access_token) return of(t.access_token);
    return throwError(() => new Error('NO_MODEL_TOKEN'));
  }

  clear(): void {
    this.tokens$.next(null);
  }
}
