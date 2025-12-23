import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { SidService } from './sid.service';

export interface ModelTokens {
  access_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  [key: string]: any;
}

export interface GetModelTokensResponse {
  user: any;
  session_created_at: number;
  model_tokens: ModelTokens;
}

@Injectable({ providedIn: 'root' })
export class ModelTokensService {
  private readonly API_BASE = 'https://api.hse-ai.ru';
  private readonly TOKENS_URL = `${this.API_BASE}/get_model_tokens`;

  private readonly tokens$ = new BehaviorSubject<ModelTokens | null>(null);
  private inFlight$: Observable<ModelTokens> | null = null;

  constructor(
    private http: HttpClient,
    private sid: SidService,
  ) {}

  clear(): void {
    this.tokens$.next(null);
    this.inFlight$ = null;
  }

  refreshTokens(): Observable<ModelTokens> {
    if (this.inFlight$) return this.inFlight$;

    const sid = this.sid.getSidOrThrow();
    const params = new HttpParams().set('sid', sid);

    this.inFlight$ = this.http.get<GetModelTokensResponse>(this.TOKENS_URL, { params }).pipe(
      map((res) => res?.model_tokens),
      tap((t) => {
        if (!t?.access_token) throw new Error('model_tokens_missing_access_token');
        this.tokens$.next(t);
      }),
      shareReplay(1),
      tap({
        next: () => (this.inFlight$ = null),
        error: () => (this.inFlight$ = null),
      }),
      catchError((err) => {
        this.inFlight$ = null;
        return throwError(() => err);
      }),
    );

    return this.inFlight$;
  }

  private hasValidAccessToken(t: ModelTokens | null): t is ModelTokens {
    if (!t?.access_token) return false;
    const exp = t.expires_at;
    if (!exp) return true;
    const nowSec = Date.now() / 1000;
    return nowSec < Number(exp) - 10;
  }

  getAccessToken(): Observable<string> {
    const current = this.tokens$.value;
    if (this.hasValidAccessToken(current)) return of(current.access_token);
    return this.refreshTokens().pipe(map((t) => t.access_token));
  }
}
