import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';

import { AuthState, MeResponse } from './auth.models';
import { ModelTokensService } from './model-tokens.service';

const SID_STORAGE_KEY = 'hse_sid';

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

  /** Главная инициализация авторизации (для APP_INITIALIZER) */
  initAuthCheck(): Observable<AuthState> {
    this.state$.next({ status: 'loading' });

    const sid = this.ensureSid();
    if (!sid) {
      this.modelTokens.clear?.();
      this.state$.next({ status: 'unauthorized' });
      return of(this.state$.value);
    }

    const params = new HttpParams().set('sid', sid);

    return this.http.get<MeResponse>(this.ME_URL, { params }).pipe(
      tap(() => {
        // не светим sid в адресной строке после логина
        this.removeSidFromUrl();
      }),
      switchMap((me) => {
        this.state$.next({ status: 'authorized', me });

        // ВАЖНО: модельные токены теперь тоже через sid=query
        return this.modelTokens.refreshTokens().pipe(
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
        if (err?.status === 401 || err?.status === 403) {
          this.modelTokens.clear?.();
          this.state$.next({ status: 'unauthorized' });
          return of(this.state$.value);
        }

        console.error('Ошибка проверки авторизации', err);
        this.modelTokens.clear?.();
        this.state$.next({ status: 'error', message: 'Не удалось проверить авторизацию' });
        return of(this.state$.value);
      }),
    );
  }

  login(): void {
    window.location.href = this.LOGIN_URL;
  }

  changeAccount(): void {
    this.modelTokens.clear?.();
    // раз куки не используем — локально тоже чистим sid
    this.clearSid();
    window.location.href = this.LOGOUT_URL;
  }

  getMeSnapshot(): MeResponse | null {
    const s = this.state$.value;
    return s.status === 'authorized' ? s.me : null;
  }

  /** Достаём sid для других сервисов (AiApiService и т.д.) */
  getSidOrThrow(): string {
    const sid = this.ensureSid();
    if (!sid) throw new Error('sid_missing');
    return sid;
  }

  // -------------------- sid helpers --------------------

  /** Берём sid из URL или localStorage, и сохраняем в localStorage */
  private ensureSid(): string | null {
    const fromUrl = this.getSidFromUrl();
    if (fromUrl) {
      this.saveSid(fromUrl);
      return fromUrl;
    }
    const fromStorage = this.getSidFromStorage();
    return fromStorage;
  }

  private getSidFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    const sid = (sp.get('sid') ?? '').trim();
    return sid || null;
  }

  private removeSidFromUrl(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('sid')) return;
    url.searchParams.delete('sid');
    window.history.replaceState({}, document.title, url.toString());
  }

  private saveSid(sid: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SID_STORAGE_KEY, sid);
    } catch {}
  }

  private getSidFromStorage(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const sid = (window.localStorage.getItem(SID_STORAGE_KEY) ?? '').trim();
      return sid || null;
    } catch {
      return null;
    }
  }

  private clearSid(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(SID_STORAGE_KEY);
    } catch {}
  }
}
