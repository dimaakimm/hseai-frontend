import { Component, Input } from '@angular/core';
import { UserProfile } from '../../../models/user-profile.model';
import { AiApiService, PredictResult } from '../../../services/ai-api.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string | null;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent {
  @Input() userProfile: UserProfile | null = null;

  messages: ChatMessage[] = [];
  currentQuestion = '';
  isLoading = false;
  error: string | null = null;

  constructor(private aiApiService: AiApiService) {}

  onSend(): void {
    const question = this.currentQuestion.trim();
    if (!question) return;

    if (!this.userProfile) {
      this.error = 'Перед началом общения заполните профиль абитуриента.';
      return;
    }

    this.error = null;
    this.isLoading = true;

    // Добавляем сообщение пользователя в историю
    this.messages.push({ role: 'user', content: question });

    const chatHistory = this.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    this.aiApiService
      .askWithClassification({
        question,
        userProfile: this.userProfile,
        chatHistory: [],
      })
      .subscribe({
        next: (result: PredictResult) => {
          this.isLoading = false;

          this.messages.push({
            role: 'assistant',
            content: result.answer ?? 'Модель не вернула ответ.',
            sources: result.sources,
          });

          this.currentQuestion = '';
        },
        error: (err) => {
          console.error('Ошибка общения с моделью', err);
          this.isLoading = false;
          this.error = 'Не удалось получить ответ от модели.';
        },
      });
  }
}
