import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Campus, EducationLevel, UserProfile } from '../../models/user-profile.model';
import { UserProfileService } from '../../services/user-profile.service';

@Component({
  selector: 'app-user-profile-form',
  standalone: true,
  templateUrl: './user-profile-form.component.html',
  // styleUrls: ['./user-profile-form.component.scss'],
  imports: [CommonModule, ReactiveFormsModule], // <<< ВАЖНО
})
export class UserProfileFormComponent implements OnInit {
  @Output() saved = new EventEmitter<UserProfile>();

  form: FormGroup;

  readonly campuses: Campus[] = ['Москва', 'Санкт-Петербург', 'Нижний Новгород', 'Пермь'];

  readonly levels: EducationLevel[] = ['бакалавриат', 'специалитет', 'магистратура', 'аспирантура'];

  submitError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private userProfileService: UserProfileService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      campus: ['Москва', Validators.required],
      level: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    const existing = this.userProfileService.getProfile();
    if (existing) {
      this.form.patchValue(existing);
    }
  }

  get nameControl() {
    return this.form.get('name');
  }

  get campusControl() {
    return this.form.get('campus');
  }

  get levelControl() {
    return this.form.get('level');
  }

  onSubmit(): void {
    this.submitError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError = 'Пожалуйста, исправьте ошибки в форме.';
      return;
    }

    const profile: UserProfile = this.form.value;
    this.userProfileService.setProfile(profile);
    this.saved.emit(profile);
  }
}
