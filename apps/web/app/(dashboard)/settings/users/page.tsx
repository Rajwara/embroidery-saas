"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

import { assignRole, inviteUser, listRoles, listUsers, unassignRole, updateUser } from "@embroidery/types";
import type { RoleOut, UserOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function UsersSettingsPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserOut[] | null>(null);
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteRoleIds, setInviteRoleIds] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [managingRolesUserId, setManagingRolesUserId] = useState<string | null>(null);
  const [roleActionError, setRoleActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setUsers(null);
    Promise.all([listUsers(), listRoles()])
      .then(([usersData, rolesData]) => {
        setUsers(usersData);
        setRoles(rolesData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You don't have permission to view users.");
        } else {
          setError("Could not load users.");
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleInviteRole = (roleId: string) => {
    setInviteRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviting(true);
    try {
      await inviteUser({ email, full_name: fullName, role_ids: Array.from(inviteRoleIds) });
      setEmail("");
      setFullName("");
      setInviteRoleIds(new Set());
      setShowInvite(false);
      load();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.detail : "Something went wrong.");
    } finally {
      setInviting(false);
    }
  };

  const toggleActive = async (targetUser: UserOut) => {
    try {
      await updateUser(targetUser.id, { is_active: !targetUser.is_active });
      load();
    } catch {
      // no-op -- row stays as-is, user can retry
    }
  };

  const toggleUserRole = async (targetUser: UserOut, role: RoleOut) => {
    setRoleActionError(null);
    const hasRole = targetUser.roles.some((r) => r.id === role.id);
    try {
      if (hasRole) {
        await unassignRole(targetUser.id, role.id);
      } else {
        await assignRole(targetUser.id, role.id);
      }
      load();
    } catch (err) {
      setRoleActionError(err instanceof ApiError ? err.detail : "Could not update role.");
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

  if (users === null) {
    return <p className="text-sm text-gray-500">Loading users...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        {hasPermission("users.create") && (
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            {showInvite ? "Cancel" : "Invite User"}
          </button>
        )}
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="max-w-md space-y-4 rounded bg-white p-6 shadow">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Roles</label>
            <div className="mt-1 space-y-1">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={inviteRoleIds.has(role.id)}
                    onChange={() => toggleInviteRole(role.id)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            An email with a link to set their password will be sent to this address.
          </p>

          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={inviting || !email || !fullName}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {inviting ? "Sending invite..." : "Send invite"}
            </button>
          </div>
        </form>
      )}

      {roleActionError && <p className="text-sm text-red-600">{roleActionError}</p>}

      <table className="w-full rounded bg-white text-sm shadow">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Roles</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <Fragment key={u.id}>
              <tr className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2">{u.full_name}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  {u.is_super_admin ? "Super Admin" : u.roles.map((r) => r.name).join(", ") || "—"}
                </td>
                <td className="px-4 py-2">{u.is_active ? "Active" : "Inactive"}</td>
                <td className="px-4 py-2 text-right">
                  {hasPermission("roles.edit") && !u.is_super_admin && (
                    <button
                      onClick={() => setManagingRolesUserId(managingRolesUserId === u.id ? null : u.id)}
                      className="mr-3 text-xs font-medium text-gray-700 underline"
                    >
                      Roles
                    </button>
                  )}
                  {hasPermission("users.edit") && (
                    <button onClick={() => toggleActive(u)} className="text-xs font-medium text-gray-700 underline">
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
              {managingRolesUserId === u.id && (
                <tr className="border-b border-gray-100 bg-gray-50 last:border-0">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="flex flex-wrap gap-4">
                      {roles.map((role) => (
                        <label key={role.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={u.roles.some((r) => r.id === role.id)}
                            onChange={() => toggleUserRole(u, role)}
                          />
                          {role.name}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
