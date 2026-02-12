export type UserRole = 'admin' | 'user';

export type ToolId = 'email-analyzer' | 'fb-analyzer' | 'social-media' | 'article-generator' | 'cold-mailing' | 'campaign-analyzer';

export interface AllowedUser {
  id: string;
  email: string;
  user_id: string | null;
  role: UserRole;
  allowed_tools: ToolId[];
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserFormData {
  email: string;
  displayName: string;
  role: UserRole;
  allowedTools: ToolId[];
  method: 'invite' | 'password';
  password?: string;
}
