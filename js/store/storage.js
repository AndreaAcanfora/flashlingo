// Namespaced, quota-safe localStorage wrappers. Every read is guarded so the
// app still runs (in-memory only) when storage is disabled or full.

const NS = 'lt:';
export const SCHEMA_VERSION = '1';

let warnedUnavailable = false;

function available() {
  try {
    const k = NS + '__probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.warn('localStorage unavailable — progress will not persist this session.');
    }
    return false;
  }
}

export function get(key, fallback = null) {
  if (!available()) return fallback;
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Returns true on success, false on failure (e.g. QuotaExceeded).
export function set(key, value) {
  if (!available()) return false;
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('localStorage write failed:', e?.name || e);
    return false;
  }
}

export function remove(key) {
  if (!available()) return;
  try {
    localStorage.removeItem(NS + key);
  } catch {}
}

// All app keys (without the namespace), for export/reset.
export function keys() {
  if (!available()) return [];
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(NS)) out.push(k.slice(NS.length));
  }
  return out;
}

// Raw theme accessor (also read by the inline pre-paint script in index.html).
export function getTheme() {
  try {
    return localStorage.getItem(NS + 'theme');
  } catch {
    return null;
  }
}
export function setThemeRaw(v) {
  try {
    if (v) localStorage.setItem(NS + 'theme', v);
    else localStorage.removeItem(NS + 'theme');
  } catch {}
}

// One-time schema stamp so future versions can migrate.
(function stampVersion() {
  if (get('schemaVersion') == null) set('schemaVersion', SCHEMA_VERSION);
})();
