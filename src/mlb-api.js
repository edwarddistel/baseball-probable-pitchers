'use strict';

const { setTimeout: delay } = require('node:timers/promises');
const { validateDate } = require('./date');

const SCHEDULE_URL = 'https://statsapi.mlb.com/api/v1/schedule';

/** An error from the MLB schedule service, as distinct from local input errors. */
class MlbApiError extends Error {
  constructor(message, { cause, status, retryable = false } = {}) {
    super(message, { cause });
    this.name = 'MlbApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

function buildScheduleUrl(date) {
  const url = new URL(SCHEDULE_URL);
  url.searchParams.set('sportId', '1');
  url.searchParams.set('date', validateDate(date));
  // Hydrating probablePitcher supplies fullName in most schedule responses.
  // Team hydration supplies abbreviations and modern franchise naming.
  url.searchParams.set('hydrate', 'probablePitcher,team');
  return url;
}

/**
 * Fetch a date's MLB schedule. The native fetch implementation is injectable
 * so all network behavior (timeouts, retries, malformed JSON) can be tested
 * deterministically without an actual request or API credentials.
 *
 * @param {string} date Validated YYYY-MM-DD.
 * @param {object} [options]
 * @returns {Promise<object>} Raw MLB Stats API schedule response.
 */
async function fetchSchedule(date, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
  retries = 2,
  sleep = delay,
  signal,
} = {}) {
  const url = buildScheduleUrl(date);
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('timeoutMs must be a positive integer.');
  }
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) {
    throw new RangeError('retries must be an integer between 0 and 5.');
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) {
      throw new MlbApiError('MLB request was cancelled.', { cause: signal.reason });
    }

    try {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const requestSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;

      const response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: requestSignal,
      });

      if (!response.ok) {
        throw new MlbApiError(`MLB API returned HTTP ${response.status}.`, {
          status: response.status,
          retryable: response.status === 429 || response.status >= 500,
        });
      }

      let payload;
      try {
        payload = await response.json();
      } catch (cause) {
        throw new MlbApiError('MLB API returned invalid JSON.', { cause });
      }

      if (payload === null || typeof payload !== 'object' || !Array.isArray(payload.dates)) {
        throw new MlbApiError('MLB API returned an unexpected schedule response (missing dates).');
      }
      return payload;
    } catch (cause) {
      if (signal?.aborted) {
        throw new MlbApiError('MLB request was cancelled.', { cause });
      }

      const error = cause instanceof MlbApiError
        ? cause
        : new MlbApiError(
          cause?.name === 'TimeoutError'
            ? `MLB request timed out after ${timeoutMs} ms.`
            : 'Network error while fetching MLB schedule.',
          { cause, retryable: true },
        );

      if (!error.retryable || attempt === retries) {
        throw error;
      }

      // Short, bounded exponential backoff for rate limits and transient errors.
      await sleep(250 * 2 ** attempt);
    }
  }

  throw new MlbApiError('MLB schedule request failed.');
}

module.exports = { buildScheduleUrl, fetchSchedule, MlbApiError };
