import type { ActionPlan, Equipment, Inspection, Inspector } from '../types';

// ---------------------------------------------------------------------------
// Role-based access control.
//
// Admins have full access: read, write, delete on every record plus user
// management. Inspectors CAN read, create and update ANY inspection in the
// organization (inspeções compartilhadas), but only admins can DELETE
// inspections. For equipments and action plans, inspectors may only modify
// records they own (`createdBy` / `userId` matches their id). Records with no
// ownership stamp are treated as admin-only for ownership-based operations.
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
  _e: Pick<Equipment, 'createdBy'>,
): boolean {
  void _e;
  return isAdmin(user);
}

export function canDeleteInspection(
  user: Inspector | null,
  _i: Pick<Inspection, 'userId'>,
): boolean {
  void _i;
  // DELETE é ADMIN ONLY: inspetor pode ver/editar, NÃO excluir inspeções.
  return isAdmin(user);
}

// Inspeções compartilhadas: qualquer admin ou inspetor pode visualizar.
export function canViewInspection(user: Inspector | null): boolean {
  return user?.role === 'admin' || user?.role === 'inspector';
}

// Inspeções compartilhadas: qualquer admin ou inspetor pode editar qualquer
// inspeção — NÃO existe mais vínculo de ownership para edição.
export function canEditInspection(
  user: Inspector | null,
  _i: Pick<Inspection, 'userId'>,
): boolean {
  void _i;
  return canViewInspection(user);
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
