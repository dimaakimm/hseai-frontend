import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../tokens/api-config.token';
import { ClassifierRequest, ClassifierResponse } from '../models/dto';
import { retry, switchMap } from 'rxjs/operators';
import { timer, throwError, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ClassifierService {
  private http = inject(HttpClient);
  private cfg = inject(API_CONFIG);

  // Метод для получения access_token через OpenID password flow
  private getToken() {
    const body = new URLSearchParams();
    body.set('client_id', 'end-users');
    body.set('grant_type', 'password');
    body.set('username', 'pu-vleviczkaya-pa-hsetest');
    body.set('password', '30XMCxnyjvrE44FM64vl5');

    const url = `https://platform-sso.stratpro.hse.ru/realms/platform.stratpro.hse.ru/protocol/openid-connect/token`;

    return this.http.post<{ access_token: string }>(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  classify(question: string) {
    const payload: ClassifierRequest = {
      inputs: [{ name: 'question', datatype: 'str', data: question, shape: 0 }],
      output_fields: [
        { name: 'question', datatype: 'str' },
        { name: 'predicted_category', datatype: 'str' },
        { name: 'confidence', datatype: 'FP64' },
      ],
    };

    return this.getToken().pipe(
      switchMap((tokenRes) => {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRes.access_token}`,
        };
        const fullUrl = `https://platform.stratpro.hse.ru/pu-vleviczkaya-pa-classifier/classifier2/predict`;

        return this.http.post<ClassifierResponse>(fullUrl, payload, { headers });
      }),
      retry({
        count: this.cfg.maxRetries,
        delay: (_err, retryCount) => timer(Math.min(1000 * 2 ** retryCount, 10000)), // экспоненциальная задержка
      }),
    );
  }
}
