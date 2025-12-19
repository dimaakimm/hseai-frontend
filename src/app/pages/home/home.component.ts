import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthState } from '../../shared/auth/auth.models';
import { AuthService } from '../../shared/auth/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  state$: Observable<AuthState>;

  constructor(private auth: AuthService) {
    this.state$ = this.auth.authState$();
  }

  login() {
    this.auth.login();
  }

  changeAccount() {
    this.auth.changeAccount();
  }

  // "Ким Дмитрий"
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
