export interface SyncPolicyInput {
  isOnline: boolean;
  authenticated: boolean;
  syncEnabled: boolean;
  syncPaused: boolean;
  networkAvailable: boolean;
  syncInProgress: boolean;
}

export function canStartOperationalSync(input: SyncPolicyInput): boolean {
  return (
    input.isOnline &&
    input.authenticated &&
    input.syncEnabled &&
    !input.syncPaused &&
    input.networkAvailable &&
    !input.syncInProgress
  );
}

export function shouldRequestSyncAfterPauseDisabled(input: {
  wasPaused: boolean;
  isPaused: boolean;
  isOnline: boolean;
  authenticated: boolean;
}): boolean {
  return input.wasPaused && !input.isPaused && input.isOnline && input.authenticated;
}
