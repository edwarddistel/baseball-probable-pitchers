'use strict';

const { todayInEastern, validateDate } = require('./date');
const { fetchSchedule } = require('./mlb-api');
const { formatSchedule } = require('./format');

/**
 * High-level library API. Pass `{fetchImpl}` in tests or when using a custom
 * HTTP transport; no credentials, cookies, or third-party packages required.
 *
 * @param {string} [date] Calendar date in YYYY-MM-DD (defaults to today in ET).
 * @param {object} [options] Network options plus an optional IANA timeZone.
 * @returns {Promise<{matchups: object[], teamPitchers: object, teamPitchersByGame: object}>}
 */
async function getProbablePitchers(date = todayInEastern(), options = {}) {
  const normalizedDate = validateDate(date);
  const schedule = await fetchSchedule(normalizedDate, options);
  return formatSchedule(schedule, { timeZone: options.timeZone });
}

module.exports = { getProbablePitchers, fetchSchedule, formatSchedule, todayInEastern, validateDate };
