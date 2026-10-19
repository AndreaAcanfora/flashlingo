// Adaptive difficulty controller for leveled decks (english-3000). Serves cards
// from the current CEFR level and slides up/down on a rolling score, in the
// spirit of the test-cultura quiz (avg >= 0.70 up, <= 0.40 down).
//
// It is "learned-aware": a card answered correctly this session is removed from
// the pool, and when a level runs thin (e.g. C2 has only a couple of cards) the
// pool is widened to the nearest levels so you never loop the same 2 cards.
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WINDOW = 10;
const MIN_SAMPLES = 6;
const UP = 0.7;
const DOWN = 0.4;
const MIN_POOL = 5; // widen to neighbouring levels until at least this many unlearned cards

export function createAdaptive(startLevel, cards) {
  const byLevel = new Map(LEVELS.map((l) => [l, []]));
  for (const c of cards) if (c.level && byLevel.has(c.level)) byLevel.get(c.level).push(c);
  const nonEmpty = LEVELS.filter((l) => byLevel.get(l).length);
  let idx = LEVELS.indexOf(nonEmpty.includes(startLevel) ? startLevel : nonEmpty[0] || 'A1');
  const state = { idx, window: [], trajectory: [LEVELS[idx]] };

  return {
    get level() {
      return LEVELS[state.idx];
    },
    get trajectory() {
      return state.trajectory;
    },
    // Unlearned cards at (or near) the current level. Widens to neighbouring
    // levels when the current one is thin, so tiny levels never loop.
    pool(learned) {
      const unlearnedAt = (i) => (byLevel.get(LEVELS[i]) || []).filter((c) => !learned.has(c._id));
      let pool = unlearnedAt(state.idx);
      for (let d = 1; pool.length < MIN_POOL && d < LEVELS.length; d++) {
        if (LEVELS[state.idx - d]) pool = pool.concat(unlearnedAt(state.idx - d));
        if (pool.length < MIN_POOL && LEVELS[state.idx + d]) pool = pool.concat(unlearnedAt(state.idx + d));
      }
      return pool;
    },
    record(correct) {
      state.window.push(correct ? 1 : 0);
      if (state.window.length > WINDOW) state.window.shift();
      if (state.window.length < MIN_SAMPLES) return;
      const avg = state.window.reduce((a, b) => a + b, 0) / state.window.length;
      if (avg >= UP && state.idx < LEVELS.length - 1) {
        state.idx += 1;
        state.window = [];
      } else if (avg <= DOWN && state.idx > 0) {
        state.idx -= 1;
        state.window = [];
      }
      const top = state.trajectory[state.trajectory.length - 1];
      if (top !== LEVELS[state.idx]) state.trajectory.push(LEVELS[state.idx]);
    },
  };
}

export { LEVELS };
