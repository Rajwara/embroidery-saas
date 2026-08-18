"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Factory,
  FileText,
  Wallet,
} from "lucide-react";

import {
  getFinancialSummaryReport,
  getProductionSummaryReport,
  listInvoices,
  listParties,
  listPayments,
} from "@embroidery/types";
import type {
  FinancialSummaryReportOut,
  InvoiceOut,
  PartyDocsOut,
  PaymentOut,
  ProductionSummaryReportOut,
} from "@embroidery/types";

import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FinancialSummaryChart } from "@/components/FinancialSummaryChart";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type ActivityItem = {
  kind: "invoice" | "payment";
  id: string;
  number: string;
  partyName: string;
  amount: number;
  date: string;
};

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const canSeeReports = hasPermission("reports.view");
  const canSeeInvoices = hasPermission("invoices.view");
  const canSeePayments = hasPermission("payments.view");

  const [financial, setFinancial] = useState<FinancialSummaryReportOut | null>(null);
  const [production, setProduction] = useState<ProductionSummaryReportOut | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  const loadReports = useCallback(() => {
    if (!canSeeReports) return;
    const dateFrom = firstOfMonth();
    const dateTo = today();
    Promise.all([
      getFinancialSummaryReport({ date_from: dateFrom, date_to: dateTo }),
      getProductionSummaryReport({ date_from: dateFrom, date_to: dateTo }),
    ])
      .then(([financialData, productionData]) => {
        setFinancial(financialData);
        setProduction(productionData);
      })
      .catch(() => {
        // Dashboard is a summary view -- a failed widget shouldn't block the
        // rest of the page; leave financial/production at null (skeleton)
        // rather than showing an error state for a non-critical section.
      });
  }, [canSeeReports]);

  const loadActivity = useCallback(() => {
    if (!canSeeInvoices && !canSeePayments) return;
    Promise.all([
      canSeeInvoices ? listInvoices({ limit: 5 }) : Promise.resolve<InvoiceOut[]>([]),
      canSeePayments ? listPayments({ limit: 5 }) : Promise.resolve<PaymentOut[]>([]),
      listParties().catch(() => [] as PartyDocsOut[]),
    ])
      .then(([invoices, payments, parties]) => {
        const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";
        const items: ActivityItem[] = [
          ...invoices.map(
            (inv): ActivityItem => ({
              kind: "invoice",
              id: inv.id,
              number: inv.invoice_number,
              partyName: partyName(inv.party_id),
              amount: inv.total_amount,
              date: inv.invoice_date,
            })
          ),
          ...payments.map(
            (pay): ActivityItem => ({
              kind: "payment",
              id: pay.id,
              number: pay.payment_number,
              partyName: partyName(pay.party_id),
              amount: pay.amount,
              date: pay.payment_date,
            })
          ),
        ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
        setActivity(items);
      })
      .catch(() => {});
  }, [canSeeInvoices, canSeePayments]);

  useEffect(() => {
    loadReports();
    loadActivity();
  }, [loadReports, loadActivity]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{user ? `Welcome, ${user.full_name}` : "Dashboard"}</h1>

      {canSeeReports && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Revenue (MTD)"
              value={financial?.revenue}
              icon={<ArrowUpRight className="text-emerald-600" />}
            />
            <StatCard
              label="Expenses (MTD)"
              value={financial ? financial.expenses + financial.purchases : undefined}
              icon={<ArrowDownRight className="text-destructive" />}
            />
            <StatCard
              label="Net (MTD)"
              value={financial?.net}
              icon={<Wallet />}
              valueClassName={financial && financial.net < 0 ? "text-destructive" : "text-emerald-700"}
            />
            <StatCard
              label="Production (MTD)"
              value={production?.total_quantity}
              icon={<Factory />}
              suffix=" units"
              isMoney={false}
            />
          </div>

          {financial === null ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (
            <FinancialSummaryChart revenue={financial.revenue} expenses={financial.expenses} purchases={financial.purchases} />
          )}
        </>
      )}

      {(canSeeInvoices || canSeePayments) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity === null && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}

            {activity !== null && activity.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <FileText className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-sm text-muted-foreground">Invoices and payments will show up here.</p>
              </div>
            )}

            {activity !== null && activity.length > 0 && (
              <ul className="divide-y">
                {activity.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={item.kind === "invoice" ? "default" : "success"}>
                        {item.kind === "invoice" ? "Invoice" : "Payment"}
                      </Badge>
                      <div>
                        <Link
                          href={`/${item.kind === "invoice" ? "invoices" : "payments"}/${item.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {item.number}
                        </Link>
                        <p className="text-sm text-muted-foreground">{item.partyName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">{item.amount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {!canSeeReports && !canSeeInvoices && !canSeePayments && (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view any dashboard summaries yet.
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  suffix = "",
  isMoney = true,
  valueClassName,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  suffix?: string;
  isMoney?: boolean;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {value === undefined ? (
            <Skeleton className="mt-1 h-7 w-24" />
          ) : (
            <p className={`text-2xl font-semibold tabular-nums ${valueClassName ?? ""}`}>
              {isMoney ? value.toFixed(2) : value.toLocaleString()}
              {suffix}
            </p>
          )}
        </div>
        <div className="text-muted-foreground [&>svg]:size-5">{icon}</div>
      </CardContent>
    </Card>
  );
}
