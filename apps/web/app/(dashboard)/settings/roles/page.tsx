"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createRole, listPermissions, listRoles, updateRole } from "@embroidery/types";
import type { PermissionOut, RoleOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function groupByModule(permissions: PermissionOut[]): [string, PermissionOut[]][] {
  const groups = new Map<string, PermissionOut[]>();
  for (const permission of permissions) {
    const moduleName = permission.code.split(".")[0];
    if (!groups.has(moduleName)) groups.set(moduleName, []);
    groups.get(moduleName)!.push(permission);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function RolesSettingsPage() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleOut[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCodes, setEditCodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRoles(null);
    Promise.all([listRoles(), listPermissions()])
      .then(([rolesData, permissionsData]) => {
        setRoles(rolesData);
        setPermissions(permissionsData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view roles.");
        } else {
          setError("Could not load roles.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => groupByModule(permissions), [permissions]);

  const selectedRole = roles?.find((r) => r.id === selectedRoleId) ?? null;

  const selectRole = (role: RoleOut) => {
    setIsCreating(false);
    setSelectedRoleId(role.id);
    setEditName(role.name);
    setEditCodes(new Set(role.permissions.map((p) => p.code)));
    setSaveError(null);
  };

  const startCreate = () => {
    setIsCreating(true);
    setSelectedRoleId(null);
    setEditName("");
    setEditCodes(new Set());
    setSaveError(null);
  };

  const toggleCode = (code: string) => {
    setEditCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      if (isCreating) {
        const created = await createRole({ name: editName, permission_codes: Array.from(editCodes) });
        setIsCreating(false);
        setSelectedRoleId(created.id);
        load();
      } else if (selectedRole) {
        await updateRole(selectedRole.id, { name: editName, permission_codes: Array.from(editCodes) });
        load();
      }
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>{error}</span>
        <button onClick={load} className="font-medium underline">
          Retry
        </button>
      </div>
    );
  }

  if (roles === null) {
    return <p className="text-sm text-gray-500">Loading roles...</p>;
  }

  const showEditor = isCreating || selectedRole !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roles &amp; Permissions</h1>
        {hasPermission("roles.create") && (
          <button onClick={startCreate} className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white">
            New Role
          </button>
        )}
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-4">
        <div className="space-y-1 rounded bg-white p-2 shadow">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => selectRole(role)}
              className={`block w-full rounded px-3 py-2 text-left text-sm ${
                selectedRoleId === role.id ? "bg-gray-900 text-white" : "hover:bg-gray-100"
              }`}
            >
              {role.name}
              {role.is_template && (
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">template</span>
              )}
            </button>
          ))}
          {roles.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">No roles yet.</p>}
        </div>

        <div>
          {!showEditor && <p className="text-sm text-gray-500">Select a role, or create a new one.</p>}

          {showEditor && (
            <div className="space-y-4 rounded bg-white p-6 shadow">
              <div>
                <label className="block text-sm font-medium text-gray-700">Role name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {grouped.map(([module, modulePermissions]) => (
                  <div key={module} className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase text-gray-500">{module}</h3>
                    {modulePermissions.map((permission) => (
                      <label key={permission.code} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editCodes.has(permission.code)}
                          onChange={() => toggleCode(permission.code)}
                          className="mt-0.5"
                        />
                        <span>{permission.description}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>

              {saveError && <p className="text-sm text-red-600">{saveError}</p>}

              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving || !editName}
                  className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving..." : isCreating ? "Create role" : "Save changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
