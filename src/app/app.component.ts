import { Component } from '@angular/core';
import { ChatPopupComponent } from './features/chat/chat-popup/chat-popup.component';
import { UserProfile } from './models/user-profile.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatPopupComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  // ✅ ЭТО тот самый userProfile, которого у тебя "Unresolved variable"
  userProfile: UserProfile = {
    name: '',
    level: 'бакалавриат',
    campus: 'Москва',
  };

  // ссылка на форму обратной связи (если нужна)
  feedbackUrl = 'https://forms.yandex.ru/cloud/688626ebeb614611471b4c22';

  // если захочешь ловить изменения профиля из чата
  onUserProfileChange(profile: UserProfile): void {
    this.userProfile = profile;
    // здесь можно сохранить в localStorage и т.д.
  }
}
