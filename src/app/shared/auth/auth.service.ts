import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { ModelTokensService, MeWithModelTokensResponse } from './model-tokens.service';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'authorized'; me: MeWithModelTokensResponse }
  | { status: 'error'; message: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_BASE = 'https://api.hse-ai.ru';
  private readonly ME_URL = `${this.API_BASE}/api/me`;

  // Под твою ссылку, которую ты уже использовал в html
  private readonly LOGIN_URL = `${this.API_BASE}/auth/login`;

  // Если у тебя другой logout — поменяй тут
  private readonly LOGOUT_URL = `${this.API_BASE}/auth/logout`;

  private readonly state$ = new BehaviorSubject<AuthState>({ status: 'loading' });

  constructor(
    private http: HttpClient,
    private modelTokens: ModelTokensService,
  ) {}

  authState$(): Observable<AuthState> {
    return this.state$.asObservable();
  }

  /**
   * Вызывается при старте приложения (APP_INITIALIZER).
   * 1) /api/me
   * 2) кладём model_tokens в ModelTokensService
   * 3) выставляем authorized/unauthorized
   */
  initAuthCheck(): Observable<AuthState> {
    this.state$.next({ status: 'loading' });

    return this.http.get<MeWithModelTokensResponse>(this.ME_URL, { withCredentials: true }).pipe(
      tap((me) => {
        // ✅ главное: токены сохраняем ДО того, как пользователь начнет дергать модель
        this.modelTokens.setFromMeResponse(me);

        // если модельные токены по какой-то причине не пришли — считаем это ошибкой,
        // потому что иначе будет "Bearer undefined"
        if (!me?.model_tokens?.access_token) {
          this.state$.next({
            status: 'error',
            message: 'Авторизация прошла, но токен модели не получен.',
          });
          return;
        }

        this.state$.next({ status: 'authorized', me });
      }),
      map(() => this.state$.value),
      catchError((err) => {
        if (err?.status === 403) {
          this.modelTokens.clear();
          this.state$.next({ status: 'unauthorized' });
          return of(this.state$.value);
        }

        this.modelTokens.clear();
        this.state$.next({
          status: 'error',
          message: 'Не удалось проверить авторизацию (network/server error).',
        });
        return of(this.state$.value);
      }),
    );
  }

  login(): void {
    window.location.href = this.LOGIN_URL;
  }

  changeAccount(): void {
    // Вариант “как есть”: редирект на logout (обычно дальше он сам редиректит на login)
    this.modelTokens.clear();
    window.location.href = this.LOGOUT_URL;
  }

  /** Утилита: получить me из текущего состояния (если нужно где-то ещё) */
  getMeSnapshot(): MeWithModelTokensResponse | null {
    const s = this.state$.value;
    return s.status === 'authorized' ? s.me : null;
  }
}
