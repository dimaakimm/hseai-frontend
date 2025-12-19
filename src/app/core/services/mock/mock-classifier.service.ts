import { Injectable } from '@angular/core';
import { delay, of, throwError } from 'rxjs';
import { ClassifierResponse } from '../../models/dto';

const CATEGORIES = ['Admissions', 'Finance'] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function jitter(min = 500, max = 1200) {
  return Math.floor(Math.random() * (max - min)) + min;
}

@Injectable({ providedIn: 'root' })
export class MockClassifierService {
  classify(question: string) {
    // 10% шанс сымитировать ошибку сети
    if (Math.random() < 0.1)
      return throwError(() => new Error('Mock network error')).pipe(delay(jitter()));

    const category = pick(CATEGORIES);
    const res: ClassifierResponse = {
      outputs: {
        question,
        predicted_category: category,
        confidence: +(0.6 + Math.random() * 0.38).toFixed(2),
      },
    };
    return of(res).pipe(delay(jitter()));
  }
}
