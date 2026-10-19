// Adaptive difficulty controller for leveled decks (english-3000). Serves cards
// from the current CEFR level and slides up/down on a rolling score, in the
// spirit of the test-cultura quiz (avg >= 0.70 up, <= 0.40 down).
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WINDOW = 10;
const MIN_SAMPLES = 6;
const UP = 0.7;
const DOWN = 0.4;

export function createAdaptive(startLevel, cards) {
  const byLevel = new Map(LEVELS.map((l) => [l, []]));
  for (const c of cards) if (c.level && byLevel.has(c.level)) byLevel.get(c.level).push(c);
  const nonEmpty = LEVELS.filter((l) => byLevel.get(l).length);
  let idx = LEVELS.indexOf(nonEmpty.includes(startLevel) ? startLevel : nonEmpty[0] || 'A1');
  const state = { idx, window: [], trajectory: [LEVELS[idx]] };

  function nearestNonEmpty(i) {
    if (byLevel.get(LEVELS[i]).length) return i;
    for (let d = 1; d < LEVELS.length; d++) {
      if (byLevel.get(LEVELS[i - d] || '')?.length) return i - d;
      if (byLevel.get(LEVELS[i + d] || '')?.length) return i + d;
    }
    return i;
  }

  return {
    get level() {
      return LEVELS[state.idx];
    },
    get trajectory() {
      return state.trajectory;
    },
    poolForNext() {
      state.idx = nearestNonEmpty(state.idx);
      return byLevel.get(LEVELS[state.idx]);
    },
    record(correct) {
      state.window.push(correct ? 1 : 0);
      if (state.window.length > WINDOW) state.window.shift();
      if (state.window.length < MIN_SAMPLES) return;
      const avg = state.window.reduce((a, b) => a + b, 0) / state.window.length;
      if (avg >= UP && state.idx < LEVELS.length - 1) {
        state.idx = nearestNonEmpty(state.idx + 1);
        state.window = [];
      } else if (avg <= DOWN && state.idx > 0) {
        state.idx = nearestNonEmpty(state.idx - 1);
        state.window = [];
      }
      const top = state.trajectory[state.trajectory.length - 1];
      if (top !== LEVELS[state.idx]) state.trajectory.push(LEVELS[state.idx]);
    },
  };
}

export { LEVELS };
