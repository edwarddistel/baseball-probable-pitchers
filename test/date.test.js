'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { todayInEastern, validateDate } = require('../src/date');

test('validateDate accepts real, zero-padded Gregorian dates', () => {
  assert.equal(validateDate('2024-02-29'), '2024-02-29');
  assert.equal(validateDate('2026-07-04'), '2026-07-04');
});

test('validateDate rejects rollover dates and incorrectly formatted values', () => {
  for (const input of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00']) {
    assert.throws(() => validateDate(input), RangeError, input);
  }
  for (const input of ['2026-7-4', '07/04/2026', '2026-01-01?x=1', '', null, undefined]) {
    assert.throws(() => validateDate(input), TypeError);
  }
});

test('todayInEastern uses eastern calendar date rather than UTC or server timezone', () => {
  assert.equal(todayInEastern(new Date('2026-07-04T02:30:00Z')), '2026-07-03');
  assert.equal(todayInEastern(new Date('2026-11-20T18:00:00Z')), '2026-11-20');
  assert.throws(() => todayInEastern(new Date('invalid')), TypeError);
});
