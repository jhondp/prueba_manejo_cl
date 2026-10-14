export const INTERVALS_DAYS = [1, 3, 7, 14];
export const MASTERED_BOX = INTERVALS_DAYS.length;
const DAY_MS = 24 * 60 * 60 * 1000;

export function newState() {
  return { box: 0, due: 0, seen: 0, correct: 0 };
}

export function review(state, wasCorrect, now) {
  const box = wasCorrect ? Math.min(state.box + 1, MASTERED_BOX) : 1;
  const due = wasCorrect ? now + INTERVALS_DAYS[box - 1] * DAY_MS : now;
  return {
    box,
    due,
    seen: state.seen + 1,
    correct: state.correct + (wasCorrect ? 1 : 0),
  };
}

export const isNew = (state) => state.box === 0;
export const isDue = (state, now) => state.box > 0 && state.due <= now;
export const isMastered = (state) => state.box === MASTERED_BOX;
