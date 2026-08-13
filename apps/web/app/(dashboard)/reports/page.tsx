import Link from "next/link";

const REPORTS = [
  {
    href: "/reports/receivables",
    title: "Receivable Ageing",
    description: "Outstanding invoice balances by party, aged since each invoice's date.",
  },
  {
    href: "/reports/financial",
    title: "Financial Summary",
    description: "Invoiced revenue vs. expenses and purchases for the period.",
  },
  {
    href: "/reports/production",
    title: "Production Summary",
    description: "Approved production quantity for the period, by component and by lot.",
  },
  {
    href: "/reports/inventory",
    title: "Inventory Movement",
    description: "Opening stock, receipts, issues, and adjustments for the period.",
  },
  {
    href: "/reports/machines",
    title: "Machine Cost Report",
    description: "Overhead cost split equally across active machines, with cost per unit produced.",
  },
  {
    href: "/reports/scheduled",
    title: "Scheduled Reports",
    description: "Have a report emailed automatically on a weekly or monthly cadence.",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="rounded bg-white p-4 shadow hover:bg-gray-50"
          >
            <h2 className="font-medium text-gray-900">{report.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{report.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
