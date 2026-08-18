"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, Bell, CheckCircle2 } from "lucide-react";

import {
  listInventoryItems,
  listPayrollRuns,
  listProductionEntries,
  listPurchaseRequired,
} from "@embroidery/types";
import type { InventoryItemOut } from "@embroidery/types";

import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {!error && cards === null && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {!error && cards !== null && cards.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <CheckCircle2 className="size-8 text-emerald-600" />
          <p className="text-sm font-medium">All caught up</p>
          <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
        </div>
      )}

      {!error && cards !== null && cards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const isWarning = card.tone === "warning" && card.count > 0;
            return (
              <Link key={card.key} href={card.href}>
                <Card className={isWarning ? "ring-1 ring-inset ring-amber-600/30" : undefined}>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className={`text-2xl font-semibold tabular-nums ${isWarning ? "text-amber-700" : ""}`}>
                        {card.count}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{card.title}</p>
                    </div>
                    {isWarning ? (
                      <AlertTriangle className="size-5 text-amber-600" />
                    ) : (
                      <Bell className="size-5 text-muted-foreground" />
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {lowStockItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Low stock items</h2>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Current stock</TableHead>
                  <TableHead className="text-right">Minimum threshold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.name} <span className="text-muted-foreground">({item.unit})</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="warning">{item.current_stock}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {item.minimum_threshold}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
