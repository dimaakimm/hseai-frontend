import { Injectable } from '@angular/core';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AiRequest, AiResponse } from '../../models/dto';

function jitter(min = 800, max = 1600) {
  return Math.floor(Math.random() * (max - min)) + min;
}

@Injectable({ providedIn: 'root' })
export class MockAiService {
  ask(payload: AiRequest) {
    if (Math.random() < 0.1)
      return throwError(() => new Error('Mock AI error')).pipe(delay(jitter()));

    const q = payload.inputs.find((i) => i.name === 'question')?.data ?? '';
    const category =
      JSON.parse(payload.inputs.find((i) => i.name === 'question_filters')?.data ?? '[]')[0] ??
      'General';

    const variants = [
      `Вот что нашёл по категории «${category}».


1) Короткий ответ с шагами.
2) Ссылки на разделы сайта (пример).


Если нужно — уточни вопрос.`,
      `Ответ по теме «${category}»:
— Ключевые условия и сроки.
— Что подготовить заранее.


Могу уточнить детали, если добавишь контекст к вопросу: «${q.slice(0, 80)}…».`,
    ];

    const res: AiResponse = {
      outputs: { answer: variants[Math.floor(Math.random() * variants.length)] },
    } as any;
    return of(res).pipe(delay(jitter()));
  }
}
