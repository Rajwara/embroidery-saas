export interface StepConfig {
  key: string;
  label: string;
}

export const STEPS: StepConfig[] = [
  { key: "company", label: "Company" },
  { key: "branches", label: "Branches" },
  { key: "machines", label: "Machines" },
  { key: "employees", label: "Employees" },
  { key: "clients", label: "Clients" },
  { key: "suppliers", label: "Suppliers" },
];
