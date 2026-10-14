import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, review, isNew, isDue, isMastered, INTERVALS_DAYS } from '../js/scheduler.js';

const NOW = Date.UTC(2026, 9, 14);
const DAY = 24 * 60 * 60 * 1000;

test('intervals are 1, 3, 7, 14 days', () => {
  assert.deepEqual(INTERVALS_DAYS, [1, 3, 7, 14]);
});

test('a new state is new, not due, not mastered', () => {
  const s = newState();
  assert.ok(isNew(s));
  assert.ok(!isDue(s, NOW));
  assert.ok(!isMastered(s));
});

test('correct on a new question goes to box 1, due in 1 day', () => {
  const s = review(newState(), true, NOW);
  assert.deepEqual(s, { box: 1, due: NOW + DAY, seen: 1, correct: 1 });
});

test('correct answers climb one box at a time with growing intervals', () => {
  let s = newState();
  const expected = [[1, 1], [2, 3], [3, 7], [4, 14]];
  for (const [box, days] of expected) {
    s = review(s, true, NOW);
    assert.equal(s.box, box);
    assert.equal(s.due, NOW + days * DAY);
  }
  assert.ok(isMastered(s));
});

test('box 4 stays at box 4 on another correct answer', () => {
  const s = review({ box: 4, due: NOW, seen: 5, correct: 5 }, true, NOW);
  assert.equal(s.box, 4);
  assert.equal(s.due, NOW + 14 * DAY);
});

test('a wrong answer from any box returns to box 1, due now', () => {
  const s = review({ box: 4, due: NOW + DAY, seen: 4, correct: 4 }, false, NOW);
  assert.deepEqual(s, { box: 1, due: NOW, seen: 5, correct: 4 });
  assert.ok(isDue(s, NOW));
  assert.ok(!isMastered(s));
});

test('a seen question is due only once its due time has passed', () => {
  const s = review(newState(), true, NOW);
  assert.ok(!isDue(s, NOW));
  assert.ok(isDue(s, NOW + DAY));
});

test('review does not mutate its input', () => {
  const s = newState();
  review(s, true, NOW);
  assert.deepEqual(s, { box: 0, due: 0, seen: 0, correct: 0 });
});
