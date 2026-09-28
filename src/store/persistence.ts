import type { AppConfig } from '../types';
import type { AppState } from './index';

export type PersistedAppState = { config: AppConfig };

export function partializeAppState(state: AppState): PersistedAppState {
  return {
    config: {
      empresa: state.config.empresa,
      unidade: state.config.unidade,
      offlineMode: state.config.offlineMode,
    },
  };
}

export function normalizePersistedConfig(
  value: unknown,
  fallback: AppConfig,
): AppConfig {
  const config = value && typeof value === 'object' ? value as Partial<AppConfig> : {};
  return {
    empresa: typeof config.empresa === 'string' ? config.empresa : fallback.empresa,
    unidade: typeof config.unidade === 'string' ? config.unidade : fallback.unidade,
    offlineMode: typeof config.offlineMode === 'boolean' ? config.offlineMode : fallback.offlineMode,
  };
}
