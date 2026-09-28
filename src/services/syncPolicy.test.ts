import { describe, expect, it } from 'vitest';
import { canStartOperationalSync, shouldRequestSyncAfterPauseDisabled } from './syncPolicy';

const active = {
  isOnline: true,
  authenticated: true,
  syncEnabled: true,
  syncPaused: false,
  networkAvailable: true,
  syncInProgress: false,
};

describe('política de sincronização operacional', () => {
  it('permite auto-sync online quando a pausa está desativada', () => {
    expect(canStartOperationalSync(active)).toBe(true);
  });

  it('bloqueia auto-sync quando a pausa está ativada', () => {
    expect(canStartOperationalSync({ ...active, syncPaused: true })).toBe(false);
  });

  it('distingue offline real da pausa manual', () => {
    expect(canStartOperationalSync({ ...active, isOnline: false })).toBe(false);
    expect(canStartOperationalSync({ ...active, syncPaused: true })).toBe(false);
  });

  it('solicita uma sincronização ao desativar a pausa online', () => {
    expect(shouldRequestSyncAfterPauseDisabled({
      wasPaused: true,
      isPaused: false,
      isOnline: true,
      authenticated: true,
    })).toBe(true);
  });

  it('não solicita sincronização ao desativar a pausa offline', () => {
    expect(shouldRequestSyncAfterPauseDisabled({
      wasPaused: true,
      isPaused: false,
      isOnline: false,
      authenticated: true,
    })).toBe(false);
  });

  it('não inicia sync concorrente', () => {
    expect(canStartOperationalSync({ ...active, syncInProgress: true })).toBe(false);
  });
});
