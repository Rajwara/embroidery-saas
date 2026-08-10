"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>("checking...");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => setApiStatus(`connected (${data.environment})`))
      .catch(() => setApiStatus("could not reach API — is it running?"));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h1 className="text-2xl font-semibold">Embroidery Factory Management</h1>
      <p className="text-gray-600">Phase 0 scaffold — replace this page in Phase 1.</p>
      <p className="rounded bg-white px-4 py-2 shadow">API status: {apiStatus}</p>
    </main>
  );
}
