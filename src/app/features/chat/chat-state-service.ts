import { Injectable, signal } from '@angular/core';
import { ChatMessage, ChatState } from '../../core/models/chat';

const STORAGE_KEY = 'chat_state_v1';

function makeId() {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

@Injectable({ providedIn: 'root' })
export class ChatStateService {
  public questionHistory: string[] = [];
  state = signal<ChatState>({ question: '', history: [] });

  constructor() {
    this.restore();
  }

  private persist() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
  }
  private restore() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.state.set(JSON.parse(raw));
      } catch {}
    }
  }

  reset() {
    this.state.set({ question: '', history: [] });
    this.persist();
  }

  setQuestion(q: string) {
    const s = this.state();
    this.state.set({ ...s, question: q });
    this.persist();
  }

  setCategory(category: string) {
    const s = this.state();
    this.state.set({ ...s, category, subcategoryId: undefined });
    this.persist();
  }

  setSubcategory(id: string) {
    const s = this.state();
    this.state.set({ ...s, subcategoryId: id });
    this.persist();
  }

  pushMessage(role: 'bot' | 'user' | 'system', text: string) {
    const msg: ChatMessage = { id: makeId(), role, text, ts: Date.now() };
    const s = this.state();
    this.state.set({ ...s, history: [...s.history, msg] });
    this.persist();
  }

  setSatisfaction(v: boolean) {
    const s = this.state();
    this.state.set({ ...s, satisfied: v });
    this.persist();
  }
}
