/**
 * Paginated cloud reads - helpers used by every fetch (Prompt 20, item [A]).
 *
 * Problem: on large tables, a single `.select('*')` without pagination
 * exceeds PostgREST's max rows and PostgREST silently truncates the
 * response. The sync then treats that truncated snapshot as absolute
 * truth, which can silently drop rows and triggers orphan-reconciliation
 * based on partial data.
 *
 * Solution: iterate any cloud read in deterministic slices:
 *   - fixed PAGE_SIZE + stable order by a UNIQUE key (`id`);
 *   - each slice uses `.range(from, to)` (deterministic on a stable order);
 *   - `complete === true` only when the LAST slice returned fewer rows than
 *     PAGE_SIZE (i.e. we exhausted every row);
 *   - any slice error -> abort with `complete: false` (NEVER reconcile
 *     orphans from a truncated snapshot).
 *
 * Callers (fetch services / sync pulls) must propagate `complete` all the
 * way up to the reconciliation step and skip orphan-sweep when it is false.
 */

/** Fixed page size used by every paginated cloud read. */
export const PULL_PAGE_SIZE = 500;

/** Normalized per-page error shape (services accept it loosely). */
export interface PageFetchError {
  message?: string;
  code?: string;
}

/** Result of a single page (the minimal shape builders delegate to). */
export interface PageQueryResult<T> {
  data: T[] | null;
  error: PageFetchError | null;
}

/** A single-page query given a `from,to` range. */
export type PageQuery<T> = (
  from: number,
  to: number,
) => Promise<PageQueryResult<T>>;

/** Aggregated result across all pages. */
export interface AllPagesResult<T> {
  rows: T[];
  /** `true` = full snapshot (last page < PAGE_SIZE). `false` = truncated
   *  (network/page error) - do NOT reconcile orphans. */
  complete: boolean;
  /** Error from the failing page (null when `complete` is true). */
  error: PageFetchError | null;
}

/**
 * Iterate a query in deterministic slices.
 *
 *   - `rows`: all rows across successful pages;
 *   - `complete: true` ONLY when the last slice returned fewer rows than
 *     PAGE_SIZE (we exhausted the table);
 *   - `error` on any slice -> abort, `complete: false`.
 *
 * Page size semantics are intrinsic to PostgREST: a `.range()` beyond the
 * last row returns an EMPTY list, so "short page" is the correct EOF marker.
 */
export async function fetchAllPages<T>(
  query: PageQuery<T>,
  pageSize: number = PULL_PAGE_SIZE,
): Promise<AllPagesResult<T>> {
  const rows: T[] = [];
  let from = 0;
  let complete = false;
  let lastError: PageFetchError | null = null;

  // Safety cap against pathological infinite loops on absurdly large tables.
  const MAX_PAGES = 2000;

  for (let page = 0; page < MAX_PAGES; page++) {
    const to = from + pageSize - 1;
    const { data, error } = await query(from, to);

    if (error) {
      // Page failed -> snapshot is truncated -> NOT complete.
      lastError = error;
      complete = false;
      break;
    }

    const chunk = (data as T[] | null) ?? [];
    rows.push(...chunk);

    if (chunk.length < pageSize) {
      // Last real page: full snapshot.
      complete = true;
      break;
    }

    from += pageSize;
  }

  return { rows, complete, error: lastError };
}
