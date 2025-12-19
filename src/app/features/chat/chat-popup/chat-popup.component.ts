import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserProfile } from '../../../models/user-profile.model';
import { AiApiService } from '../../../services/ai-api.service';

const USER_PROFILE_STORAGE_KEY = 'hseChatUserProfile';

type ChatStage =
  | 'askQuestion'
  | 'chooseCategory'
  | 'waitingModel'
  | 'rateAnswer'
  | 'afterNegative'
  | 'clarifyQuestion';

type ChatRole = 'bot' | 'user';

interface ChatMessage {
  id: number;
  role: ChatRole;
  text: string;
  timestamp?: string;
}

// все доступные категории для ручного выбора
const ALL_CATEGORIES: string[] = [
  'Учебный процесс',
  'Безопасность',
  'Наука',
  'Практическая подготовка',
  'Перемещения студентов / Изменения статусов студентов',
  'ГИА',
  'Траектории обучения',
  'Английский язык',
  'Цифровые компетенции',
  'Онлайн-обучение',
  'Дополнительное образование',
  'ОВЗ',
  'Выпускникам',
  'ВУЦ',
  'Внеучебка',
  'Социальные вопросы',
  'Общежития',
  'Цифровые системы',
  'Деньги',
  'Обратная связь',
];

@Component({
  selector: 'app-chat-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-popup.component.html',
  styleUrl: './chat-popup.component.scss',
})
export class ChatPopupComponent implements OnInit {
  /** Профиль пользователя (level, campus и т.п.) */
  @ViewChild('messagesContainer')
  messagesContainer?: ElementRef<HTMLDivElement>;
  @Input({ required: true })
  userProfile!: UserProfile;
  nameError: string | null = null;

  /** Сообщаем родителю, что профиль обновлён */
  @Output() userProfileChange = new EventEmitter<UserProfile>();

  /** Ссылка на форму обратной связи (если нужно открыть внешнюю форму) */
  @Input() feedbackUrl?: string;
  @Output() feedbackClick = new EventEmitter<void>();

  isOpen = false;

  /** Текущий режим внутри попапа: чат или форма профиля */
  viewMode: 'chat' | 'profile' = 'chat';

  /** Черновик профиля для формы редактирования */
  userProfileDraft: UserProfile | null = null;

  messages: ChatMessage[] = [];
  private msgId = 1;

  stage: ChatStage = 'askQuestion';
  isWaitingForModel = false;

  isProfileSaveDisabled = false;

  currentInput = '';

  currentQuestion = '';
  currentCategory: string = ''; // только одна категория, без подкатегорий
  /** список категорий для ручного выбора, используется в шаблоне */
  readonly manualCategories: string[] = ALL_CATEGORIES;

  /** "сырые" данные классификатора (что вернул AiApiService.classify) */
  private questionFiltersRaw: any | null = null;

  constructor(private aiApi: AiApiService) {}

  ngOnInit(): void {
    this.loadUserProfileFromStorage();
    this.toStartState();
  }

  // ---------- геттеры для шаблона ----------

  get inputPlaceholder(): string {
    if (this.stage === 'clarifyQuestion') {
      return 'Напиши уточнение к текущему вопросу...';
    }
    return 'Сформулируй свой вопрос по учебным процессам Вышки...';
  }

  get isInputDisabled(): boolean {
    return (
      this.viewMode === 'profile' ||
      this.stage === 'chooseCategory' ||
      this.stage === 'waitingModel' ||
      this.stage === 'rateAnswer' ||
      this.stage === 'afterNegative'
    );
  }

  private validateProfileDraft(): boolean {
    this.nameError = null;

    if (!this.userProfileDraft) {
      this.isProfileSaveDisabled = true;
      return false;
    }

    const raw = this.userProfileDraft.name ?? '';
    const name = raw.trim();

    // Имя необязательное, но если его ввели — должно быть не короче 3 символов
    if (name && name.length < 3) {
      this.nameError = 'Имя должно содержать не менее 3 символов.';
    }

    // если есть любая ошибка — дизейблим кнопку
    this.isProfileSaveDisabled = !!this.nameError;

    return !this.nameError;
  }

