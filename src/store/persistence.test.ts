import { describe, expect, it } from 'vitest';
import type { AppState } from './index';
import { normalizePersistedConfig, partializeAppState } from './persistence';

describe('persistência do estado da aplicação', () => {
  it('não persiste a lista administrativa de usuários', () => {
    const persisted = partializeAppState({
      config: { empresa: 'Efetiva SST', unidade: 'Operação', offlineMode: false },
      users: [{ id: 'u-1', email: 'admin@example.com' }],
    } as AppState);

    expect(persisted).toEqual({
      config: { empresa: 'Efetiva SST', unidade: 'Operação', offlineMode: false },
    });
    expect('users' in persisted).toBe(false);
  });

  it('descarta notificationsEnabled legado sem perder outras configurações', () => {
    const config = normalizePersistedConfig(
      { empresa: 'Empresa antiga', unidade: 'Unidade antiga', offlineMode: true, notificationsEnabled: true },
      { empresa: 'Padrão', unidade: '', offlineMode: false },
    );

    expect(config).toEqual({ empresa: 'Empresa antiga', unidade: 'Unidade antiga', offlineMode: true });
    expect('notificationsEnabled' in config).toBe(false);
  });
});
