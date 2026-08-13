export interface NavItem {
  label: string;
  href: string;
  requiredPermission: string | null;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", requiredPermission: null },
  { label: "Parties", href: "/parties", requiredPermission: "parties.view" },
  { label: "Suppliers", href: "/suppliers", requiredPermission: "suppliers.view" },
  { label: "Lots", href: "/lots", requiredPermission: "lots.view" },
  { label: "Designs", href: "/designs", requiredPermission: "designs.view" },
  { label: "Jobs", href: "/jobs", requiredPermission: "production_jobs.view" },
  { label: "Daily Shift", href: "/shift", requiredPermission: "production_entries.create" },
  { label: "Approvals", href: "/approvals", requiredPermission: "production_entries.approve" },
  { label: "Machine Performance", href: "/performance/machines", requiredPermission: "production_entries.view" },
  { label: "Employee Performance", href: "/performance/employees", requiredPermission: "production_entries.view" },
  { label: "Deliveries", href: "/deliveries", requiredPermission: "delivery_challans.view" },
  { label: "Invoices", href: "/invoices", requiredPermission: "invoices.view" },
  { label: "Payments", href: "/payments", requiredPermission: "payments.view" },
  { label: "Purchases", href: "/purchases", requiredPermission: "purchases.view" },
  { label: "Expenses", href: "/expenses", requiredPermission: "expenses.view" },
  { label: "Branches", href: "/branches", requiredPermission: "branches.view" },
  { label: "Machines", href: "/machines", requiredPermission: "machines.view" },
  { label: "Employees", href: "/employees", requiredPermission: "employees.view" },
  { label: "Company Setup", href: "/onboarding", requiredPermission: "factories.edit" },
];
