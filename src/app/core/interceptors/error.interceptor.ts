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
        const key = '__reloaded_after_401__';

        // защита от бесконечного цикла
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');

          // можно чистить локальный профиль/кеш при желании:
          // localStorage.removeItem('hseChatUserProfile');

          window.location.reload();
          // важно вернуть ошибку, но перезагрузка всё равно прервёт поток
        }
      }

      return throwError(() => err);
    }),
  );
};
