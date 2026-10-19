// Text normalization shared by the converter and validator.
// Each rule here is a deliberate, documented decision about the source data.

// Collapse whitespace, NFC-normalize, trim. Applied to every stored string.
export function clean(s) {
  return String(s).normalize('NFC').replace(/\s+/g, ' ').trim();
}

// Split a gloss that packs several senses with "/" into separate entries,
// e.g. "così/quindi" -> ["così", "quindi"]. Used to widen the gradeable set.
export function splitSlash(s) {
  return clean(s)
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
}

// Turn a raw value (string or array) into a clean, de-duplicated string array.
// `slash` controls whether "/"-joined values are expanded into multiple answers.
export function toList(value, { slash = true } = {}) {
  const raw = Array.isArray(value) ? value : [value];
  const out = [];
  for (const item of raw) {
    const parts = slash ? splitSlash(item) : [clean(item)];
    for (const p of parts) if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

// A normalized key for duplicate detection: lowercase, accent-insensitive,
// and with the phrasal "*" separable marker stripped ("be back*" -> "be back").
export function dedupeKey(front) {
  return clean(front)
    .toLowerCase()
    .replace(/\*/g, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
