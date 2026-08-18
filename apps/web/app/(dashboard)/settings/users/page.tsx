"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

import { AlertCircle } from "lucide-react";

import { assignRole, inviteUser, listRoles, listUsers, unassignRole, updateUser } from "@embroidery/types";
import type { RoleOut, UserOut } from "@embroidery/types";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{error}</AlertTitle>
        <AlertDescription>
          <Button variant="link" size="sm" className="h-auto p-0 text-destructive" onClick={load}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (users === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        {hasPermission("users.create") && (
          <Button onClick={() => setShowInvite((v) => !v)}>{showInvite ? "Cancel" : "Invite User"}</Button>
        )}
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="max-w-md space-y-4 rounded-xl border bg-card p-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Roles</label>
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

          <p className="text-xs text-muted-foreground">
            An email with a link to set their password will be sent to this address.
          </p>

          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={inviting || !email || !fullName}>
              {inviting ? "Sending invite..." : "Send invite"}
            </Button>
          </div>
        </form>
      )}

      {roleActionError && <p className="text-sm text-destructive">{roleActionError}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <Fragment key={u.id}>
                <TableRow>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.is_super_admin ? "Super Admin" : u.roles.map((r) => r.name).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "success" : "secondary"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {hasPermission("roles.edit") && !u.is_super_admin && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 mr-3"
                        onClick={() => setManagingRolesUserId(managingRolesUserId === u.id ? null : u.id)}
                      >
                        Roles
                      </Button>
                    )}
                    {hasPermission("users.edit") && (
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => toggleActive(u)}>
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {managingRolesUserId === u.id && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={5}>
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
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
