export type Campus = 'Москва' | 'Санкт-Петербург' | 'Нижний Новгород' | 'Пермь';

export type EducationLevel = 'бакалавриат' | 'специалитет' | 'магистратура' | 'аспирантура';

export interface UserProfile {
  name: string;
  campus: Campus;
  level: EducationLevel;
}
