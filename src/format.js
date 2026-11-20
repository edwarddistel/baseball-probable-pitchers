'use strict';

/**
 * Stable MLB team IDs. Relying on IDs avoids brittle substring matching of
 * display names (e.g., "D-backs", "Arizona Diamondbacks", or "Athletics").
 * For the franchise formerly known as Oakland, ATH is the modern code.
 * @type {Readonly<Record<number, {code: string, name: string}>>}
 */
const MLB_TEAMS = Object.freeze({
  108: { code: 'LAA', name: 'Angels' },
  109: { code: 'ARI', name: 'D-backs' },
  110: { code: 'BAL', name: 'Orioles' },
  111: { code: 'BOS', name: 'Red Sox' },
  112: { code: 'CHC', name: 'Cubs' },
  113: { code: 'CIN', name: 'Reds' },
  114: { code: 'CLE', name: 'Guardians' },
  115: { code: 'COL', name: 'Rockies' },
  116: { code: 'DET', name: 'Tigers' },
  117: { code: 'HOU', name: 'Astros' },
  118: { code: 'KC', name: 'Royals' },
  119: { code: 'LAD', name: 'Dodgers' },
  120: { code: 'WSH', name: 'Nationals' },
  121: { code: 'NYM', name: 'Mets' },
  133: { code: 'ATH', name: 'Athletics' },
  134: { code: 'PIT', name: 'Pirates' },
  135: { code: 'SD', name: 'Padres' },
  136: { code: 'SEA', name: 'Mariners' },
  137: { code: 'SF', name: 'Giants' },
  138: { code: 'STL', name: 'Cardinals' },
  139: { code: 'TB', name: 'Rays' },
  140: { code: 'TEX', name: 'Rangers' },
  141: { code: 'TOR', name: 'Blue Jays' },
  142: { code: 'MIN', name: 'Twins' },
  143: { code: 'PHI', name: 'Phillies' },
  144: { code: 'ATL', name: 'Braves' },
  145: { code: 'CWS', name: 'White Sox' },
  146: { code: 'MIA', name: 'Marlins' },
  147: { code: 'NYY', name: 'Yankees' },
  158: { code: 'MIL', name: 'Brewers' },
});

function teamDetails(team) {
  if (!team || typeof team !== 'object') {
    throw new TypeError('MLB schedule contains a game without team details.');
  }

  const known = MLB_TEAMS[team.id];
  const code = known?.code ?? team.abbreviation;
  const name = known?.name ?? team.teamName ?? team.name;
  if (typeof code !== 'string' || !/^[A-Z]{2,4}$/.test(code) || typeof name !== 'string' || !name.trim()) {
    throw new TypeError(`Cannot identify MLB team ${String(team.id ?? '(unknown)')}.`);
  }
  return { code: code.trim(), name: name.trim() };
}

/**
 * MLB does not always announce starters. Treat absent/partial pitcher objects
 * as TBD rather than dropping the game or writing `undefined` to JSON.
 */
function pitcherName(side) {
  const pitcher = side?.probablePitcher;
  const name = pitcher?.fullName ?? pitcher?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : 'TBD';
}

/**
 * Format with explicitly selected time zone; machine-local time is unreliable
 * on servers and in GitHub Actions. This preserves the original display style.
 */
function formatGameTime(gameDate, timeZone = 'America/New_York') {
  if (typeof gameDate !== 'string' || !Number.isFinite(Date.parse(gameDate))) {
    return 'TBD';
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(new Date(gameDate));

  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${fields.weekday}, ${fields.month} ${fields.day} • ${fields.hour}:${fields.minute} ${fields.dayPeriod} ${fields.timeZoneName}`;
}

function gameSortKey(game) {
  const time = Date.parse(game.gameDate ?? '');
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

/**
 * Convert MLB's schedule into the original {matchups, teamPitchers} contract.
 * Additional teamPitchersByGame entries prevent information loss when the
 * same club plays twice in a doubleheader.
 */
function formatSchedule(schedule, { timeZone = 'America/New_York' } = {}) {
  if (!schedule || !Array.isArray(schedule.dates)) {
    throw new TypeError('Expected an MLB schedule object containing dates[].');
  }
  // Validate the timezone even when there are no games to format.
  new Intl.DateTimeFormat('en-US', { timeZone });

  const games = schedule.dates.flatMap((date) => {
    if (!Array.isArray(date.games)) {
      throw new TypeError('MLB schedule date is missing games[].');
    }
    return date.games;
  }).sort((left, right) =>
    gameSortKey(left) - gameSortKey(right) || (left.gamePk ?? 0) - (right.gamePk ?? 0));

  const matchups = [];
  const teamPitchers = {};
  const teamPitchersByGame = {};

  for (const game of games) {
    const awaySide = game?.teams?.away;
    const homeSide = game?.teams?.home;
    const away = teamDetails(awaySide?.team);
    const home = teamDetails(homeSide?.team);
    const pitcherAway = pitcherName(awaySide);
    const pitcherHome = pitcherName(homeSide);

    if (!Number.isSafeInteger(game.gamePk) || game.gamePk <= 0) {
      throw new TypeError('MLB schedule game is missing a numeric gamePk.');
    }

    matchups.push({
      teamAway: away.name,
      teamHome: home.name,
      time: formatGameTime(game.gameDate, timeZone),
      pitcherAway,
      pitcherHome,
      gamePk: game.gamePk,
      gameNumber: game.gameNumber ?? 1,
      status: game.status?.detailedState ?? 'Unknown',
    });

    // Preserve the legacy lookup-by-team object. In a doubleheader the later
    // scheduled game wins; prefer teamPitchersByGame for unambiguous results.
    teamPitchers[away.code] = pitcherAway;
    teamPitchers[home.code] = pitcherHome;
    teamPitchersByGame[String(game.gamePk)] = {
      [away.code]: pitcherAway,
      [home.code]: pitcherHome,
    };
  }

  return { matchups, teamPitchers, teamPitchersByGame };
}

module.exports = { MLB_TEAMS, teamDetails, pitcherName, formatGameTime, formatSchedule };
