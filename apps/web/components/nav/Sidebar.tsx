"use client";

import { useEffect, useState } from "react";

import { listPurchaseRequired } from "@embroidery/types";

import { useAuth } from "@/lib/auth-context";

import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./NavLink";

export function Sidebar() {
  const { hasPermission, user, isPlatformAdmin, logout } = useAuth();
  const [openPurchaseRequiredCount, setOpenPurchaseRequiredCount] = useState(0);

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(item.requiredPermission));

  // Minimal in-app notification for threshold breaches (ROADMAP.md Phase 4
  // item 4) -- a full Notifications Centre with persistence/read-state is
  // explicit Phase 5 scope, not this.
  useEffect(() => {
    if (!hasPermission("inventory.view")) return;
    listPurchaseRequired({ open_only: true })
      .then((rows) => setOpenPurchaseRequiredCount(rows.length))
      .catch(() => setOpenPurchaseRequiredCount(0));
  }, [hasPermission]);

  return (
    <aside className="flex h-screen w-56 flex-col justify-between border-r border-gray-200 bg-white p-4">
      <div>
        <div className="mb-6 px-2 text-lg font-semibold">Embroidery SaaS</div>
        <nav className="space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              badge={item.href === "/purchase-required" ? openPurchaseRequiredCount : undefined}
            />
          ))}
        </nav>
      </div>
      <div className="space-y-2 px-2">
        {isPlatformAdmin && (
          <a
            href="/platform/dashboard"
            className="block rounded px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Platform Admin
          </a>
        )}
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
