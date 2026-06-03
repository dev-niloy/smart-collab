import { apiGet, apiPost } from './api';
import type { LoginInput, SignupInput, Role } from './schemas/auth';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = { user: PublicUser };

export const signup = (input: SignupInput) =>
  apiPost<AuthResponse>('/api/v1/auth/signup', input);

export const login = (input: LoginInput) =>
  apiPost<AuthResponse>('/api/v1/auth/login', input);

export const demoLogin = (role: Role) =>
  apiPost<AuthResponse>('/api/v1/auth/demo-login', { role });

export const logout = () => apiPost<void>('/api/v1/auth/logout');

export const me = () => apiGet<AuthResponse>('/api/v1/auth/me');
