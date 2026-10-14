import { newState, isDue, isNew, isMastered } from './scheduler.js';

const stateOf = (progress, id) => progress[id] ?? newState();

export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function dueQueue(questions, progress, now) {
  return questions
    .filter((q) => isDue(stateOf(progress, q.id), now))
    .sort((a, b) => stateOf(progress, a.id).due - stateOf(progress, b.id).due);
}

export function newQueue(questions, progress, limit = Infinity) {
  return questions.filter((q) => isNew(stateOf(progress, q.id))).slice(0, limit);
}

export function cardDeck(questions, progress, now, newLimit = 10) {
  return [...dueQueue(questions, progress, now), ...newQueue(questions, progress, newLimit)];
}

export function quizSet(questions, progress, size, rng = Math.random) {
  const count = Math.max(0, Math.min(Math.floor(size) || 0, questions.length));
  return shuffle(questions, rng).slice(0, count);
}

export function stats(questions, progress, now) {
  let fresh = 0;
  let due = 0;
  let mastered = 0;
  for (const q of questions) {
    const s = stateOf(progress, q.id);
    if (isNew(s)) fresh += 1;
    if (isDue(s, now)) due += 1;
    if (isMastered(s)) mastered += 1;
  }
  return { total: questions.length, new: fresh, due, mastered };
}
