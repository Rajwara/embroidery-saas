export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MeResponse {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  is_platform_admin: boolean;
  mfa_enabled: boolean;
}

export interface PermissionsResponse {
  user_id: string;
  is_super_admin: boolean;
  permissions: string[];
}
