import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type Campus = 'Москва' | 'Санкт-Петербург' | 'Нижний Новгород' | 'Пермь';
export type EducationLevel = 'бакалавриат' | 'специалитет' | 'магистратура' | 'аспирантура';

export interface UserProfile {
  name: string;
  campus: Campus;
  level: EducationLevel;
}

@Component({
  selector: 'app-user-profile-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile-form.component.html',
})
export class UserProfileFormComponent implements OnInit {
  @Input() initialName = ''; // сюда отдаём formatName(s)
  @Input() initialProfile?: Partial<UserProfile>;

  @Output() userProfileChange = new EventEmitter<UserProfile>();

  readonly campuses: Campus[] = ['Москва', 'Санкт-Петербург', 'Нижний Новгород', 'Пермь'];
  readonly levels: EducationLevel[] = ['бакалавриат', 'специалитет', 'магистратура', 'аспирантура'];

  userProfileDraft: UserProfile = {
    name: '',
    campus: 'Москва',
    level: 'бакалавриат',
  };

  ngOnInit(): void {
    this.userProfileDraft = {
      name: (this.initialName || '').trim(),
      campus: (this.initialProfile?.campus as Campus) ?? 'Москва',
      level: (this.initialProfile?.level as EducationLevel) ?? 'бакалавриат',
    };

    this.emit();
  }

  onChange(): void {
    this.emit();
  }

  private emit(): void {
    this.userProfileChange.emit({ ...this.userProfileDraft });
  }
}
