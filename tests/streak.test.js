import test from 'node:test';
import assert from 'node:assert/strict';
import { updateStreak, localIsoDate } from '../js/streak.js';

const fresh = { last: null, count: 0 };

test('first study day starts a streak of 1', () => {
  assert.deepEqual(updateStreak(fresh, '2026-10-14'), { last: '2026-10-14', count: 1 });
});

test('studying twice on the same day does not change the streak', () => {
  const s = { last: '2026-10-14', count: 3 };
  assert.equal(updateStreak(s, '2026-10-14'), s);
});

test('studying on consecutive days extends it, including across month and year', () => {
  assert.equal(updateStreak({ last: '2026-10-14', count: 3 }, '2026-10-15').count, 4);
  assert.equal(updateStreak({ last: '2026-10-31', count: 1 }, '2026-11-01').count, 2);
  assert.equal(updateStreak({ last: '2026-12-31', count: 5 }, '2027-01-01').count, 6);
});

test('a gap of more than one day resets to 1', () => {
  assert.deepEqual(updateStreak({ last: '2026-10-10', count: 9 }, '2026-10-14'), { last: '2026-10-14', count: 1 });
});

test('localIsoDate formats local dates with zero padding', () => {
  assert.equal(localIsoDate(new Date(2026, 0, 5)), '2026-01-05');
});
