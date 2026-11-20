'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, runCli, atomicSave } = require('../src/cli');

function capture() {
  let text = '';
  return { write(chunk) { text += chunk; }, get value() { return text; } };
}

const exampleResult = { matchups: [{ teamAway: 'Mets' }], teamPitchers: { NYM: 'TBD' }, teamPitchersByGame: {} };

test('parseArgs accepts date/output/timezone and rejects broken invocations', () => {
  assert.deepEqual(parseArgs(['-d', '2026-07-04', '-o', 'games.json', '--timezone', 'UTC']), {
    date: '2026-07-04', output: 'games.json', timeZone: 'UTC', stdout: false,
  });
  assert.equal(parseArgs(['--help']).help, true);
  assert.throws(() => parseArgs(['--date']), /Missing value/);
  assert.throws(() => parseArgs(['--wat']), /Unknown argument/);
  assert.throws(() => parseArgs(['--stdout', '--output', 'games.json']), /either/);
  assert.throws(() => parseArgs(['--timezone', 'Jupiter/Olympus']), /Invalid IANA timezone/);
  assert.throws(() => parseArgs(['--date', '2026-02-30']), RangeError);
});

test('CLI writes JSON to the output file and emits a concise status line', async () => {
  const out = capture();
  const err = capture();
  const writes = [];
  let argumentsSeen;
  const code = await runCli(['--date', '2026-07-04', '--output', 'pitchers.json'], {
    out, err,
    getPitchers: async (...args) => { argumentsSeen = args; return exampleResult; },
    save: async (...args) => { writes.push(args); },
  });
  assert.equal(code, 0);
  assert.equal(out.value, '');
  assert.equal(argumentsSeen[0], '2026-07-04');
  assert.equal(argumentsSeen[1].timeZone, 'America/New_York');
  assert.equal(writes[0][0], 'pitchers.json');
  assert.deepEqual(JSON.parse(writes[0][1]), exampleResult);
  assert.equal(writes[0].length, 2);
  assert.match(err.value, /Saved 1 game/);
});

test('CLI streams only JSON to stdout and skips writing files', async () => {
  const out = capture();
  const err = capture();
  const code = await runCli(['--stdout'], {
    out, err,
    now: () => new Date('2026-07-04T02:00:00Z'),
    getPitchers: async (date) => { assert.equal(date, '2026-07-03'); return exampleResult; },
    save: async () => { throw new Error('save should not be called'); },
  });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out.value), exampleResult);
  assert.equal(err.value, '');
});

test('CLI returns exit code 1 on bad options, API failure, or disk errors', async () => {
  for (const options of [
    { args: ['--invalid'], getPitchers: async () => exampleResult, save: async () => {} },
    { args: [], getPitchers: async () => { throw new Error('MLB unavailable'); }, save: async () => {} },
    { args: [], getPitchers: async () => exampleResult, save: async () => { throw new Error('Disk full'); } },
  ]) {
    const out = capture();
    const err = capture();
    assert.equal(await runCli(options.args, { out, err, ...options }), 1);
    assert.equal(out.value, '');
    assert.match(err.value, /^Error: /);
  }
});

test('CLI help is a pure operation and can be invoked without network', async () => {
  const out = capture();
  const code = await runCli(['--help'], {
    out,
    getPitchers: () => { throw new Error('should not fetch'); },
  });
  assert.equal(code, 0);
  assert.match(out.value, /Usage:/);
  assert.match(out.value, /--date/);
});

test('atomicSave writes to a private temporary file and renames into place', async () => {
  const calls = [];
  await atomicSave('games.json', '{"ok":true}', {
    uniqueId: () => 'test-uuid',
    write: async (...args) => calls.push(['write', ...args]),
    move: async (...args) => calls.push(['rename', ...args]),
  });
  assert.equal(calls[0][0], 'write');
  assert.match(calls[0][1], /\.games\.json\.test-uuid\.tmp$/);
  assert.equal(calls[0][2], '{"ok":true}');
  assert.deepEqual(calls[0][3], { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  assert.equal(calls[1][0], 'rename');
  assert.match(calls[1][2], /games\.json$/);
});

test('atomicSave cleans up temporary file when writing or renaming fails', async () => {
  for (const failureStage of ['write', 'move']) {
    const removed = [];
    const error = new Error('Disk error');
    await assert.rejects(atomicSave('games.json', '{}', {
      uniqueId: () => 'cleanup',
      write: async () => { if (failureStage === 'write') throw error; },
      move: async () => { if (failureStage === 'move') throw error; },
      remove: async (path) => removed.push(path),
    }), (actual) => actual === error);
    assert.equal(removed.length, 1);
    assert.match(removed[0], /\.tmp$/);
  }
});
