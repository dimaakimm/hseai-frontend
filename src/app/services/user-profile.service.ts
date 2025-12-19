import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { UserProfile } from '../models/user-profile.model';

const STORAGE_KEY = 'hse-ai-user-profile';

@Injectable({
  providedIn: 'root',
})
export class UserProfileService {
  private readonly profileSubject = new BehaviorSubject<UserProfile | null>(this.loadFromStorage());

  readonly profile$ = this.profileSubject.asObservable();

  getProfile(): UserProfile | null {
    return this.profileSubject.value;
  }

  setProfile(profile: UserProfile): void {
    this.profileSubject.next(profile);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Не удалось сохранить профиль в localStorage', e);
    }
  }

  private loadFromStorage(): UserProfile | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as UserProfile;
    } catch (e) {
      console.error('Не удалось прочитать профиль из localStorage', e);
      return null;
    }
  }
}
