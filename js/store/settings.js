// Global user settings, persisted as one blob.
import * as storage from './storage.js';

const KEY = 'settings';

const DEFAULTS = {
  theme: 'system', // 'system' | 'light' | 'dark'
  defaultGradeMode: 'selfgrade', // 'selfgrade' | 'typing'
  sessionLength: 20, // 0 = all
  voiceURI: null, // preferred speechSynthesis voice name
  speakRate: 0.95,
  autoSpeak: false,
  typingNearMiss: true,
};

let cache = null;

export function getSettings() {
  if (!cache) cache = { ...DEFAULTS, ...(storage.get(KEY) || {}) };
  return cache;
}

export function updateSettings(patch) {
  cache = { ...getSettings(), ...patch };
  storage.set(KEY, cache);
  return cache;
}

export function resetSettings() {
  cache = { ...DEFAULTS };
  storage.set(KEY, cache);
  return cache;
}

export { DEFAULTS as SETTINGS_DEFAULTS };
