import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, finalize, shareReplay, tap, map } from 'rxjs/operators';

import { AuthState, MeResponse } from './auth.models';
import { environment } from '../../../environments/environment';
import { ModelTokensService } from './model-tokens.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_BASE = environment.apiBaseUrl ?? 'https://api.hse-ai.ru';
  private readonly ME_URL = `${this.API_BASE}/api/me`;

  private readonly state$ = new BehaviorSubject<AuthState>({ status: 'checking' });

  private refreshInFlight$?: Observable<MeResponse>;

  constructor(
    private http: HttpClient,
    private modelTokens: ModelTokensService,
  ) {}

  authState$(): Observable<AuthState> {
    return this.state$.asObservable();
  }

  /** То, что дергается из APP_INITIALIZER */
  initAuthCheck(): Observable<AuthState> {
    return this.refreshMe().pipe(
      map((me) => ({ status: 'authorized', me }) as AuthState),
      catchError(() => {
        // если не авторизован — просто ставим unauthorized, без ошибок наружу
        this.setUnauthorized();
        return of<AuthState>({ status: 'unauthorized' });
      }),
    );
  }

  /** Обновить сессию / токены через /api/me (single-flight) */
  refreshMe(): Observable<MeResponse> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http
        .get<MeResponse>(this.ME_URL, { withCredentials: true })
        .pipe(
          tap((me) => {
            this.state$.next({ status: 'authorized', me });
            this.modelTokens.setFromMe(me); // берет me.model_tokens.access_token
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
          finalize(() => {
            this.refreshInFlight$ = undefined;
          }),
        );
    }
    return this.refreshInFlight$;
  }

  setUnauthorized(): void {
    this.modelTokens.clear();
    this.state$.next({ status: 'unauthorized' });
  }

  login(): void {
    window.location.href = `${this.API_BASE}/auth/login`;
  }

  changeAccount(): void {
    window.location.href = `${this.API_BASE}/auth/login?force=true`;
  }
}
