'use strict';

/**
 * Validate a calendar date rather than relying on Date's rollover behavior
 * (which would otherwise accept invalid values such as February 30).
 * @param {string} value YYYY-MM-DD
 * @returns {string} The validated date.
 */
function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('Date must be in YYYY-MM-DD format.');
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }

  return value;
}

/**
 * The MLB slate follows an American calendar day, not the machine's local
 * timezone. Around midnight UTC those dates can differ by a full day.
 * @param {Date} [instant]
 * @returns {string} Today's date in US Eastern time.
 */
function todayInEastern(instant = new Date()) {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new TypeError('Expected a valid Date instance.');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

module.exports = { todayInEastern, validateDate };
