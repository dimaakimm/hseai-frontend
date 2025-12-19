import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_CONFIG } from '../tokens/api-config.token';
import { timeout } from 'rxjs/operators';

export const timeoutInterceptor: HttpInterceptorFn = (req, next) => {
  const cfg = inject(API_CONFIG);
  return next(req).pipe(timeout(cfg.timeoutMs));
};