  // ---------- открытие / закрытие попапа ----------

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.messages.length === 0) {
      this.toStartState();
    }
  }

  close(): void {
    this.isOpen = false;
  }

  // ---------- стартовое состояние ----------

  private toStartState(clearMessages: boolean = true): void {
    this.viewMode = 'chat';
    this.stage = 'askQuestion';
    this.isWaitingForModel = false;
    this.currentInput = '';
    this.currentQuestion = '';
    this.currentCategory = '';
    this.questionFiltersRaw = null;

    if (clearMessages || this.messages.length === 0) {
      this.messages = [];
      this.addBotMessage(
        'Я бот, созданный для помощи по учебным процессам Вышки! Какой у тебя вопрос?',
      );
    }
  }

  // ---------- сообщения ----------

  private addBotMessage(text: string): void {
    this.messages.push({
      id: this.msgId++,
      role: 'bot',
      text,
      timestamp: this.nowTime(),
    });

    this.scheduleScrollToBottom();
  }

  private addUserMessage(text: string): void {
    this.messages.push({
      id: this.msgId++,
      role: 'user',
      text,
      timestamp: this.nowTime(),
    });

    this.scheduleScrollToBottom();
  }

  private nowTime(): string {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ---------- универсальная обработка ошибок ручек ----------

  private showErrorWithRating(): void {
    const errorText =
      'При получении ответа (классификатора/модели) произошла ошибка. ' +
      'Пожалуйста, попробуйте еще раз или повторите позже.';

    // сначала сообщение об ошибке
    this.addBotMessage(errorText);
    // потом отдельным сообщением — вопрос про оценку
    this.addBotMessage('Удовлетворен(а) ли ты полученным ответом?');

    this.stage = 'rateAnswer';
    this.isWaitingForModel = false;
  }

  // ---------- отправка текста ----------

  onSubmit(): void {
    const value = this.currentInput.trim();
    if (!value || this.isInputDisabled) {
      return;
    }

    if (this.stage === 'askQuestion') {
      this.handleNewQuestion(value);
    } else if (this.stage === 'clarifyQuestion') {
      this.handleClarification(value);
    }

    this.currentInput = '';
  }

  private handleNewQuestion(question: string): void {
    this.addUserMessage(question);
    this.currentQuestion = question;
    this.callClassifier(question);
  }

  private handleClarification(clarification: string): void {
    this.addUserMessage(clarification);
    this.currentQuestion = this.currentQuestion + '\n\nУточнение пользователя: ' + clarification;
    this.callModel();
  }

  // ---------- classifier: новая логика ----------

  private callClassifier(question: string): void {
    this.aiApi.classify(question).subscribe({
      next: (res: any) => {
        this.questionFiltersRaw = res;

        const isInappropriate = res?.is_inappropriate === true;
        if (isInappropriate) {
          // Вопрос неподходящий — просим задать заново
          this.addBotMessage(
            'Похоже, вопрос сформулирован некорректно или не относится к учебным процессам Вышки. ' +
              'Пожалуйста, переформулируй вопрос и попробуй ещё раз.',
          );
          this.stage = 'askQuestion';
          return;
        }

        const predictedCategory: string | undefined = res?.predicted_category;
        const confidence: number = typeof res?.confidence === 'number' ? res.confidence : 0;

        if (predictedCategory && confidence > 0) {
          // Модель уверена — просто сообщаем категорию и сразу идём в RAG
          this.currentCategory = predictedCategory;
          this.addBotMessage(`Категория твоего вопроса: ${this.currentCategory}.`);
          this.callModel();
        } else {
          // confidence == 0 или нет категории — просим выбрать руками
          this.stage = 'chooseCategory';
          this.addBotMessage(
            'Я не смог автоматически определить категорию твоего вопроса. ' +
              'Пожалуйста, выбери подходящую категорию из списка ниже.',
          );
        }
      },
      error: () => {
        this.showErrorWithRating();
      },
    });
  }

  /** Пользователь вручную выбрал категорию, когда confidence = 0 */
  onCategorySelect(category: string): void {
    this.currentCategory = category;

    // В questionFiltersRaw прокидываем выбранную категорию,
    // чтобы RAG мог её использовать как фильтр
    if (this.questionFiltersRaw && typeof this.questionFiltersRaw === 'object') {
      (this.questionFiltersRaw as any).predicted_category = category;
      if (typeof (this.questionFiltersRaw as any).confidence !== 'number') {
        (this.questionFiltersRaw as any).confidence = 0;
      }
    } else {
      this.questionFiltersRaw = {
        predicted_category: category,
        confidence: 0,
      };
    }

    this.addBotMessage(`Категория твоего вопроса: ${category}.`);
    this.stage = 'askQuestion';
    this.callModel();
  }

  // ---------- парсинг FINAL ANSWER + ссылки из RAG-ответа ----------

  private extractFinalAnswerFromResponse(response: any): {
    answer: string | null;
    links: string[];
  } {
    if (!response) {
      return { answer: null, links: [] };
    }

    let raw: string | null = null;

    // Вариант 1: сырой RAG-ответ с outputs
    if (Array.isArray(response.outputs)) {
      const answerOutput = response.outputs.find((o: any) => o && o.name === 'answer');
      if (answerOutput && answerOutput.data != null) {
        raw = String(answerOutput.data);
      }
    }

    // Вариант 2: вдруг сервис уже положил строку в response.answer
    if (!raw && typeof response.answer === 'string') {
      raw = response.answer;
    }

    if (!raw) {
      return { answer: null, links: [] };
    }

    return this.extractFinalAnswerFromString(raw);
  }

  private extractFinalAnswerFromString(raw: string): {
    answer: string;
    links: string[];
  } {
    // Превратим "\n" в настоящие переносы строк
    const unescaped = raw.replace(/\\n/g, '\n');

    const prefix = 'FINAL ANSWER:';
    let answer = '';

    const idx = unescaped.indexOf(prefix);

    if (idx !== -1) {
      // Классический формат с FINAL ANSWER
      let rest = unescaped.slice(idx + prefix.length).trim();

      // После ответа в твоём формате идёт "', ['https://...']"
      const endMarker = "', [";
      const endIdx = rest.indexOf(endMarker);
      if (endIdx !== -1) {
        rest = rest.slice(0, endIdx);
      }

      // На всякий случай уберём внешние одинарные кавычки
      if (rest.startsWith("'") && rest.endsWith("'")) {
        rest = rest.slice(1, -1);
      }

      answer = rest.trim();
    } else {
      // Формат без FINAL ANSWER, но с виду как:
      // ['ТЕКСТ ОТВЕТА', ['https://link1', 'https://link2']]
      let tmp = unescaped.trim();
      const marker = "', [";
      const markerIdx = tmp.indexOf(marker);

      if (tmp.startsWith("['") && markerIdx !== -1) {
        // Вырезаем всё между [' и ', [
        answer = tmp.slice(2, markerIdx).trim();
      } else {
        // Фоллбек — берём всю строку
        answer = tmp;
      }
    }

    // Вытаскиваем все URL-ы из исходного текста
    const urlRegex = /https?:\/\/[^\s'"]+/g;
    const links = Array.from(new Set(unescaped.match(urlRegex) ?? []));

    return { answer, links };
  }

  private escapeHtml(text: string): string {
    if (text == null) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- запрос к ИИ (RAG) ----------

  private callModel(): void {
    const { campus, level } = this.userProfile || {};

    // Требуем только кампус и уровень образования
    if (!(campus && level)) {
      this.addBotMessage(
        'Не удалось получить данные о пользователе (кампус и уровень образования). ' +
          'Пожалуйста, заполни параметры пользователя и попробуй снова.',
      );
      this.stage = 'askQuestion';
      this.isWaitingForModel = false;
      return;
    }

    this.stage = 'waitingModel';
    this.isWaitingForModel = true;

    this.aiApi
      .predict({
        question: this.currentQuestion,
        questionFilters: this.questionFiltersRaw ?? {},
        userProfile: this.userProfile,
        chatHistory: [],
      })
      .subscribe({
        next: (res: any) => {
          this.isWaitingForModel = false;

          const { answer, links } = this.extractFinalAnswerFromResponse(res);

          const normalized = (answer ?? '').trim();
          const lower = normalized.toLowerCase();

          // считаем ответ от бэка ошибочным
          const isBackendError =
            !normalized || lower.includes('http error') || lower.includes('network error');

          if (isBackendError) {
            this.showErrorWithRating();
            return;
          }

          // ====== НОВАЯ ЛОГИКА ДЛЯ "Я не могу обсуждать..." ======
          const moderationPhrases = [
            'Я не могу обсуждать эту тему',
            'Мне кажется, неуместно здесь это обсуждать',
          ];

          const containsModerationBlock = moderationPhrases.some((phrase) =>
            normalized.includes(phrase),
          );

          if (containsModerationBlock) {
            // 1) показываем текст ответа модели
            this.addBotMessage(normalized);

            // 2) предлагаем задать другой вопрос
            this.addBotMessage(
              'Ты можешь задать другой вопрос, связанный с учебными процессами Вышки.',
            );

            // 3) возвращаемся к режиму "задать новый вопрос"
            this.stage = 'askQuestion';
            return;
          }
          // ====== КОНЕЦ НОВОЙ ЛОГИКИ ======

          // 1) отдельное сообщение с ответом + ссылки
          let answerBlock = normalized;

          if (links.length) {
            // пустая строка перед блоком ссылок
            answerBlock += '\n\nУпоминается в ссылках ниже:\n' + links.join('\n');
          }

          this.addBotMessage(answerBlock);

          // 2) отдельное сообщение с вопросом про удовлетворённость
          this.addBotMessage('Удовлетворен(а) ли ты полученным ответом?');
          this.stage = 'rateAnswer';
        },
        error: () => {
          this.showErrorWithRating();
        },
      });
  }

  // ---------- оценка ответа ----------

  onRate(isSatisfied: boolean): void {
    if (isSatisfied) {
      this.addUserMessage('Да, удовлетворен');
      this.addBotMessage('Спасибо за оценку. Можешь задать новый вопрос');

      // начинаем новый вопрос, но историю НЕ стираем
      this.toStartState(false);
    } else {
      this.addUserMessage('Нет, не удовлетворен');
      this.stage = 'afterNegative';
    }
  }

  onClarifyCurrent(): void {
    this.stage = 'clarifyQuestion';
    this.addBotMessage(
      'Опиши, что именно нужно уточнить в твоём вопросе. Я передам уточнение ИИ-модели.',
    );
  }

  onAskNew(): void {
    this.addBotMessage('Спасибо за оценку. Можешь задать новый вопрос');
    this.toStartState(false);
  }

  // ---------- режим редактирования профиля ----------

  openProfileView(): void {
    this.viewMode = 'profile';
    this.userProfileDraft = { ...(this.userProfile ?? ({} as UserProfile)) };
  }

  onCancelProfileEdit(): void {
    this.viewMode = 'chat';
    this.userProfileDraft = null;
  }

  onSaveProfile(): void {
    if (!this.userProfileDraft) return;

    // если валидация не пройдена — остаёмся в форме профиля
    if (!this.validateProfileDraft()) {
      return;
    }

    this.userProfile = { ...this.userProfileDraft };

    this.persistUserProfileToStorage();
    this.userProfileChange.emit(this.userProfile);

    this.viewMode = 'chat';
    this.userProfileDraft = null;
    this.nameError = null;

    this.addBotMessage(
      'Параметры пользователя обновлены и сохранены. Можешь задать новый вопрос или уточнить текущий.',
    );
  }

  onNameChange(value: string): void {
    if (!this.userProfileDraft) return;
    this.userProfileDraft.name = value;
    this.validateProfileDraft();
  }

  onInputKeydown(event: KeyboardEvent): void {
    // Enter без модификаторов — отправка
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.preventDefault(); // не вставлять перенос строки

      if (!this.isInputDisabled && this.currentInput.trim()) {
        this.onSubmit();
      }
    }
  }

  // ---------- обратная связь ----------

  onFeedbackClick(): void {
    if (this.feedbackUrl) {
      window.open(this.feedbackUrl, '_blank');
    }
    this.feedbackClick.emit();
  }

  private scheduleScrollToBottom(): void {
    // даём Angular обновить DOM
    setTimeout(() => this.scrollToBottom(), 0);
  }

  private scrollToBottom(): void {
    if (!this.messagesContainer) return;
    const el = this.messagesContainer.nativeElement;
    el.scrollTop = el.scrollHeight;
  }

  private loadUserProfileFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as UserProfile;

      // Если в @Input уже что-то пришло — аккуратно мержим
      this.userProfile = {
        ...(this.userProfile ?? ({} as UserProfile)),
        ...parsed,
      };
    } catch (e) {
      console.warn('Не удалось прочитать профиль из localStorage', e);
    }
  }

  private persistUserProfileToStorage(): void {
    if (typeof window === 'undefined') return;
    if (!this.userProfile) return;

    try {
      const json = JSON.stringify(this.userProfile);
      window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, json);
    } catch (e) {
      console.warn('Не удалось сохранить профиль в localStorage', e);
    }
  }
}
