import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './shared/auth/auth.service';
import { AuthState } from './shared/auth/auth.models';

// ❗️подстрой путь под твою реальную модель
import { UserProfile } from './models/user-profile.model';
import { ChatPopupComponent } from './features/chat/chat-popup/chat-popup.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ChatPopupComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  state$: Observable<AuthState>;

  // ✅ добавляем то, что ожидает шаблон
  userProfile: UserProfile = {
    // заполни дефолтами под твою модель, ниже пример
    level: 'student',
    campus: 'main',
  } as unknown as UserProfile;

  feedbackUrl = 'https://your-feedback-url.example.com'; // либо что у тебя было

  constructor(private auth: AuthService) {
    this.state$ = this.auth.authState$();
  }

  onUserProfileChange(profile: UserProfile): void {
    this.userProfile = profile;
  }

  login(): void {
    this.auth.login();
  }

  changeAccount(): void {
    this.auth.changeAccount();
  }

  formatName(state: AuthState): string {
    if (state.status !== 'authorized') return '';
    const u = state.me.user;
    return `${u.family_name ?? ''} ${u.given_name ?? ''}`.trim();
  }

  formatEmail(state: AuthState): string {
    if (state.status !== 'authorized') return '';
    const u = state.me.user;
    return u.email || u.preferred_username || '';
  }
}
