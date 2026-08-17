"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";

const PLATFORM_NAV = [
  { label: "Dashboard", href: "/platform/dashboard" },
  { label: "Subscriber Factories", href: "/platform/factories" },
  { label: "Trial Accounts", href: "/platform/trial-accounts" },
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { status, user, isPlatformAdmin, logout } = useAuth();
  const router = useRouter();

  // Separate auth boundary from the tenant (dashboard) layout -- being
  // logged in isn't enough, is_platform_admin is a distinct cross-tenant
  // concern (see routers/platform.py's module docstring). Not a tenant
  // role, so hasPermission()/the tenant permission catalog play no part
  // here.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && !isPlatformAdmin) {
      router.replace("/");
    }
  }, [status, isPlatformAdmin, router]);

  if (status !== "authenticated" || !isPlatformAdmin) {
    // Redirect is already in flight (or still loading) -- render nothing
    // to avoid a flash of platform-admin content.
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex h-screen w-56 flex-col justify-between border-r border-gray-200 bg-gray-900 p-4 text-white">
        <div>
          <div className="mb-6 px-2 text-lg font-semibold">Platform Admin</div>
          <nav className="space-y-1">
            {PLATFORM_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block rounded px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="space-y-2 px-2">
          <a href="/" className="block rounded px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800">
            Back to my factory
          </a>
          {user && <div className="truncate text-xs text-gray-400">{user.email}</div>}
          <button
            onClick={logout}
            className="w-full rounded px-3 py-2 text-left text-sm font-medium text-gray-200 hover:bg-gray-800"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
