export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AuthPermissions {
  createLink: boolean;
  assignLinkCategory: boolean;
  manageLinks: boolean;
  manageFolders: boolean;
  deleteLinks: boolean;
  purgeLinks: boolean;
  manageUsers: boolean;
}

export interface AuthSession {
  authenticated: boolean;
  user: AuthUser | null;
  csrfToken: string;
  permissions: AuthPermissions;
}

export interface ManagedUser {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  active: number;
  must_change_password: number;
  created_at?: number;
  updated_at?: number;
  last_login_at?: number | null;
}

export interface AuditEntry {
  id: number;
  actor_username: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string;
  created_at: number;
}

export interface TrashedLink {
  id: string;
  title: string;
  url: string;
  category: string;
  subcategory: string;
  deleted_at: number;
  deleted_by_name: string | null;
}
