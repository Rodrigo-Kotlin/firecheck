import { describe, expect, it } from 'vitest';
import { canManageUsers, isAdmin } from './permissions';

describe('permissões administrativas', () => {
  const inspector = { id: 'i-1', nome: 'Inspetor', cargo: 'Técnico', role: 'inspector' as const };
  const admin = { id: 'a-1', nome: 'Admin', cargo: 'Gestor', role: 'admin' as const };

  it('permite gestão de usuários somente para admin', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(canManageUsers(admin)).toBe(true);
    expect(isAdmin(inspector)).toBe(false);
    expect(canManageUsers(inspector)).toBe(false);
    expect(canManageUsers(null)).toBe(false);
  });
});
