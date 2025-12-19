import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_CONFIG } from '../tokens/api-config.token';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private cfg = inject(API_CONFIG);

  post<T>(endpoint: string, body: unknown, options?: object) {
    const url = this.cfg.baseUrl + endpoint;
    return this.http.post<T>(url, body, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  }
}
