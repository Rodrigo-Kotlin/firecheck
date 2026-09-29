export interface SyncReport {
  pushed: number;
  pulled: number;
  deleted: number;
  errors: number;
  skipped: boolean;
  reason?: string;
  networkUnavailable: boolean;
  pushEqOk: number;
  pushInsOk: number;
  pushErrors: number;
  pullEqImported: number;
  pullEqReconciled: number;
  pullInsImported: number;
  pullInsReconciled: number;
  pullEqError: boolean;
  pullInsError: boolean;
  pullEqEmpty: boolean;
  pullInsEmpty: boolean;
  pushApOk: number;
  pushApErrors: number;
  pullApImported: number;
  pullApReconciled: number;
  pullApError: boolean;
  pullApEmpty: boolean;
  pushPhotoOk: number;
  pushPhotoErrors: number;
  pushPhotoSkipped: number;
  pullPhotoImported: number;
  pullPhotoReconciled: number;
  pullPhotoError: boolean;
  pullPhotoEmpty: boolean;
}

export interface SyncOptions {
  /** Skip the cloud→local pull phase (push only). */
  pushOnly?: boolean;
  /** Skip the local→cloud push phase (pull only). */
  pullOnly?: boolean;
  /** Current user ID to stamp ownership on records that lack it. */
  userId?: string;
}

export interface PullResult {
  imported: number;
  reconciled: number;
  error: boolean;
  /** true when the Supabase returned a valid empty response. */
  empty: boolean;
  /** Proven unreachable network error. */
  network?: boolean;
  /** True only when the pull is a complete remote snapshot. */
  complete: boolean;
}
