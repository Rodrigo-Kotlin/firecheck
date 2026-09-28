import { describe, expect, it } from 'vitest';
import type { AppState } from './index';
import { partializeAppState } from './persistence';

describe('persistência do estado da aplicação', () => {
  it('não persiste a lista administrativa de usuários', () => {
    const persisted = partializeAppState({
      config: { empresa: 'Efetiva SST', unidade: 'Operação', offlineMode: false, notificationsEnabled: true },
      users: [{ id: 'u-1', email: 'admin@example.com' }],
    } as AppState);

    expect(persisted).toEqual({
      config: { empresa: 'Efetiva SST', unidade: 'Operação', offlineMode: false, notificationsEnabled: true },
    });
    expect('users' in persisted).toBe(false);
  });
});
