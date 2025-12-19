import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { API_CONFIG } from '../tokens/api-config.token';
import { AiRequest, AiResponse } from '../models/dto';
import { scan, delay, retry } from 'rxjs/operators';
import { expBackoffDelay } from '../utils/backoff';
import { timer } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AiService {
  private api = inject(ApiService);
  private cfg = inject(API_CONFIG);

  ask(payload: AiRequest) {
    return this.api.post<AiResponse>(this.cfg.aiEndpoint, payload).pipe(
      retry({
        count: this.cfg.maxRetries,
        delay: (error, retryCount) => timer(expBackoffDelay(retryCount, this.cfg.baseRetryDelayMs)),
      }),
    );
  }
}
