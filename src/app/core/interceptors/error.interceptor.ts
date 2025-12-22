import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      console.error('HTTP error:', err.status, err.message);
      return throwError(() => err);
    }),
  );
};

export const unauthorizedReloadInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        const isMeRequest = req.url.includes('/api/me') || req.url.endsWith('/api/me');

        if (!isMeRequest) {
          window.location.reload();
        }
      }

      return throwError(() => err);
    }),
  );
};
