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
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  state$: Observable<AuthState>;

  userProfile: UserProfile = {
    level: 'бакалавриат',
    campus: 'Москва',
  } as unknown as UserProfile;

  feedbackUrl = 'https://forms.yandex.ru/cloud/688626ebeb614611471b4c22';

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
