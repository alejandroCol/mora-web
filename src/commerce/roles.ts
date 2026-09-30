export const STAFF_ROLES = ["founder", "superadmin", "vendedor"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffPermission =
  | "sales"
  | "sales_manual"
  | "stats"
  | "inventory"
  | "gallery"
  | "shipping"
  | "team"
  | "whatsapp"
  | "growth"
  | "budget";

const SUPERADMIN_PERMISSIONS: StaffPermission[] = [
  "sales",
  "sales_manual",
  "stats",
  "inventory",
  "gallery",
  "shipping",
  "team",
  "whatsapp",
  "growth",
];

export const ROLE_LABEL: Record<StaffRole, string> = {
  founder: "Founder",
  superadmin: "Super admin",
  vendedor: "Vendedor",
};

export const ROLE_BLURB: Record<StaffRole, string> = {
  founder: "Operación completa más el presupuesto de la casa.",
  superadmin: "Equipo, inventario, galería, envíos, campañas, WhatsApp y ventas.",
  vendedor: "WhatsApp, ventas manuales y despacho de pedidos.",
};

const ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  founder: [...SUPERADMIN_PERMISSIONS, "budget"],
  superadmin: SUPERADMIN_PERMISSIONS,
  vendedor: ["sales", "sales_manual", "whatsapp"],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return STAFF_ROLES.includes(value as StaffRole);
}

export function isPrivilegedRole(role: StaffRole) {
  return role === "founder" || role === "superadmin";
}

export function roleHasPermission(role: StaffRole, permission: StaffPermission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: StaffRole) {
  return ROLE_PERMISSIONS[role];
}

export function canAssignRole(
  actor: StaffRole,
  target: StaffRole,
  hasActiveFounder: boolean,
) {
  if (actor === "founder") return true;
  if (actor !== "superadmin") return false;
  if (target === "founder") return !hasActiveFounder;
  return target === "superadmin" || target === "vendedor";
}

export type StaffRecord = {
  uid: string;
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  createdAt: number;
  createdBy?: string;
  updatedAt?: number;
};
