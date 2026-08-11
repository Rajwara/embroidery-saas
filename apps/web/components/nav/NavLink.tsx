"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`block rounded px-3 py-2 text-sm font-medium ${
        isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label}
    </Link>
  );
}
