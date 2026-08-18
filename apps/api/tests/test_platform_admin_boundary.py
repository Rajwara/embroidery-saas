"""
Regression guard for the support-access decision (project_support_access_model
memory / scope doc §24): platform admins get zero read access to tenant
business data, with no grant/impersonation mechanism. That's enforced today
by is_platform_admin being checked in exactly one place -- routers/platform.py
-- and require_permission() (which gates every business router) deliberately
not treating it as a bypass the way is_super_admin is.

This is a static source scan, not an integration test: it has no DB/auth
fixtures to spin up, so it can't verify the boundary behaves correctly at
runtime. What it catches is the boundary silently eroding -- someone adding
an `if user.is_platform_admin` bypass to a business router, or wiring it into
require_permission -- which is the realistic way this decision would regress.
"""

import ast
from pathlib import Path

ROUTERS_DIR = Path(__file__).resolve().parent.parent / "app" / "routers"
DEPENDENCIES_FILE = Path(__file__).resolve().parent.parent / "app" / "dependencies.py"

# The only routers allowed to reference is_platform_admin:
# - platform.py: the entire point of this router (get_current_platform_admin
#   gates every route in it).
# - auth.py: echoes user.is_platform_admin into the login/token response so
#   the frontend can route a platform admin to /platform -- reusing the
#   existing User/JWT stack (project_platform_admin_architecture memory), not
#   a business-data read.
# Every other router is tenant-scoped business data and must have no
# knowledge of this flag at all.
ALLOWED_ROUTERS = {"platform.py", "auth.py"}


def _references_name(source: str, name: str) -> bool:
    tree = ast.parse(source)
    return any(isinstance(node, ast.Name) and node.id == name for node in ast.walk(tree)) or any(
        isinstance(node, ast.Attribute) and node.attr == name for node in ast.walk(tree)
    )


def test_only_platform_router_references_is_platform_admin():
    offending = []
    for path in sorted(ROUTERS_DIR.glob("*.py")):
        if path.name in ALLOWED_ROUTERS or path.name == "__init__.py":
            continue
        if _references_name(path.read_text(encoding="utf-8"), "is_platform_admin"):
            offending.append(path.name)

    assert offending == [], (
        "is_platform_admin must not be referenced outside routers/platform.py -- "
        f"found it in: {offending}. If a business router needs to special-case "
        "platform admins, that reopens the 'zero access to tenant business data' "
        "decision and needs to go through that discussion explicitly, not land "
        "as an incidental check."
    )


def test_require_permission_does_not_bypass_on_is_platform_admin():
    source = DEPENDENCIES_FILE.read_text(encoding="utf-8")
    tree = ast.parse(source)
    require_permission_fn = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef) and node.name == "require_permission"
    )
    # Skip the docstring (it explains in prose that is_platform_admin does
    # NOT bypass, which would otherwise false-positive a plain substring/name
    # scan) and check only the actual logic for a reference to the flag.
    body = require_permission_fn.body
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
        body = body[1:]
    logic_source = "\n".join(
        ast.get_source_segment(source, stmt) or "" for stmt in body
    )

    assert "is_platform_admin" not in logic_source, (
        "require_permission() gates every business router's permission checks. "
        "It must only let is_super_admin (an in-tenant role) bypass -- "
        "is_platform_admin bypassing here would grant cross-tenant business-data "
        "access, which contradicts the support-access decision."
    )
