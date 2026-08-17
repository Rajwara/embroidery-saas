"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { getMe, getMyPermissions, login as apiLogin } from "@embroidery/types";
import type { UserProfileResponse } from "@embroidery/types";

import { clearTokens, getTokens, setTokens } from "./auth-storage";
import { hasPermission } from "./permissions";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: Status;
  user: UserProfileResponse | null;
  permissions: string[];
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
  hasPermission: (code: string | null) => boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronous initial read avoids a loading flash on first paint when a
  // token already exists.
  const [status, setStatus] = useState<Status>(() =>
    getTokens()?.access_token ? "loading" : "unauthenticated"
  );
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const loadProfile = useCallback(async () => {
    try {
      const [me, perms] = await Promise.all([getMe(), getMyPermissions()]);
      setUser(me);
      setPermissions(perms.permissions);
      setStatus("authenticated");
    } catch {
      clearTokens();
      setUser(null);
      setPermissions([]);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    if (getTokens()?.access_token) {
      loadProfile();
    }
  }, [loadProfile]);

  const login = useCallback(
    async (email: string, password: string, totpCode?: string) => {
      const res = await apiLogin({ email, password, totp_code: totpCode });
      setTokens(res);
      await loadProfile();
    },
    [loadProfile]
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setPermissions([]);
    setStatus("unauthenticated");
  }, []);

  const value: AuthContextValue = {
    status,
    user,
    permissions,
    isSuperAdmin: user?.is_super_admin ?? false,
    isPlatformAdmin: user?.is_platform_admin ?? false,
    hasPermission: (code) => hasPermission(permissions, user?.is_super_admin ?? false, code),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
