"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  listInventoryItems,
  listPayrollRuns,
  listProductionEntries,
  listPurchaseRequired,
} from "@embroidery/types";
import type { InventoryItemOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface NotificationCard {
  key: string;
  title: string;
  count: number;
  href: string;
  tone: "warning" | "neutral";
}

export default function NotificationsCentrePage() {
  const { hasPermission } = useAuth();
  const [cards, setCards] = useState<NotificationCard[] | null>(null);
  const [lowStockItems, setLowStockItems] = useState<InventoryItemOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const jobs: Promise<NotificationCard | null>[] = [];

    if (hasPermission("production_entries.approve")) {
      jobs.push(
        listProductionEntries({ status: "pending" })
          .then((rows) => ({
            key: "production",
            title: "Production entries pending approval",
            count: rows.length,
            href: "/approvals",
            tone: "neutral" as const,
          }))
          .catch(() => null)
      );
    }

    if (hasPermission("inventory.edit")) {
      jobs.push(
        listPurchaseRequired({ status: "pending_approval" })
          .then((rows) => ({
            key: "purchase-required",
            title: "Purchase requests pending approval",
            count: rows.length,
            href: "/approvals",
            tone: "neutral" as const,
          }))
          .catch(() => null)
      );
    }

    if (hasPermission("payroll.approve")) {
      jobs.push(
        listPayrollRuns()
          .then((rows) => ({
            key: "payroll",
            title: "Payroll runs pending approval",
            count: rows.filter((run) => run.status === "draft").length,
            href: "/approvals",
            tone: "neutral" as const,
          }))
          .catch(() => null)
      );
    }

    if (hasPermission("inventory.view")) {
      jobs.push(
        listInventoryItems()
          .then((items) => {
            const low = items.filter((item) => item.is_below_threshold);
            setLowStockItems(low);
            return {
              key: "low-stock",
              title: "Items below minimum stock threshold",
              count: low.length,
              href: "/inventory",
              tone: "warning" as const,
            };
          })
          .catch(() => null)
      );
    }

    Promise.all(jobs)
      .then((results) => setCards(results.filter((r): r is NotificationCard => r !== null)))
      .catch(() => setError("Could not load notifications."));
  }, [hasPermission]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!error && cards === null && <p className="text-sm text-gray-500">Loading...</p>}

      {!error && cards !== null && cards.length === 0 && (
        <p className="text-sm text-gray-500">Nothing needs your attention right now.</p>
      )}

      {!error && cards !== null && cards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className={`rounded p-4 shadow hover:opacity-90 ${
                card.tone === "warning" && card.count > 0 ? "bg-red-50" : "bg-white"
              }`}
            >
              <p
                className={`text-2xl font-semibold ${
                  card.tone === "warning" && card.count > 0 ? "text-red-700" : "text-gray-900"
                }`}
              >
                {card.count}
              </p>
              <p className="mt-1 text-sm text-gray-600">{card.title}</p>
            </Link>
          ))}
        </div>
      )}

      {lowStockItems.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Low stock items</h2>
          <table className="w-full rounded bg-white text-sm shadow">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium">Current stock</th>
                <th className="px-4 py-2 font-medium">Minimum threshold</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2">
                    {item.name} <span className="text-gray-400">({item.unit})</span>
                  </td>
                  <td className="px-4 py-2 font-semibold text-red-700">{item.current_stock}</td>
                  <td className="px-4 py-2">{item.minimum_threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
