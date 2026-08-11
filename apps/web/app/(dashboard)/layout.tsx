"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "@/components/nav/Sidebar";
import { useAuth } from "@/lib/auth-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  if (status === "unauthenticated") {
    // Redirect is already in flight (see effect above) -- render nothing to
    // avoid a flash of protected content.
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
