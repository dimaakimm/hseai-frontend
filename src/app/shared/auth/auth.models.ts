export interface MeResponse {
  user: {
    name: string;
    given_name: string;
    family_name: string;
    email: string;
    preferred_username: string;
    email_verified: boolean;

    [key: string]: any;
  };
  session_created_at: number;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'authorized'; me: MeResponse }
  | { status: 'error'; message: string };
