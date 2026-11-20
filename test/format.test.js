'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/schedule.json');
const {
  MLB_TEAMS, teamDetails, pitcherName, formatGameTime, formatSchedule,
} = require('../src/format');

test('all 30 current MLB clubs have unique and safe canonical abbreviations', () => {
  const values = Object.values(MLB_TEAMS);
  assert.equal(values.length, 30);
  assert.equal(new Set(values.map((team) => team.code)).size, 30);
  assert.ok(values.every(({ code }) => /^[A-Z]{2,3}$/.test(code)));
  assert.equal(MLB_TEAMS[133].code, 'ATH');
});

test('teamDetails prefers stable MLB IDs but accepts new teams with an abbreviation', () => {
  assert.deepEqual(teamDetails({ id: 109, name: 'Arizona Diamondbacks' }), { code: 'ARI', name: 'D-backs' });
  assert.deepEqual(teamDetails({ id: 999, abbreviation: 'ABC', teamName: 'Example Club' }), {
    code: 'ABC', name: 'Example Club',
  });
  assert.throws(() => teamDetails({ id: 999, name: 'Unknown Team' }), /Cannot identify/);
  assert.throws(() => teamDetails(undefined), /without team details/);
  assert.throws(() => teamDetails({ id: 999, abbreviation: '__proto__', teamName: 'Malicious' }), /Cannot identify/);
});

test('pitcherName supports unannounced probable pitchers', () => {
  assert.equal(pitcherName({ probablePitcher: { fullName: '  Example Pitcher ' } }), 'Example Pitcher');
  assert.equal(pitcherName({ probablePitcher: { name: 'Secondary Name' } }), 'Secondary Name');
  assert.equal(pitcherName({ probablePitcher: { fullName: '  ' } }), 'TBD');
  assert.equal(pitcherName({}), 'TBD');
});

test('game times honor daylight saving time and caller-selected timezone', () => {
  assert.equal(formatGameTime('2026-07-04T17:05:00Z'), 'Sat, Jul 4 • 1:05 PM EDT');
  assert.equal(formatGameTime('2026-01-04T18:05:00Z'), 'Sun, Jan 4 • 1:05 PM EST');
  assert.equal(formatGameTime('2026-07-04T17:05:00Z', 'America/Los_Angeles'), 'Sat, Jul 4 • 10:05 AM PDT');
  assert.equal(formatGameTime(undefined), 'TBD');
});

test('formatSchedule preserves original fields and adds unambiguous doubleheader lookup', () => {
  const result = formatSchedule(fixture);
  assert.deepEqual(result.matchups.map(({ gamePk }) => gamePk), [888009, 888011, 888010]);
  assert.deepEqual(result.matchups[0], {
    teamAway: 'Yankees',
    teamHome: 'Red Sox',
    time: 'Sat, Jul 4 • 1:05 PM EDT',
    pitcherAway: 'Game One Starter',
    pitcherHome: 'Game One Opponent',
    gamePk: 888009,
    gameNumber: 1,
    status: 'Scheduled',
  });
  assert.equal(result.matchups[1].pitcherAway, 'Example Starter');
  assert.equal(result.matchups[1].pitcherHome, 'TBD');
  assert.equal(result.teamPitchers.NYM, 'TBD');
  assert.equal(result.teamPitchers.NYY, 'Game Two Starter');
  assert.equal(result.teamPitchers.BOS, 'Game Two Opponent');
  assert.deepEqual(result.teamPitchersByGame['888009'], {
    NYY: 'Game One Starter', BOS: 'Game One Opponent',
  });
  assert.deepEqual(result.teamPitchersByGame['888010'], {
    NYY: 'Game Two Starter', BOS: 'Game Two Opponent',
  });
});

test('offseason and days with no games return empty structures', () => {
  assert.deepEqual(formatSchedule({ dates: [] }), { matchups: [], teamPitchers: {}, teamPitchersByGame: {} });
  assert.deepEqual(formatSchedule({ dates: [{ games: [] }] }), { matchups: [], teamPitchers: {}, teamPitchersByGame: {} });
});

test('malformed MLB schedule objects produce descriptive errors', () => {
  assert.throws(() => formatSchedule({}), /dates/);
  assert.throws(() => formatSchedule({ dates: [{}] }), /games/);
  assert.throws(() => formatSchedule({ dates: [] }, { timeZone: 'Mars/Phobos' }), RangeError);

  const broken = structuredClone(fixture);
  delete broken.dates[0].games[0].gamePk;
  assert.throws(() => formatSchedule(broken), /gamePk/);
});
