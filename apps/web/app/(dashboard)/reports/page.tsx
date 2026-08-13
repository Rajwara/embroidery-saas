import Link from "next/link";

const REPORTS = [
  {
    href: "/reports/machines",
    title: "Machine Cost Report",
    description: "Overhead cost split equally across active machines, with cost per unit produced.",
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
