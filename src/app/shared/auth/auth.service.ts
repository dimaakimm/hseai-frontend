import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { AuthState, MeResponse } from './auth.models';
import { ModelTokensService } from './model-tokens.service';
import { switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_BASE = 'https://api.hse-ai.ru';
  private readonly ME_URL = `${this.API_BASE}/api/me`;

  // ВАЖНО: endpoints для кнопок (если у тебя другие — просто поменяй тут)
  private readonly LOGIN_URL = `${this.API_BASE}/auth/login`;
  private readonly LOGOUT_URL = `${this.API_BASE}/auth/logout`;

  private readonly state$ = new BehaviorSubject<AuthState>({ status: 'loading' });

  constructor(
    private http: HttpClient,
    private modelTokens: ModelTokensService,
  ) {}

  /** Подписка для UI */
  authState$(): Observable<AuthState> {
    return this.state$.asObservable();
  }

  /** Одноразовая инициализация при старте приложения */
  initAuthCheck() {
    this.state$.next({ status: 'loading' });

    return this.http.get<MeResponse>(this.ME_URL, { withCredentials: true }).pipe(
      switchMap((me) => {
        // 1) помечаем как авторизован
        this.state$.next({ status: 'authorized', me });

        // 2) сразу получаем access_token для модели
        return this.modelTokens.fetchTokens().pipe(map(() => this.state$.value));
      }),
      catchError((err) => {
        if (err?.status === 403) {
          this.state$.next({ status: 'unauthorized' });
          this.modelTokens.clear();
          return of(this.state$.value);
        }

        this.state$.next({ status: 'error', message: 'Не удалось проверить авторизацию' });
        this.modelTokens.clear();
        return of(this.state$.value);
      }),
    );
  }
  /** Кнопка "Авторизоваться" */
  login(): void {
    window.location.href = this.LOGIN_URL;
  }

  /** Кнопка "Сменить аккаунт" */
  changeAccount(): void {
    // чаще всего logout редиректит сам; если нет — можно после него reload
    window.location.href = this.LOGOUT_URL;
  }
}
