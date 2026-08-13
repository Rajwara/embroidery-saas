"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label, badge }: { href: string; label: string; badge?: number }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded px-3 py-2 text-sm font-medium ${
        isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-200"
      }`}
    >
      <span>{label}</span>
      {!!badge && (
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
            isActive ? "bg-white text-gray-900" : "bg-red-600 text-white"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
