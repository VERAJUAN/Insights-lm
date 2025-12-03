export type UserRole = 'superadministrator' | 'administrator' | 'reader';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole | null;
  organization_id: string | null;
  avatar_url: string | null;
}

export interface Organization {
  id: string;
  name: string;
  custom_prompt: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

