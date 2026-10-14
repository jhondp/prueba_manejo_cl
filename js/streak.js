const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (iso) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

export function updateStreak(streak, todayIso) {
  if (streak.last === todayIso) return streak;
  const consecutive = streak.last !== null && dayNumber(todayIso) - dayNumber(streak.last) === 1;
  return { last: todayIso, count: consecutive ? streak.count + 1 : 1 };
}

export function localIsoDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
