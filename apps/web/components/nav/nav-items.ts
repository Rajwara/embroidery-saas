export interface NavLeaf {
  label: string;
  href: string;
  requiredPermission: string | null;
}

export interface NavGroup {
  label: string;
  children: NavLeaf[];
}

export type NavItem = NavLeaf | NavGroup;

export function isNavGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", requiredPermission: null },
  { label: "Notifications", href: "/notifications", requiredPermission: null },
  { label: "Approvals", href: "/approvals", requiredPermission: "production_entries.approve" },
  {
    label: "Parties",
    children: [
      { label: "All Parties", href: "/parties", requiredPermission: "parties.view" },
      { label: "Party Payments", href: "/payments", requiredPermission: "payments.view" },
    ],
  },
  {
    label: "Suppliers",
    children: [
      { label: "All Suppliers", href: "/suppliers", requiredPermission: "suppliers.view" },
      { label: "Supplier Payments", href: "/supplier-payments", requiredPermission: "supplier_payments.view" },
    ],
  },
  { label: "Lots", href: "/lots", requiredPermission: "lots.view" },
  { label: "Designs", href: "/designs", requiredPermission: "designs.view" },
  { label: "Jobs", href: "/jobs", requiredPermission: "production_jobs.view" },
  {
    label: "Daily Shift",
    children: [
      { label: "Daily Shift", href: "/shift", requiredPermission: "production_entries.create" },
      { label: "My Logged Entries", href: "/my-entries", requiredPermission: "production_entries.create" },
    ],
  },
  { label: "Machine Performance", href: "/performance/machines", requiredPermission: "production_entries.view" },
  { label: "Employee Performance", href: "/performance/employees", requiredPermission: "production_entries.view" },
  { label: "Deliveries", href: "/deliveries", requiredPermission: "delivery_challans.view" },
  { label: "Invoices", href: "/invoices", requiredPermission: "invoices.view" },
  { label: "Purchases", href: "/purchases", requiredPermission: "purchases.view" },
  { label: "Expenses", href: "/expenses", requiredPermission: "expenses.view" },
  { label: "Inventory", href: "/inventory", requiredPermission: "inventory.view" },
  { label: "Reorder Requests", href: "/purchase-required", requiredPermission: "inventory.view" },
  { label: "Payroll", href: "/payroll", requiredPermission: "payroll.view" },
  { label: "Reports", href: "/reports", requiredPermission: "reports.view" },
  { label: "Branches", href: "/branches", requiredPermission: "branches.view" },
  { label: "Machines", href: "/machines", requiredPermission: "machines.view" },
  { label: "Employees", href: "/employees", requiredPermission: "employees.view" },
  { label: "Company Profile", href: "/settings/company", requiredPermission: "factories.edit" },
  { label: "Notification Settings", href: "/settings/notifications", requiredPermission: "factories.edit" },
  { label: "Subscription", href: "/settings/subscription", requiredPermission: "factories.view" },
  { label: "Users", href: "/settings/users", requiredPermission: "users.view" },
  { label: "Roles & Permissions", href: "/settings/roles", requiredPermission: "roles.view" },
  { label: "Security", href: "/settings/security", requiredPermission: null },
];
