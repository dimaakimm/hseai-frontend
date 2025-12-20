export interface MeResponse {
  user: {
    name: string;
    given_name: string;
    family_name: string;
    email: string;

    email_verified: boolean;
    preferred_username?: string; // ✅ делаем optional

    [key: string]: any;
  };
  session_created_at: number;
  [key: string]: any;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'authorized'; me: MeResponse }
  | { status: 'error'; message: string };
