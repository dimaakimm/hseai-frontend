import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, switchMap } from 'rxjs';

import { AuthState, MeResponse } from './auth.models';
import { ModelTokensService } from './model-tokens.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_BASE = 'https://api.hse-ai.ru';
  private readonly ME_URL = `${this.API_BASE}/api/me`;

  private readonly LOGIN_URL = `${this.API_BASE}/auth/login`;
  private readonly LOGOUT_URL = `${this.API_BASE}/auth/logout`;

  private readonly state$ = new BehaviorSubject<AuthState>({ status: 'loading' });

  constructor(
    private http: HttpClient,
    private modelTokens: ModelTokensService,
  ) {}

  authState$(): Observable<AuthState> {
    return this.state$.asObservable();
  }

  initAuthCheck(): Observable<AuthState> {
    this.state$.next({ status: 'loading' });

    return this.http.get<MeResponse>(this.ME_URL, { withCredentials: true }).pipe(
      switchMap((me) => {
        this.state$.next({ status: 'authorized', me });

        return this.modelTokens.fetchTokens().pipe(
          map(() => this.state$.value),
          catchError((err) => {
            console.error('Не удалось получить токены модели', err);
            this.state$.next({
              status: 'error',
              message: 'Вы авторизованы, но не удалось получить токен модели.',
            });
            return of(this.state$.value);
          }),
        );
      }),
      catchError((err) => {
        if (err?.status === 403) {
          this.modelTokens.clear();
          this.state$.next({ status: 'unauthorized' });
          return of(this.state$.value);
        }

        console.error('Ошибка проверки авторизации', err);
        this.modelTokens.clear();
        this.state$.next({
          status: 'error',
          message: 'Вы не авторизованы',
        });
        return of(this.state$.value);
      }),
    );
  }

  login(): void {
    window.location.href = this.LOGIN_URL;
  }

  changeAccount(): void {
    this.modelTokens.clear();
    window.location.href = this.LOGOUT_URL;
  }

  getMeSnapshot(): MeResponse | null {
    const s = this.state$.value;
    return s.status === 'authorized' ? s.me : null;
  }
}
