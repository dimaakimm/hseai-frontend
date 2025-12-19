import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  baseUrl: string;
  classifierEndpoint: string;
  aiEndpoint: string;
  timeoutMs: number;
  maxRetries: number;
  baseRetryDelayMs: number;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');
