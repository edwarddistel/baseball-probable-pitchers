'use strict';

const { writeFile, rename, unlink } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { basename, dirname, join, resolve } = require('node:path');
const { todayInEastern, validateDate } = require('./date');
const { getProbablePitchers } = require('./index');

const HELP = `Baseball Probable Pitchers

Usage:
  npm start -- [--date YYYY-MM-DD] [--output FILE] [--timezone IANA_ZONE]
  npm start -- --stdout [--date YYYY-MM-DD]

Options:
  -d, --date DATE       MLB calendar date; default: today in US Eastern time
  -o, --output FILE     Write JSON to FILE; default: probable-pitchers.json
      --stdout          Print JSON to stdout instead of writing a file
      --timezone ZONE   Display game times in this IANA timezone
                         (default: America/New_York)
  -h, --help            Show this help

Examples:
  npm start
  npm start -- --date 2026-07-04 --output ./july-4.json
  npm start -- --date 2026-07-04 --stdout
`;

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

function parseArgs(argv) {
  const options = { output: 'probable-pitchers.json', timeZone: 'America/New_York', stdout: false };
  let outputSpecified = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { help: true };
    if (arg === '--stdout') {
      options.stdout = true;
      continue;
    }

    if (['--date', '-d', '--output', '-o', '--timezone'].includes(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new UsageError(`Missing value for ${arg}.`);
      i += 1;
      if (arg === '--date' || arg === '-d') options.date = value;
      if (arg === '--output' || arg === '-o') {
        options.output = value;
        outputSpecified = true;
      }
      if (arg === '--timezone') options.timeZone = value;
      continue;
    }
    throw new UsageError(`Unknown argument: ${arg}`);
  }

  if (options.stdout && outputSpecified) {
    throw new UsageError('Use either --stdout or --output, not both.');
  }
  if (options.date !== undefined) validateDate(options.date);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: options.timeZone });
  } catch {
    throw new UsageError(`Invalid IANA timezone: ${options.timeZone}`);
  }
  if (!options.output.trim()) throw new UsageError('Output filename cannot be empty.');
  return options;
}

/**
 * Save new results atomically. Keeping the temporary file in the same
 * directory allows an atomic rename on the same filesystem. An interrupted
 * network fetch or disk write cannot truncate yesterday's good JSON.
 */
async function atomicSave(filename, contents, {
  write = writeFile,
  move = rename,
  remove = unlink,
  uniqueId = randomUUID,
} = {}) {
  const target = resolve(filename);
  const temporary = join(dirname(target), `.${basename(target)}.${uniqueId()}.tmp`);

  try {
    await write(temporary, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await move(temporary, target);
  } catch (error) {
    // Cleanup is best effort; always preserve the original write/rename error.
    try { await remove(temporary); } catch { /* File may not have been created. */ }
    throw error;
  }
}

/**
 * A testable CLI: every external effect can be injected. Errors result in a
 * non-zero exit code and never replace the previous output with partial JSON.
 */
async function runCli(argv, {
  out = process.stdout,
  err = process.stderr,
  getPitchers = getProbablePitchers,
  save = atomicSave,
  now = () => new Date(),
} = {}) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      out.write(HELP);
      return 0;
    }

    const date = options.date ?? todayInEastern(now());
    const results = await getPitchers(date, { timeZone: options.timeZone });
    const json = `${JSON.stringify(results, null, 2)}\n`;

    if (options.stdout) {
      out.write(json);
    } else {
      await save(options.output, json);
      err.write(`Saved ${results.matchups.length} game(s) to ${options.output}.\n`);
    }
    return 0;
  } catch (error) {
    err.write(`Error: ${error.message}\n`);
    if (error instanceof UsageError || error instanceof RangeError || error instanceof TypeError) {
      err.write('Run with --help to see valid options.\n');
    }
    return 1;
  }
}

module.exports = { HELP, parseArgs, runCli, atomicSave, UsageError };
