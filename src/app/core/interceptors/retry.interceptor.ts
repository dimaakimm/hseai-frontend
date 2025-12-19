import { HttpInterceptorFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { retry } from 'rxjs/operators';
import { timer, Observable } from 'rxjs';
import { API_CONFIG } from '../tokens/api-config.token';
import { expBackoffDelay } from '../utils/backoff';

const RETRIABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export const retryInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  const cfg = inject(API_CONFIG);

  const safeMethod = req.method === 'GET' || req.method === 'HEAD';
  if (!safeMethod) {
    return next(req);
  }

  return next(req).pipe(
    retry({
      count: cfg.maxRetries,
      resetOnSuccess: true,
      delay: (error, retryCount) => {
        if (!(error instanceof HttpErrorResponse)) throw error;
        if (!RETRIABLE_STATUS.has(error.status)) throw error;
        const ra = error.headers?.get?.('Retry-After');
        let retryAfterMs = 0;
        if (ra) {
          const secs = Number(ra);
          if (!Number.isNaN(secs)) retryAfterMs = secs * 1000;
        }
        const backoff = expBackoffDelay(retryCount, cfg.baseRetryDelayMs);
        return timer(retryAfterMs + backoff);
      },
    }),
  );
};
