import type { AppConfig } from '../types';
import type { AppState } from './index';

export type PersistedAppState = { config: AppConfig };

export function partializeAppState(state: AppState): PersistedAppState {
  return { config: state.config };
}
