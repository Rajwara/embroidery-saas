"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getFactory } from "@embroidery/types";

import { Sidebar } from "@/components/nav/Sidebar";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type FactoryCheck = "checking" | "exists" | "missing";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const [factoryCheck, setFactoryCheck] = useState<FactoryCheck>("checking");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    getFactory()
      .then(() => setFactoryCheck("exists"))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setFactoryCheck("missing");
          router.replace("/onboarding");
        } else {
          // Fail open: a permission-limited user (or a transient network/5xx
          // blip) should never get stuck behind a wizard they can't
          // complete -- treat anything but a confirmed 404 as "exists".
          setFactoryCheck("exists");
        }
      });
  }, [status, router]);

  if (status === "loading" || (status === "authenticated" && factoryCheck === "checking")) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  if (status === "unauthenticated" || factoryCheck === "missing") {
    // Redirect is already in flight (see effects above) -- render nothing to
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
