// Transient in-memory handoff between screens (setup -> study -> results).
// Nothing here is persisted; only stats/settings/overlays live in localStorage.
export const appState = {
  session: null, // active session controller
  deck: null, // { meta, cards, ... } the session runs on
  config: null, // the chosen setup config (for "new session" / retry)
  summary: null, // finished-session summary for the results screen
};

export function setSession(deck, session, config) {
  appState.deck = deck;
  appState.session = session;
  appState.config = config;
  appState.summary = null;
}

export function setSummary(summary) {
  appState.summary = summary;
}
