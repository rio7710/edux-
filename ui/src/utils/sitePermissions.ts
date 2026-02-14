export type SitePermissionRole =
  | "admin"
  | "operator"
  | "editor"
  | "instructor"
  | "viewer"
  | "guest";

export type PermissionOverrideValue = "O" | "X";

export type SitePermissionSnapshot = {
  menuEnabled: Record<string, boolean>;
  menuRolePermissions: Record<string, boolean>;
  permissionOverrides: Record<string, PermissionOverrideValue>;
};

export const SITE_PERMISSION_STORAGE_KEYS = {
  menuEnabled: "menu_gate_settings",
  menuRolePermissions: "menu_role_permissions",
  permissionOverrides: "permission_overrides",
} as const;

export const SITE_PERMISSIONS_UPDATED_EVENT = "sitePermissionsUpdated";

function parseBooleanRecord(raw: string | null): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "boolean"),
    ) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function parsePermissionOverrideRecord(
  raw: string | null,
): Record<string, PermissionOverrideValue> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const valid = Object.entries(parsed).filter(
      ([, value]) => value === "O" || value === "X",
    );
    return Object.fromEntries(valid) as Record<string, PermissionOverrideValue>;
  } catch {
    return {};
  }
}

export function toSitePermissionRole(
  role?: string | null,
): SitePermissionRole | null {
  if (
    role === "admin" ||
    role === "operator" ||
    role === "editor" ||
    role === "instructor" ||
    role === "viewer" ||
    role === "guest"
  ) {
    return role;
  }
  return null;
}

export function readSitePermissionSnapshot(): SitePermissionSnapshot {
  return {
    menuEnabled: parseBooleanRecord(
      localStorage.getItem(SITE_PERMISSION_STORAGE_KEYS.menuEnabled),
    ),
    menuRolePermissions: parseBooleanRecord(
      localStorage.getItem(SITE_PERMISSION_STORAGE_KEYS.menuRolePermissions),
    ),
    permissionOverrides: parsePermissionOverrideRecord(
      localStorage.getItem(SITE_PERMISSION_STORAGE_KEYS.permissionOverrides),
    ),
  };
}

export function isMenuAllowedBySnapshot(
  snapshot: SitePermissionSnapshot,
  menuKey: string,
  role: SitePermissionRole | null,
): boolean {
  const menuEnabled = snapshot.menuEnabled[menuKey] ?? true;
  if (!menuEnabled) return false;
  if (role === "admin") return true;
  if (!role) return true;
  return snapshot.menuRolePermissions[`${menuKey}:${role}`] ?? true;
}

export function isFeatureAllowedBySnapshot(
  snapshot: SitePermissionSnapshot,
  args: {
    menuKey: string;
    toolKey: string;
    role: SitePermissionRole | null;
  },
): boolean {
  const menuAllowed = isMenuAllowedBySnapshot(
    snapshot,
    args.menuKey,
    args.role,
  );
  if (!menuAllowed) return false;
  if (args.role === "admin") return true;
  if (!args.role) return true;
  const override = snapshot.permissionOverrides[`${args.toolKey}:${args.role}`];
  if (!override) return true;
  return override === "O";
}
