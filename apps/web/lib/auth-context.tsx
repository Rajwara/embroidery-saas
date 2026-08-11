"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { apiFetch } from "./api";
import { clearTokens, getTokens, setTokens } from "./auth-storage";
import { hasPermission } from "./permissions";
import type { MeResponse, PermissionsResponse, TokenResponse } from "@/types/auth";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: Status;
  user: MeResponse | null;
  permissions: string[];
  isSuperAdmin: boolean;
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
  const [user, setUser] = useState<MeResponse | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const loadProfile = useCallback(async () => {
    try {
      const [me, perms] = await Promise.all([
        apiFetch<MeResponse>("/auth/me"),
        apiFetch<PermissionsResponse>("/me/permissions"),
      ]);
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
      const res = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, totp_code: totpCode }),
      });
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
