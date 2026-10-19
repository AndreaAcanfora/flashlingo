// Settings screen: theme, study defaults, voice, and data export/import/reset.
import { h, mount, button, toast, confirmDialog } from './components.js';
import { t } from './i18n.js';
import { navigate, routes } from '../router.js';
import { getSettings, updateSettings, resetSettings } from '../store/settings.js';
import { initTheme } from './shell.js';
import { listVoices, supported as speechSupported } from '../engine/speech.js';
import { exportProgress, importProgress, downloadJSON, readFileAsJSON } from '../store/io.js';
import * as storage from '../store/storage.js';

export function renderSettings(container) {
  const s = getSettings();

  const row = (label, control) =>
    h('div', { class: 'flex items-center justify-between gap-4 border-b border-slate-100 py-3 dark:border-slate-800' },
      h('span', { class: 'text-sm font-medium', text: label }), control);

  const select = (value, options, onChange) => {
    const sel = h('select', { class: 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800', onChange: (e) => onChange(e.target.value) });
    for (const [val, text] of options) {
      const o = h('option', { value: val, text });
      if (val === value) o.selected = true;
      sel.append(o);
    }
    return sel;
  };

  const toggle = (checked, onChange) =>
    h('input', { type: 'checkbox', class: 'h-4 w-4 accent-indigo-600', checked, onChange: (e) => onChange(e.target.checked) });

  const voiceOptions = [['', 'Auto'], ...listVoices().map((v) => [v.voiceURI || v.name, `${v.name} (${v.lang})`])];

  const importInput = h('input', { type: 'file', accept: 'application/json', class: 'hidden', onChange: async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bundle = await readFileAsJSON(file);
      const n = importProgress(bundle, { mode: 'replace' });
      toast(`Imported ${n} items.`, { type: 'success' });
      initTheme();
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
    e.target.value = '';
  } });

  mount(container,
    h('div', { class: 'mb-5 flex items-center gap-3' },
      button('← ' + t('back'), { variant: 'ghost', onClick: () => navigate(routes.home()) }),
      h('h2', { class: 'text-xl font-bold', text: t('settings') })),

    h('section', { class: 'mb-6' },
      row(t('theme'), select(s.theme, [['system', t('system')], ['light', t('light')], ['dark', t('dark')]], (v) => { updateSettings({ theme: v }); initTheme(); })),
      row(t('mode'), select(s.defaultGradeMode, [['selfgrade', t('selfgrade')], ['typing', t('typing')]], (v) => updateSettings({ defaultGradeMode: v }))),
      row(t('length'), select(String(s.sessionLength), [['10', '10'], ['20', '20'], ['30', '30'], ['50', '50'], ['0', t('all')]], (v) => updateSettings({ sessionLength: Number(v) }))),
      speechSupported() ? row(t('voice'), select(s.voiceURI || '', voiceOptions, (v) => updateSettings({ voiceURI: v || null }))) : null,
      speechSupported() ? row(t('autoSpeak'), toggle(s.autoSpeak, (v) => updateSettings({ autoSpeak: v }))) : null,
      row(t('nearMiss'), toggle(s.typingNearMiss, (v) => updateSettings({ typingNearMiss: v }))),
    ),

    h('section', { class: 'mb-6' },
      h('h3', { class: 'mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500', text: 'Data' }),
      h('div', { class: 'flex flex-wrap gap-2' },
        button(t('exportProgress'), { variant: 'outline', onClick: () => downloadJSON('flashlingo-progress.json', exportProgress()) }),
        button(t('importProgress'), { variant: 'outline', onClick: () => importInput.click() }),
        button(t('resetAll'), { variant: 'danger', onClick: async () => {
          if (await confirmDialog(t('resetConfirm'), { confirmLabel: t('resetAll') })) {
            for (const k of storage.keys()) storage.remove(k);
            resetSettings();
            initTheme();
            toast('All progress reset.', { type: 'success' });
          }
        } }),
      ),
      importInput,
    ),
  );
}
