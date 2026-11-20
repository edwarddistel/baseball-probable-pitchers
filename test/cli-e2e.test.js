'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { runCli } = require('../src/cli');

const execFileAsync = promisify(execFile);

test('actual CLI entrypoint returns documented help without fetching data', async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, ['index.js', '--help'], {
    cwd: join(__dirname, '..'),
  });
  assert.match(stdout, /Baseball Probable Pitchers/);
  assert.match(stdout, /--stdout/);
  assert.equal(stderr, '');
});

test('file output is real, parses as JSON, and failed writes preserve old contents', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'baseball-probables-test-'));
  const target = join(tempDir, 'probables.json');
  const expected = { matchups: [], teamPitchers: {}, teamPitchersByGame: {} };
  try {
    const cliOptions = {
      getPitchers: async () => expected,
      out: { write() {} },
      err: { write() {} },
    };
    assert.equal(await runCli(['--output', target], cliOptions), 0);
    assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), expected);

    await writeFile(target, 'KEEP ME');
    assert.equal(await runCli(['--output', target], {
      ...cliOptions,
      getPitchers: async () => { throw new Error('MLB is down'); },
    }), 1);
    assert.equal(await readFile(target, 'utf8'), 'KEEP ME');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
