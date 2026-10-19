// Web Speech API wrapper. Picks the best available voice for a BCP-47 language,
// handles the async voice list, and degrades gracefully when unsupported.
let voices = [];
let ready = false;

export function supported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refresh() {
  if (!supported()) return;
  voices = window.speechSynthesis.getVoices() || [];
  ready = voices.length > 0;
}

if (supported()) {
  refresh();
  window.speechSynthesis.onvoiceschanged = refresh;
}

export function listVoices() {
  if (!ready) refresh();
  return voices;
}

// Best voice for a language: exact lang match, then prefix match, then the
// user's preferred voice, else null (caller may still speak with default).
function pickVoice(lang, preferredURI) {
  if (!ready) refresh();
  const pref = preferredURI && voices.find((v) => v.voiceURI === preferredURI || v.name === preferredURI);
  if (pref && pref.lang && lang && pref.lang.slice(0, 2) === lang.slice(0, 2)) return pref;
  const base = (lang || 'en').slice(0, 2).toLowerCase();
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().slice(0, 2) === base) ||
    pref ||
    null
  );
}

// Returns true if an utterance was dispatched, false if speech is unavailable.
export function speak(text, { lang = 'en-US', rate = 0.95, preferredURI = null } = {}) {
  if (!supported() || !text) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(lang, preferredURI);
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

// Is a usable voice available for this language? (to decide whether to show the
// speak button). We still return true when the list is empty but API exists,
// because some browsers populate voices only after the first speak.
export function hasVoiceFor(lang) {
  if (!supported()) return false;
  if (!ready) refresh();
  if (!voices.length) return true;
  const base = (lang || 'en').slice(0, 2).toLowerCase();
  return voices.some((v) => v.lang && v.lang.toLowerCase().slice(0, 2) === base);
}
