import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffle, dueQueue, newQueue, cardDeck, quizSet, stats } from '../js/deck.js';

const NOW = Date.UTC(2026, 9, 14);
const DAY = 24 * 60 * 60 * 1000;
const questions = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
const progress = {
  a: { box: 1, due: NOW - DAY, seen: 1, correct: 0 }, // due
  b: { box: 2, due: NOW + DAY, seen: 2, correct: 2 }, // scheduled
  c: { box: 4, due: NOW + 14 * DAY, seen: 4, correct: 4 }, // mastered
  d: { box: 1, due: NOW - 2 * DAY, seen: 1, correct: 0 }, // due, older
};
const ids = (list) => list.map((q) => q.id);

test('dueQueue returns due questions, oldest due first', () => {
  assert.deepEqual(ids(dueQueue(questions, progress, NOW)), ['d', 'a']);
});

test('newQueue returns unseen questions and respects the limit', () => {
  assert.deepEqual(ids(newQueue(questions, progress)), ['e']);
  assert.deepEqual(ids(newQueue(questions, {}, 2)), ['a', 'b']);
});

test('cardDeck puts due cards before new ones', () => {
  assert.deepEqual(ids(cardDeck(questions, progress, NOW)), ['d', 'a', 'e']);
});

test('shuffle is a permutation and does not mutate the input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, () => 0.42);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});

test('quizSet returns the requested number of unique questions', () => {
  const set = quizSet(questions, progress, 3);
  assert.equal(set.length, 3);
  assert.equal(new Set(ids(set)).size, 3);
});

test('quizSet clamps size: 0, negative, NaN, fractional and oversized', () => {
  assert.deepEqual(quizSet(questions, progress, 0), []);
  assert.deepEqual(quizSet(questions, progress, -4), []);
  assert.deepEqual(quizSet(questions, progress, NaN), []);
  assert.equal(quizSet(questions, progress, 2.9).length, 2);
  assert.equal(quizSet(questions, progress, 99).length, 5);
  assert.deepEqual(quizSet([], progress, 10), []);
});

test('stats counts new, due and mastered', () => {
  assert.deepEqual(stats(questions, progress, NOW), { total: 5, new: 1, due: 2, mastered: 1 });
});
