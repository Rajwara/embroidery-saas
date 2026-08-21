"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";

import {
  AlertCircle,
  Banknote,
  Check,
  Clock,
  Loader2,
  Package,
  Pencil,
  Printer,
  Receipt,
  Wallet,
  X,
} from "lucide-react";

import {
  getInvoiceBalances,
  getParty,
  getPartyLedger,
  listInvoices,
  listLots,
  listPayments,
  updateInvoice,
  updatePayment,
} from "@embroidery/types";
import type {
  InvoiceBalanceOut,
  InvoiceOut,
  LedgerEntryOut,
  LotOut,
  PartyDocsOut,
  PaymentOut,
} from "@embroidery/types";

import { ApiError, fetchPdfBlob } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { StatusBadge as LotStatusBadge } from "../../lots/_components/StatusBadge";

const ENTRY_TYPE_LABELS: Record<string, string> = {
  opening_balance: "Opening Balance",
  invoice: "Invoice",
  payment: "Payment",
};

const ENTRY_TYPE_BADGE_VARIANT: Record<string, "default" | "secondary" | "success"> = {
  opening_balance: "secondary",
  invoice: "default",
  payment: "success",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "other";

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export default function PartyDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { hasPermission } = useAuth();
  const canSeeMoney = hasPermission("parties.see_money");
  const canViewLots = hasPermission("lots.view");
  const canEditInvoices = hasPermission("invoices.edit");
  const canEditPayments = hasPermission("payments.edit");

  const [party, setParty] = useState<PartyDocsOut | null>(null);
  const [ledger, setLedger] = useState<LedgerEntryOut[] | null>(null);
  const [lots, setLots] = useState<LotOut[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceOut[] | null>(null);
  const [balances, setBalances] = useState<InvoiceBalanceOut[] | null>(null);
  const [payments, setPayments] = useState<PaymentOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [promisedDraft, setPromisedDraft] = useState<{ date: string; method: PaymentMethod }>({
    date: "",
    method: "cash",
  });
  const [savingPromised, setSavingPromised] = useState(false);
  const [promisedError, setPromisedError] = useState<string | null>(null);

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<{ date: string; method: PaymentMethod }>({
    date: "",
    method: "cash",
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setParty(null);
    setLedger(null);
    setLots(null);
    setInvoices(null);
    setBalances(null);
    setPayments(null);
    Promise.all([
      getParty(params.id),
      canSeeMoney ? getPartyLedger(params.id) : Promise.resolve(null),
      canViewLots ? listLots({ party_id: params.id, limit: 200 }) : Promise.resolve(null),
      canSeeMoney ? listInvoices({ party_id: params.id, limit: 200 }) : Promise.resolve(null),
      canSeeMoney ? getInvoiceBalances({ party_id: params.id }) : Promise.resolve(null),
      canSeeMoney ? listPayments({ party_id: params.id, limit: 200 }) : Promise.resolve(null),
    ])
      .then(([partyData, ledgerData, lotsData, invoicesData, balancesData, paymentsData]) => {
        setParty(partyData);
        setLedger(ledgerData);
        setLots(lotsData);
        setInvoices(invoicesData);
        setBalances(balancesData);
        setPayments(paymentsData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("Party not found.");
        } else {
          setError("Could not load party.");
        }
      });
  }, [params.id, canSeeMoney, canViewLots]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = async () => {
    setPrintError(null);
    setPrinting(true);
    try {
      const blob = await fetchPdfBlob(`/parties/${params.id}/ledger/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPrintError("Could not generate the statement. Please try again.");
    } finally {
      setPrinting(false);
    }
  };

  const startEditPromised = (invoice: InvoiceOut) => {
    setPromisedError(null);
    setEditingInvoiceId(invoice.id);
    setPromisedDraft({
      date: invoice.promised_payment_date ?? "",
      method: (invoice.promised_payment_method as PaymentMethod | null) ?? "cash",
    });
  };

  const cancelEditPromised = () => {
    setEditingInvoiceId(null);
    setPromisedError(null);
  };

  const savePromised = async (invoiceId: string) => {
    if (!promisedDraft.date) return;
    setSavingPromised(true);
    setPromisedError(null);
    try {
      const updated = await updateInvoice(invoiceId, {
        promised_payment_date: promisedDraft.date,
        promised_payment_method: promisedDraft.method,
      });
      setInvoices((prev) => prev?.map((inv) => (inv.id === invoiceId ? updated : inv)) ?? prev);
      setEditingInvoiceId(null);
    } catch (err) {
      setPromisedError(err instanceof ApiError ? err.detail : "Could not save. Please try again.");
    } finally {
      setSavingPromised(false);
    }
  };

  const startEditPayment = (payment: PaymentOut) => {
    setPaymentError(null);
    setEditingPaymentId(payment.id);
    setPaymentDraft({ date: payment.payment_date, method: payment.payment_method as PaymentMethod });
  };

  const cancelEditPayment = () => {
    setEditingPaymentId(null);
    setPaymentError(null);
  };

  const savePayment = async (paymentId: string) => {
    if (!paymentDraft.date) return;
    setSavingPayment(true);
    setPaymentError(null);
    try {
      const updated = await updatePayment(paymentId, {
        payment_date: paymentDraft.date,
        payment_method: paymentDraft.method,
      });
      setPayments((prev) => prev?.map((p) => (p.id === paymentId ? updated : p)) ?? prev);
      setEditingPaymentId(null);
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.detail : "Could not save. Please try again.");
    } finally {
      setSavingPayment(false);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{error}</AlertTitle>
        <AlertDescription>
          <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={load}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (party === null) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const balanceByInvoiceId = new Map((balances ?? []).map((b) => [b.invoice_id, b]));
  const totalInvoiced = (balances ?? []).reduce((sum, b) => sum + b.total_amount, 0);
  const totalReceived = (balances ?? []).reduce((sum, b) => sum + b.paid_amount, 0);
  const totalPending = (balances ?? []).reduce((sum, b) => sum + b.balance, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{party.name}</h1>
          <p className="text-sm text-muted-foreground">
            {party.contact_person ?? "—"} &middot; {party.phone ?? "—"} &middot; {party.email ?? "—"}
          </p>
          {party.address && <p className="mt-1 text-sm text-muted-foreground">{party.address}</p>}
        </div>
        {canSeeMoney && (
          <div className="text-right">
            <Button onClick={handlePrint} disabled={printing}>
              {printing ? <Loader2 className="animate-spin" /> : <Printer />}
              {printing ? "Generating..." : "Print statement"}
            </Button>
            {printError && <p className="mt-1 text-xs text-destructive">{printError}</p>}
          </div>
        )}
      </div>

      {canSeeMoney && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Cash flow</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total invoiced" value={balances === null ? undefined : totalInvoiced} icon={<Wallet />} />
            <StatCard
              label="Received"
              value={balances === null ? undefined : totalReceived}
              icon={<Banknote className="text-brand-green" />}
              valueClassName="text-brand-green-text"
            />
            <StatCard
              label="Pending"
              value={balances === null ? undefined : totalPending}
              icon={<Clock className="text-brand-yellow" />}
              valueClassName={totalPending > 0 ? "text-brand-yellow-text" : undefined}
            />
          </div>
        </section>
      )}

      {canViewLots && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Lots</h2>
          {lots === null && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {lots !== null && lots.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border py-12 text-center">
              <Package className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No lots yet</p>
              <p className="text-sm text-muted-foreground">Lots received from this party will show up here.</p>
            </div>
          )}

          {lots !== null && lots.length > 0 && (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot #</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Suit type</TableHead>
                    <TableHead className="text-right">Suits</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <Link href={`/lots/${lot.id}`} className="font-medium hover:underline">
                          {lot.lot_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lot.received_date}</TableCell>
                      <TableCell className="text-muted-foreground">{lot.suit_type}</TableCell>
                      <TableCell className="text-right tabular-nums">{lot.total_suit_count}</TableCell>
                      <TableCell>
                        <LotStatusBadge status={lot.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      {canSeeMoney && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Invoices</h2>
          {invoices === null && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {invoices !== null && invoices.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border py-12 text-center">
              <Receipt className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No invoices yet</p>
            </div>
          )}

          {invoices !== null && invoices.length > 0 && (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Promised</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const balance = balanceByInvoiceId.get(invoice.id);
                    const pending = balance ? balance.balance : undefined;
                    const isPaid = pending !== undefined && pending <= 0.005;
                    const isOverdue =
                      pending !== undefined &&
                      pending > 0.005 &&
                      !!invoice.due_date &&
                      invoice.due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
                            {invoice.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{invoice.invoice_date}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.due_date ?? "—"}
                        </TableCell>
                        <TableCell>
                          {editingInvoiceId === invoice.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={promisedDraft.date}
                                onChange={(e) => setPromisedDraft({ ...promisedDraft, date: e.target.value })}
                                className="h-7 w-[8.5rem] rounded-md border border-input bg-background px-2 text-xs"
                                autoFocus
                              />
                              <select
                                value={promisedDraft.method}
                                onChange={(e) =>
                                  setPromisedDraft({ ...promisedDraft, method: e.target.value as PaymentMethod })
                                }
                                className="h-7 rounded-md border border-input bg-background px-1 text-xs"
                              >
                                {METHOD_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                disabled={savingPromised || !promisedDraft.date}
                                onClick={() => savePromised(invoice.id)}
                              >
                                {savingPromised ? <Loader2 className="animate-spin" /> : <Check />}
                              </Button>
                              <Button size="icon-xs" variant="ghost" onClick={cancelEditPromised} disabled={savingPromised}>
                                <X />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">
                                {invoice.promised_payment_date ?? "—"}
                                {invoice.promised_payment_date && invoice.promised_payment_method && (
                                  <> &middot; {METHOD_LABELS[invoice.promised_payment_method] ?? invoice.promised_payment_method}</>
                                )}
                              </span>
                              {canEditInvoices && (
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => startEditPromised(invoice)}
                                  aria-label="Edit promised payment date and method"
                                >
                                  <Pencil />
                                </Button>
                              )}
                            </div>
                          )}
                          {editingInvoiceId === invoice.id && promisedError && (
                            <p className="mt-1 text-xs text-destructive">{promisedError}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{invoice.total_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {balance ? balance.paid_amount.toFixed(2) : <Skeleton className="ml-auto h-4 w-14" />}
                        </TableCell>
                        <TableCell className="text-right">
                          {pending === undefined ? (
                            <Skeleton className="ml-auto h-4 w-14" />
                          ) : (
                            <Badge variant={isPaid ? "success" : isOverdue ? "destructive" : "warning"}>
                              {pending.toFixed(2)}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      {canSeeMoney && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Payments</h2>
          {payments === null && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {payments !== null && payments.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border py-12 text-center">
              <Banknote className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No payments yet</p>
            </div>
          )}

          {payments !== null && payments.length > 0 && (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Date received</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <Link href={`/payments/${payment.id}`} className="font-medium hover:underline">
                          {payment.payment_number}
                        </Link>
                      </TableCell>
                      {editingPaymentId === payment.id ? (
                        <>
                          <TableCell colSpan={2}>
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={paymentDraft.date}
                                onChange={(e) => setPaymentDraft({ ...paymentDraft, date: e.target.value })}
                                className="h-7 w-[8.5rem] rounded-md border border-input bg-background px-2 text-xs"
                                autoFocus
                              />
                              <select
                                value={paymentDraft.method}
                                onChange={(e) =>
                                  setPaymentDraft({ ...paymentDraft, method: e.target.value as PaymentMethod })
                                }
                                className="h-7 rounded-md border border-input bg-background px-1 text-xs"
                              >
                                {METHOD_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                disabled={savingPayment || !paymentDraft.date}
                                onClick={() => savePayment(payment.id)}
                              >
                                {savingPayment ? <Loader2 className="animate-spin" /> : <Check />}
                              </Button>
                              <Button size="icon-xs" variant="ghost" onClick={cancelEditPayment} disabled={savingPayment}>
                                <X />
                              </Button>
                            </div>
                            {paymentError && <p className="mt-1 text-xs text-destructive">{paymentError}</p>}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-muted-foreground">{payment.payment_date}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary">
                                {METHOD_LABELS[payment.payment_method] ?? payment.payment_method}
                              </Badge>
                              {canEditPayments && (
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => startEditPayment(payment)}
                                  aria-label="Edit payment date and method"
                                >
                                  <Pencil />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right tabular-nums">{payment.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      {canSeeMoney && (
        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {ledger === null && <LedgerSkeleton />}

            {ledger !== null && ledger.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Receipt className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">No transactions yet</p>
                <p className="text-sm text-muted-foreground">Invoices and payments will show up here.</p>
              </div>
            )}

            {ledger !== null && ledger.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Billed Amount</TableHead>
                    <TableHead className="text-right">Received Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{entry.entry_date}</TableCell>
                      <TableCell>
                        <Badge variant={ENTRY_TYPE_BADGE_VARIANT[entry.entry_type] ?? "secondary"}>
                          {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.reference}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.debit ? entry.debit.toFixed(2) : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.credit ? entry.credit.toFixed(2) : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {entry.balance.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueClassName,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
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
            <p className={`text-2xl font-semibold tabular-nums ${valueClassName ?? ""}`}>{value.toFixed(2)}</p>
          )}
        </div>
        <div className="text-muted-foreground [&>svg]:size-5">{icon}</div>
      </CardContent>
    </Card>
  );
}

function LedgerSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
