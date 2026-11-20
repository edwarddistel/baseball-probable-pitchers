'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/schedule.json');
const { buildScheduleUrl, fetchSchedule, MlbApiError } = require('../src/mlb-api');
const { getProbablePitchers } = require('../src');

const ok = (body = fixture) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

test('URL includes validated date, sport, and requested hydration', () => {
  const url = buildScheduleUrl('2026-07-04');
  assert.equal(url.hostname, 'statsapi.mlb.com');
  assert.equal(url.pathname, '/api/v1/schedule');
  assert.equal(url.searchParams.get('sportId'), '1');
  assert.equal(url.searchParams.get('date'), '2026-07-04');
  assert.equal(url.searchParams.get('hydrate'), 'probablePitcher,team');
  assert.throws(() => buildScheduleUrl('junk&sportId=9'), TypeError);
});

test('fetchSchedule returns an MLB schedule using native fetch and a real AbortSignal', async () => {
  const seen = [];
  const result = await fetchSchedule('2026-07-04', {
    fetchImpl: async (url, options) => {
      seen.push({ url: String(url), options });
      return ok();
    },
    retries: 0,
  });
  assert.deepEqual(result, fixture);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].options.headers.accept, 'application/json');
  assert.ok(seen[0].options.signal instanceof AbortSignal);
});

test('fetchSchedule retries transient 429/5xx errors with backoff', async () => {
  let calls = 0;
  const sleeps = [];
  const result = await fetchSchedule('2026-07-04', {
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return new Response('{}', { status: 429 });
      if (calls === 2) return new Response('{}', { status: 503 });
      return ok({ dates: [] });
    },
    retries: 2,
    sleep: async (ms) => { sleeps.push(ms); },
  });
  assert.deepEqual(result, { dates: [] });
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [250, 500]);
});

test('non-retryable HTTP errors are immediately surfaced', async () => {
  let calls = 0;
  await assert.rejects(fetchSchedule('2026-07-04', {
    fetchImpl: async () => { calls += 1; return new Response('Not found', { status: 404 }); },
  }), (error) => error instanceof MlbApiError && error.status === 404);
  assert.equal(calls, 1);
});

test('invalid JSON and invalid schedule structure are explicit failures', async () => {
  await assert.rejects(fetchSchedule('2026-07-04', {
    fetchImpl: async () => new Response('{ invalid', { status: 200 }),
  }), /invalid JSON/);
  await assert.rejects(fetchSchedule('2026-07-04', {
    fetchImpl: async () => ok({ unexpected: true }),
  }), /unexpected schedule response/);
});

test('network exceptions exhaust the configured retries', async () => {
  let calls = 0;
  await assert.rejects(fetchSchedule('2026-07-04', {
    fetchImpl: async () => { calls += 1; throw new TypeError('DNS failed'); },
    retries: 1,
    sleep: async () => {},
  }), (error) => error instanceof MlbApiError && error.retryable && error.cause.message === 'DNS failed');
  assert.equal(calls, 2);
});

test('cancellation and invalid options fail early', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchSchedule('2026-07-04', { signal: controller.signal }), /cancelled/);
  await assert.rejects(fetchSchedule('2026-07-04', { timeoutMs: 0 }), RangeError);
  await assert.rejects(fetchSchedule('2026-07-04', { retries: -1 }), RangeError);
});

test('public getProbablePitchers integrates API response and formatting', async () => {
  const data = await getProbablePitchers('2026-07-04', {
    fetchImpl: async () => ok(),
    retries: 0,
  });
  assert.equal(data.matchups.length, 3);
  assert.equal(data.teamPitchers.NYY, 'Game Two Starter');
});

test('a timed-out request emits an actionable error and does not hang', async () => {
  // AbortSignal.timeout uses an unref'ed timer; this ref'ed timer keeps the
  // event loop alive while our fake fetch is waiting for the abort signal.
  const keepAlive = setTimeout(() => {}, 100);
  try {
    await assert.rejects(fetchSchedule('2026-07-04', {
      timeoutMs: 5,
      retries: 0,
      fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
    }), /timed out after 5 ms/);
  } finally {
    clearTimeout(keepAlive);
  }
});
