import type { ActionPlan, Equipment, Inspection, Inspector } from '../types';

// ---------------------------------------------------------------------------
// Role-based access control.
//
// Admins have full access: read, write, delete on every record plus user
// management. Inspectors can read everything but may only modify records
// they own (`createdBy` / `userId` matches their id). Records with no
// ownership stamp (legacy data) are treated as admin-only.
// ---------------------------------------------------------------------------

export function isAdmin(user: Inspector | null): boolean {
  return user?.role === 'admin';
}

export function canManageUsers(user: Inspector | null): boolean {
  return isAdmin(user);
}

export function canEditEquipment(
  user: Inspector | null,
  equipment: Pick<Equipment, 'createdBy'>,
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return equipment.createdBy === user.id;
}

export function canDeleteEquipment(
  user: Inspector | null,
  equipment: Pick<Equipment, 'createdBy'>,
): boolean {
  return canEditEquipment(user, equipment);
}

export function canEditInspection(
  user: Inspector | null,
  inspection: Pick<Inspection, 'userId'>,
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return inspection.userId === user.id;
}

export function canEditActionPlan(
  user: Inspector | null,
  plan: Pick<ActionPlan, 'userId'>,
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return plan.userId === user.id;
}

export function canDeleteActionPlan(
  user: Inspector | null,
  plan: Pick<ActionPlan, 'userId'>,
): boolean {
  return canEditActionPlan(user, plan);
}
