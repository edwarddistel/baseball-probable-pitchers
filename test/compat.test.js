'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mlbpitchers } = require('../probables');

test('legacy teamShortCode works with renamed and two-word teams', () => {
  assert.equal(mlbpitchers.teamShortCode('Mets'), 'NYM');
  assert.equal(mlbpitchers.teamShortCode('Blue Jays'), 'TOR');
  assert.equal(mlbpitchers.teamShortCode('D-backs'), 'ARI');
  assert.equal(mlbpitchers.teamShortCode('Athletics'), 'ATH');
  assert.equal(mlbpitchers.teamShortCode('Oakland'), 'ATH');
  assert.equal(mlbpitchers.teamShortCode('Unknown'), undefined);
});

test('legacy getPitchers validates callback and date without hitting network', async () => {
  assert.throws(() => mlbpitchers.getPitchers('2026-07-04', 123), /callback/);
  await assert.rejects(mlbpitchers.getPitchers('not a date'), /YYYY-MM-DD/);
});
