export function hasPermission(
  permissions: string[],
  isSuperAdmin: boolean,
  code: string | null
): boolean {
  if (code === null) return true;
  return isSuperAdmin || permissions.includes(code);
}
