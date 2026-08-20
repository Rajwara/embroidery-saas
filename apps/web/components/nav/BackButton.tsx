"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  // Nothing to go back to from the Dashboard itself -- it's the app's home.
  if (pathname === "/") return null;

  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 -ml-2">
      <ArrowLeft />
      Back
    </Button>
  );
}
