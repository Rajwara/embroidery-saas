"use client";

import { useAuth } from "@/lib/auth-context";

import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./NavLink";

export function Sidebar() {
  const { hasPermission, user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(item.requiredPermission));

  return (
    <aside className="flex h-screen w-56 flex-col justify-between border-r border-gray-200 bg-white p-4">
      <div>
        <div className="mb-6 px-2 text-lg font-semibold">Embroidery SaaS</div>
        <nav className="space-y-1">
          {visibleItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
      </div>
      <div className="space-y-2 px-2">
        {user && <div className="truncate text-xs text-gray-500">{user.email}</div>}
        <button
          onClick={logout}
          className="w-full rounded px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
