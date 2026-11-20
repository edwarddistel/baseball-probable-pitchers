'use strict';

// Backward-compatible entry point for callers using:
// require('./probables').mlbpitchers.getPitchers(date, callback)
// Modern callers should use require('./src').getProbablePitchers(date).
const { getProbablePitchers } = require('./src');
const { MLB_TEAMS } = require('./src/format');

const LEGACY_ALIASES = Object.freeze({
  'Detroit': 'DET',
  'Milwaukee': 'MIL',
  'Oakland': 'ATH',
  'D-backs': 'ARI',
});

function teamShortCode(longName) {
  if (typeof longName !== 'string') return undefined;
  const known = Object.values(MLB_TEAMS).find(({ name }) => name === longName);
  return known?.code ?? LEGACY_ALIASES[longName];
}

/**
 * With a callback, retain the old single-argument success callback contract.
 * The returned Promise always conveys errors, unlike the old swallowed error.
 * Without a callback, use the returned Promise directly.
 */
function getPitchers(day, callback) {
  if (callback !== undefined && typeof callback !== 'function') {
    throw new TypeError('callback must be a function if supplied.');
  }

  const result = getProbablePitchers(day);
  if (callback) return result.then((data) => { callback(data); return data; });
  return result;
}

module.exports = { mlbpitchers: { teamShortCode, getPitchers } };
