import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap } from 'rxjs';

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

    const sidFromUrl = this.getSidFromUrl();

    const params = sidFromUrl ? new HttpParams().set('sid', sidFromUrl) : undefined;

    return this.http
      .get<MeResponse>(this.ME_URL, {
        withCredentials: true,
        params,
      })
      .pipe(
        tap(() => {
          // ✅ Если авторизация прошла через sid в URL — убираем его из адресной строки
          if (sidFromUrl) this.removeSidFromUrl();
        }),
        switchMap((me) => {
          this.state$.next({ status: 'authorized', me });

          // Если у тебя modelTokensService по-другому называется/работает — оставь как у тебя в проекте
          return this.modelTokens.getAccessToken().pipe(
            map(() => this.state$.value),
            catchError((err) => {
              console.error('Не удалось получить токен модели', err);
              this.state$.next({
                status: 'error',
                message: 'Вы авторизованы, но не удалось получить токен модели.',
              });
              return of(this.state$.value);
            }),
          );
        }),
        catchError((err) => {
          // 401/403 — считаем неавторизован
          if (err?.status === 401 || err?.status === 403) {
            this.modelTokens.clear?.();
            this.state$.next({ status: 'unauthorized' });
            return of(this.state$.value);
          }

          console.error('Ошибка проверки авторизации', err);
          this.modelTokens.clear?.();
          this.state$.next({
            status: 'error',
            message: 'Не удалось проверить авторизацию',
          });
          return of(this.state$.value);
        }),
      );
  }

  login(): void {
    window.location.href = this.LOGIN_URL;
  }

  changeAccount(): void {
    this.modelTokens.clear?.();
    window.location.href = this.LOGOUT_URL;
  }

  getMeSnapshot(): MeResponse | null {
    const s = this.state$.value;
    return s.status === 'authorized' ? s.me : null;
  }

  // ---------------- helpers ----------------

  private getSidFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    const sid = sp.get('sid');
    const safe = (sid ?? '').trim();
    return safe ? safe : null;
  }

  private removeSidFromUrl(): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.delete('sid');

    // убираем sid без перезагрузки
    window.history.replaceState({}, document.title, url.toString());
  }
}
