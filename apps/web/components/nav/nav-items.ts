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
  { label: "Branches", href: "/branches", requiredPermission: "branches.view" },
  { label: "Machines", href: "/machines", requiredPermission: "machines.view" },
  { label: "Employees", href: "/employees", requiredPermission: "employees.view" },
  { label: "Company Setup", href: "/onboarding", requiredPermission: "factories.edit" },
];
