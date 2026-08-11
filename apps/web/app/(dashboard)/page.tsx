"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const [apiStatus, setApiStatus] = useState<string>("checking...");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => setApiStatus(`connected (${data.environment})`))
      .catch(() => setApiStatus("could not reach API — is it running?"));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {user ? `Welcome, ${user.full_name}` : "Dashboard"}
      </h1>
      <p className="inline-block rounded bg-white px-4 py-2 shadow">API status: {apiStatus}</p>
    </div>
  );
}
