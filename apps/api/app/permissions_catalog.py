"""
Single source of truth for the permission catalog and starter role
templates. Imported by both the RLS/seed-data migration (which bulk-inserts
PERMISSION_CATALOG into the permissions table) and app/seed.py (which calls
create_role_templates_for_tenant), so the two never drift out of sync.

Code format: "<module>.<action>". Not every module has every action --
"approve" is entirely absent (no Phase 1 entity has an approval workflow
yet) and "see_money" only applies where a table currently carries money
(parties/suppliers' opening_balance).
"""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.models import Permission, Role

PERMISSION_CATALOG: list[tuple[str, str]] = [
    ("parties.view", "View parties"),
    ("parties.create", "Create parties"),
    ("parties.edit", "Edit parties"),
    ("parties.see_money", "View party balances"),
    ("parties.export", "Export party data"),
    ("suppliers.view", "View suppliers"),
    ("suppliers.create", "Create suppliers"),
    ("suppliers.edit", "Edit suppliers"),
    ("suppliers.see_money", "View supplier balances"),
    ("suppliers.export", "Export supplier data"),
    ("machines.view", "View machines"),
    ("machines.create", "Create machines"),
    ("machines.edit", "Edit machines"),
    ("machines.export", "Export machine data"),
    ("employees.view", "View employees"),
    ("employees.create", "Create employees"),
    ("employees.edit", "Edit employees"),
    ("employees.export", "Export employee data"),
    ("factories.view", "View company profile"),
    ("factories.edit", "Edit company profile"),
    ("factories.export", "Export company profile data"),
    ("branches.view", "View branches"),
    ("branches.create", "Create branches"),
    ("branches.edit", "Edit branches"),
    ("branches.export", "Export branch data"),
    ("users.view", "View users"),
    ("users.create", "Create users"),
    ("users.edit", "Edit users"),
    ("users.export", "Export user data"),
    ("roles.view", "View roles and permissions"),
    ("roles.create", "Create roles"),
    ("roles.edit", "Edit roles"),
    ("lots.view", "View lots"),
    ("lots.create", "Create lots"),
    ("lots.edit", "Edit lots"),
    ("lots.export", "Export lot data"),
    ("designs.view", "View designs"),
    ("designs.create", "Create designs"),
    ("designs.edit", "Edit designs"),
    ("designs.export", "Export design data"),
    ("production_jobs.view", "View production jobs"),
    ("production_jobs.create", "Create production jobs"),
    ("production_jobs.edit", "Edit production jobs"),
    ("production_jobs.export", "Export production job data"),
    ("production_entries.view", "View machine production entries"),
    ("production_entries.create", "Create machine production entries"),
    ("production_entries.approve", "Approve or reject machine production entries"),
    ("production_entries.export", "Export machine production entry data"),
    ("delivery_challans.view", "View delivery challans"),
    ("delivery_challans.create", "Create delivery challans"),
    ("delivery_challans.export", "Export delivery challan data"),
    ("invoices.view", "View invoices"),
    ("invoices.create", "Create invoices"),
    ("invoices.export", "Export invoice data"),
    ("payments.view", "View payments"),
    ("payments.create", "Create payments"),
    ("payments.export", "Export payment data"),
    ("purchases.view", "View purchases"),
    ("purchases.create", "Create purchases"),
    ("purchases.export", "Export purchase data"),
    ("expenses.view", "View expenses"),
    ("expenses.create", "Create expenses"),
    ("expenses.export", "Export expense data"),
    ("inventory.view", "View inventory"),
    ("inventory.create", "Create inventory items and stock transactions"),
    ("inventory.edit", "Edit inventory items"),
    ("inventory.export", "Export inventory data"),
    ("payroll.view", "View payroll"),
    ("payroll.create", "Create payroll runs, bonuses, deductions, advances"),
    ("payroll.approve", "Approve payroll runs"),
    ("payroll.export", "Export payroll data"),
]

ROLE_TEMPLATES: list[dict] = [
    {
        "name": "Factory Manager",
        "permissions": [
            "parties.view", "parties.create", "parties.edit", "parties.see_money", "parties.export",
            "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.see_money", "suppliers.export",
            "machines.view", "machines.create", "machines.edit", "machines.export",
            "employees.view", "employees.create", "employees.edit", "employees.export",
            "factories.view", "factories.edit", "factories.export",
            "branches.view", "branches.create", "branches.edit", "branches.export",
            "users.view", "users.export",
            "lots.view", "lots.create", "lots.edit", "lots.export",
            "designs.view", "designs.create", "designs.edit", "designs.export",
            "production_jobs.view", "production_jobs.create", "production_jobs.edit", "production_jobs.export",
            "production_entries.view", "production_entries.create", "production_entries.approve",
            "production_entries.export",
            "delivery_challans.view", "delivery_challans.create", "delivery_challans.export",
            "invoices.view", "invoices.create", "invoices.export",
            "payments.view", "payments.create", "payments.export",
            "purchases.view", "purchases.create", "purchases.export",
            "expenses.view", "expenses.create", "expenses.export",
            "inventory.view", "inventory.create", "inventory.edit", "inventory.export",
            "payroll.view", "payroll.create", "payroll.approve", "payroll.export",
        ],
    },
    {
        "name": "Accountant",
        "permissions": [
            "parties.view", "parties.see_money", "parties.export",
            "suppliers.view", "suppliers.see_money", "suppliers.export",
            "machines.view", "machines.export",
            "employees.view", "employees.export",
            "factories.view", "factories.export",
            "branches.view", "branches.export",
            "users.view", "users.export",
            "roles.view",
            "lots.view", "lots.export",
            "designs.view", "designs.export",
            "production_jobs.view", "production_jobs.export",
            "production_entries.view", "production_entries.export",
            "delivery_challans.view", "delivery_challans.export",
            "invoices.view", "invoices.create", "invoices.export",
            "payments.view", "payments.create", "payments.export",
            "purchases.view", "purchases.create", "purchases.export",
            "expenses.view", "expenses.create", "expenses.export",
            "inventory.view", "inventory.export",
            "payroll.view", "payroll.create", "payroll.export",
        ],
    },
    {
        "name": "Front Office",
        "permissions": [
            "parties.view", "parties.create", "parties.edit",
            "suppliers.view", "suppliers.create", "suppliers.edit",
            "branches.view",
            "lots.view", "lots.create", "lots.edit",
        ],
    },
    {
        "name": "Machine Operator",
        "permissions": [
            "machines.view", "employees.view", "lots.view", "designs.view", "production_jobs.view",
            "production_entries.view", "production_entries.create",
            "inventory.view", "inventory.create",
        ],
    },
]


def create_role_templates_for_tenant(db: Session, tenant_id, templates: Sequence[dict] = ROLE_TEMPLATES) -> list[Role]:
    """Creates the starter Role rows (is_template=True) for a newly
    provisioned tenant, with their permission sets attached. Reused by
    seed.py today and the onboarding wizard later."""
    all_permissions = {p.code: p for p in db.query(Permission).all()}

    roles = []
    for template in templates:
        role = Role(tenant_id=tenant_id, name=template["name"], is_template=True)
        role.permissions = [all_permissions[code] for code in template["permissions"]]
        db.add(role)
        roles.append(role)

    return roles
