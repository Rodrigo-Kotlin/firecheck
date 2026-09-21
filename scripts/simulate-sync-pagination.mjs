import assert from 'node:assert/strict';

const PULL_PAGE_SIZE = 500;
const MAX_PAGES = 2000;

async function fetchAllPages(query, pageSize = PULL_PAGE_SIZE) {
  const rows = [];
  let complete = false;
  let error = null;
  let from = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error: pageError } = await query(from, from + pageSize - 1, page);
    if (pageError) {
      error = pageError;
      break;
    }
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < pageSize) {
      complete = true;
      break;
    }
    from += pageSize;
  }
  return { rows, complete, error };
}

async function run() {
  for (const count of [0, 1, 499, 500, 501, 999, 1000, 1001, 1499, 1500, 1501]) {
    const remote = Array.from({ length: count }, (_, id) => id + 1);
    const result = await fetchAllPages(async (from, to) => ({
      data: remote.slice(from, to + 1),
      error: null,
    }));
    assert.equal(result.complete, true, `count=${count} should be complete`);
    assert.deepEqual(result.rows, remote, `count=${count} must preserve order and IDs`);
    assert.equal(new Set(result.rows).size, count, `count=${count} must not duplicate IDs`);
    console.log(`PASS count=${count}`);
  }

  for (const failurePage of [0, 1, 2, 3]) {
    const remote = Array.from({ length: 1501 }, (_, id) => id + 1);
    const result = await fetchAllPages(async (from, to, page) => {
      if (page === failurePage) return { data: null, error: { message: 'simulated failure' } };
      return { data: remote.slice(from, to + 1), error: null };
    });
    assert.equal(result.complete, false, `failure page ${failurePage} cannot be complete`);
    assert.ok(result.error, `failure page ${failurePage} must retain the error`);
    assert.deepEqual(result.rows, remote.slice(0, failurePage * PULL_PAGE_SIZE));
    console.log(`PASS failure-page=${failurePage}`);
  }

  const partial = await fetchAllPages(async (from, to, page) => {
    if (page === 1) return { data: null, error: { message: 'page 2 failed' } };
    return { data: Array.from({ length: 1000 }, (_, id) => id + 1).slice(from, to + 1), error: null };
  });
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.rows, Array.from({ length: 500 }, (_, id) => id + 1));
  assert.deepEqual(
    Array.from({ length: 1000 }, (_, id) => id + 1).filter((id) => !partial.rows.includes(id)),
    Array.from({ length: 500 }, (_, id) => id + 501),
  );
  console.log('PASS partial snapshot does not become full');

  const capped = await fetchAllPages(async (from, to) => ({
    data: Array.from({ length: to - from + 1 }, (_, offset) => from + offset),
    error: null,
  }), 1);
  assert.equal(capped.complete, false, 'MAX_PAGES must stop an endless full-page stream');
  assert.equal(capped.rows.length, MAX_PAGES);
  console.log(`PASS MAX_PAGES=${MAX_PAGES}`);

  console.log('Pagination simulation: ALL PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
