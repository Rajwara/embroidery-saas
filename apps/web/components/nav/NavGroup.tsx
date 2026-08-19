"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { NavLeaf } from "./nav-items";
import { NavLink } from "./NavLink";

export function NavGroup({ label, items }: { label: string; items: NavLeaf[] }) {
  const pathname = usePathname();
  // Prefix match, not exact -- pathname is "/payments/new" or
  // "/supplier-payments/71ba..." just as often as the bare parent route,
  // and those sub-pages need to count as "in this group" too.
  const containsActiveChild = items.some(
    (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
  );
  // Auto-expanded when you're already on one of its sub-pages, so a
  // reload/direct-link never hides the page you're looking at. The effect
  // (not just the useState initializer) keeps this true across client-side
  // navigations too -- Sidebar/NavGroup don't remount between routes, so an
  // initializer alone only catches the very first page load. Only ever
  // opens, never closes, so a manual toggle elsewhere isn't fought.
  const [open, setOpen] = useState(containsActiveChild);
  useEffect(() => {
    if (containsActiveChild) setOpen(true);
  }, [containsActiveChild]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
      >
        <span>{label}</span>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
      {open && (
        <div className="ml-3 mt-1 space-y-1 border-l border-gray-200 pl-2">
          {items.map((child) => (
            <NavLink key={child.href} href={child.href} label={child.label} />
          ))}
        </div>
      )}
    </div>
  );
}
