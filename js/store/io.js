// Export / import of user progress (stats + settings + overlays) as a JSON
// bundle, and a small helper to trigger a file download in the browser.
import * as storage from './storage.js';

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportProgress() {
  const bundle = { kind: 'lt-progress', schemaVersion: storage.SCHEMA_VERSION, exportedAt: Date.now(), data: {} };
  for (const k of storage.keys()) {
    if (k === 'schemaVersion') continue;
    bundle.data[k] = storage.get(k);
  }
  return bundle;
}

// Import a progress bundle. `mode` = 'replace' overwrites each key.
export function importProgress(bundle, { mode = 'replace' } = {}) {
  if (!bundle || bundle.kind !== 'lt-progress') throw new Error('Not a flashlingo progress file.');
  let n = 0;
  for (const [k, v] of Object.entries(bundle.data || {})) {
    if (mode === 'replace') {
      storage.set(k, v);
      n++;
    }
  }
  return n;
}

export function readFileAsJSON(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        resolve(JSON.parse(r.result));
      } catch (e) {
        reject(new Error('Invalid JSON file.'));
      }
    };
    r.onerror = () => reject(new Error('Could not read file.'));
    r.readAsText(file);
  });
}
