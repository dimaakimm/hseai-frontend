import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';

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

  /**
   * Логика как "было":
   * - дергаем /api/me с куками
   * - если ок -> статус authorized
   * - сохраняем model_tokens из /api/me в ModelTokensService (если пришли)
   * - НЕ дергаем отдельно get_model_tokens тут (его дергаем только при 401/403 на модели)
   */
  initAuthCheck(): Observable<AuthState> {
    this.state$.next({ status: 'loading' });

    return this.http.get<MeResponse>(this.ME_URL, { withCredentials: true }).pipe(
      tap((me) => {
        this.state$.next({ status: 'authorized', me });

        // /api/me уже возвращает model_tokens — кладём их в кэш, если есть
        const token = (me as any)?.model_tokens?.access_token;
        if (typeof token === 'string' && token.trim()) {
          // refreshTokens() НЕ нужен — мы просто кладём то, что пришло
          // В ModelTokensService у нас tokens$ приватный, поэтому делаем мягко:
          // вызываем refreshTokens только если ты хочешь строго через /get_model_tokens.
          // Но чтобы не дёргать сеть — лучше добавить метод setTokens в сервис.
        }
      }),
      // если хочешь прямо сейчас сохранить model_tokens без сетевого запроса —
      // добавь метод setTokens() в ModelTokensService (ниже дам)
      map(() => this.state$.value),
      catchError((err) => {
        // у тебя на бэке 401, а не 403 — учитываем оба
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
