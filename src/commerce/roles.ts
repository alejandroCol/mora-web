export const STAFF_ROLES = ["superadmin", "vendedor"] as const;
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
  | "growth";

export const ROLE_LABEL: Record<StaffRole, string> = {
  superadmin: "Super admin",
  vendedor: "Vendedor",
};

export const ROLE_BLURB: Record<StaffRole, string> = {
  superadmin: "Equipo, inventario, galería, envíos, campañas, WhatsApp y ventas.",
  vendedor: "WhatsApp, ventas manuales y despacho de pedidos.",
};

const ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  superadmin: [
    "sales",
    "sales_manual",
    "stats",
    "inventory",
    "gallery",
    "shipping",
    "team",
    "whatsapp",
    "growth",
  ],
  vendedor: ["sales", "sales_manual", "whatsapp"],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return STAFF_ROLES.includes(value as StaffRole);
}

export function roleHasPermission(role: StaffRole, permission: StaffPermission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: StaffRole) {
  return ROLE_PERMISSIONS[role];
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
