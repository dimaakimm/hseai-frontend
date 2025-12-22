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
        // 1) авторизован — сохранили me
        this.state$.next({ status: 'authorized', me });

        // 2) дальше тянем токены модели (как у тебя было)
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
        // важно: бывает 401 (а не только 403)
        if (err?.status === 401 || err?.status === 403) {
          this.modelTokens.clear();
          this.state$.next({ status: 'unauthorized' });
          return of(this.state$.value);
        }

        console.error('Ошибка проверки авторизации', err);
        this.modelTokens.clear();
        this.state$.next({
          status: 'error',
          message: 'Не удалось проверить авторизацию',
        });
        return of(this.state$.value);
      }),
    );
  }

  /** Обновить /me принудительно (удобно когда токен модели протух) */
  refreshMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(this.ME_URL, { withCredentials: true });
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

  /** если нужно руками перевести в unauthorized */
  setUnauthorized(): void {
    this.modelTokens.clear();
    this.state$.next({ status: 'unauthorized' });
  }
}
