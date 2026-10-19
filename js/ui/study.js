// Study screen: shows one card at a time, handles reveal, self-grade or typing
// check, audio, progress and keyboard shortcuts.
import { h, mount, button, levelPill, flag, progressBar, toast } from './components.js';
import { t } from './i18n.js';
import { navigate, routes } from '../router.js';
import { appState, setSummary } from '../state.js';
import { getSettings } from '../store/settings.js';
import { speak, supported as speechSupported } from '../engine/speech.js';
import { checkTyped } from '../data/card.js';

export function renderStudy(container, { id }) {
  const { session, deck } = appState;
  if (!session || !deck || deck.meta.id !== id) {
    navigate(routes.setup(id));
    return;
  }
  const settings = getSettings();
  const meta = deck.meta;

  let current = null;
  let revealed = false;
  let options = null; // multiple-choice options for the current card
  let chosen = null; // the option the user picked
  let keyHandler = null;

  // Build 4 options for multiple-choice: the correct answer plus distractors
  // drawn from other cards (same group first, e.g. same continent).
  function buildOptions(card) {
    const correct = card.back[0];
    const accepted = new Set(card.back.map((b) => b.toLowerCase()));
    const sameGroup = deck.cards.filter((c) => c !== card && (!card.group || c.group === card.group));
    const others = (sameGroup.length >= 6 ? sameGroup : deck.cards).filter((c) => c !== card);
    const pool = [];
    for (const c of others) {
      const v = c.back[0];
      if (v && !accepted.has(v.toLowerCase()) && !pool.includes(v)) pool.push(v);
    }
    // shuffle pool, take 3
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const opts = [correct, ...pool.slice(0, 3)];
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    return opts.map((text) => ({ text, correct: accepted.has(text.toLowerCase()) }));
  }

  function cleanup() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
  }

  function finish() {
    cleanup();
    const results = session.results();
    const seen = Object.keys(results).length;
    const correct = Object.values(results).filter((r) => r.correct).length;
    setSummary({
      deckId: id,
      title: meta.title,
      seen,
      correct,
      missed: session.missed(deck.cards),
      adaptive: session.adaptive,
      trajectory: session.trajectory,
    });
    navigate(routes.results(id));
  }

  function speakCurrent() {
    if (!current) return;
    const text = meta.speakSide === 'back' ? (current.back[0] || '') : current.front;
    speak(text, { lang: meta.speakLang, rate: settings.speakRate, preferredURI: settings.voiceURI });
  }

  function advance() {
    current = session.next();
    revealed = false;
    chosen = null;
    if (!current) return finish();
    options = session.gradeMode === 'multiple' ? buildOptions(current) : null;
    render();
    if (settings.autoSpeak && meta.speakSide === 'front') speakCurrent();
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    render();
    if (settings.autoSpeak && meta.speakSide === 'back') speakCurrent();
  }

  function grade(correct, tier = null) {
    session.grade(current, correct, tier);
    advance();
  }

  // ---- rendering ----
  function header() {
    const left = h('div', { class: 'flex items-center gap-2' },
      button('✕', { variant: 'ghost', title: t('endSession'), onClick: finish }),
    );
    let mid;
    if (session.adaptive) {
      mid = h('div', { class: 'flex items-center gap-2 text-sm text-slate-500' }, h('span', { text: 'Level' }), levelPill(session.currentLevel));
    } else {
      const done = session.position;
      const total = session.total;
      mid = h('div', { class: 'flex-1 px-4' }, progressBar(total ? done / total : 0), h('div', { class: 'mt-1 text-center text-xs text-slate-500', text: `${done} / ${total}` }));
    }
    const right = speechSupported()
      ? button('🔊', { variant: 'ghost', title: t('speak'), onClick: speakCurrent, disabled: meta.speakSide === 'back' && !revealed })
      : h('span');
    return h('div', { class: 'mb-4 flex items-center justify-between gap-2' }, left, mid, right);
  }

  function promptFace() {
    const f = meta.mode === 'capitals' ? h('div', { class: 'mb-3' }, flag(current.cc, { size: 40 })) : null;
    return h('div', { class: 'flip-face items-center justify-center gap-3 p-6 text-center' },
      h('span', { class: 'text-xs uppercase tracking-wide text-slate-400', text: meta.frontLabel }),
      f,
      h('div', { class: 'text-3xl font-bold', text: current.front }),
      current.level ? levelPill(current.level) : null,
    );
  }

  function answerFace() {
    const children = [
      h('span', { class: 'text-xs uppercase tracking-wide text-slate-400', text: meta.backLabel }),
      meta.mode === 'capitals' ? flag(current.cc, { size: 32 }) : null,
      h('div', { class: 'text-3xl font-bold', text: current.back.join(' · ') }),
    ];
    const meanings = current.meanings?.length ? current.meanings : null;
    if (meanings) children.push(h('p', { class: 'mt-1 text-sm text-slate-500 dark:text-slate-400', text: meanings.join('; ') }));
    if (current.synonyms?.length) children.push(h('p', { class: 'mt-1 text-xs text-slate-400', text: '≈ ' + current.synonyms.join(', ') }));
    if (current.example) children.push(h('p', { class: 'mt-3 max-w-md text-sm italic text-slate-500 dark:text-slate-400', text: '“' + current.example + '”' }));
    return h('div', { class: 'flip-face flip-back items-center justify-center gap-1 p-6 text-center' }, ...children);
  }

  function card() {
    const wrap = h('div', { class: `flip ${revealed ? 'revealed' : ''}`, style: 'height:16rem' },
      h('div', { class: 'flip-inner rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900' },
        promptFace(), answerFace()));
    return wrap;
  }

  function controls() {
    if (session.gradeMode === 'multiple') return multipleControls();
    if (session.gradeMode === 'typing') return typingControls();
    // self-grade
    if (!revealed) {
      return h('div', { class: 'mt-5 flex justify-center' }, button(t('reveal') + '  (Space)', { variant: 'primary', onClick: reveal }));
    }
    return h('div', { class: 'mt-5 flex justify-center gap-3' },
      button('✗ ' + t('didnt'), { variant: 'outline', onClick: () => grade(false) }),
      button('✓ ' + t('knewIt'), { variant: 'primary', onClick: () => grade(true) }),
    );
  }

  function selectOption(opt) {
    if (chosen) return;
    chosen = opt;
    session.grade(current, opt.correct);
    revealed = true;
    render();
    if (settings.autoSpeak && meta.speakSide === 'back') speakCurrent();
  }

  function multipleControls() {
    const grid = h('div', { class: 'mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2' });
    (options || []).forEach((opt, i) => {
      let cls = 'rounded-lg border px-4 py-3 text-left text-base transition ';
      if (!chosen) cls += 'border-slate-300 hover:border-brand hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800';
      else if (opt.correct) cls += 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100';
      else if (opt === chosen) cls += 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100';
      else cls += 'border-slate-200 text-slate-400 dark:border-slate-700';
      grid.append(h('button', {
        type: 'button', class: cls, disabled: !!chosen,
        onClick: () => selectOption(opt),
      }, h('span', { class: 'mr-2 text-xs text-slate-400', text: String(i + 1) }), opt.text));
    });
    const after = chosen ? h('div', { class: 'mt-4 flex justify-center' }, button(t('next') + '  (Space)', { variant: 'primary', onClick: advance })) : null;
    return h('div', {}, grid, after);
  }

  function typingControls() {
    if (revealed) {
      // show outcome handled in render via feedback; advance button
      return h('div', { class: 'mt-5 flex justify-center' }, button(t('next') + '  (Space)', { variant: 'primary', onClick: advance }));
    }
    const input = h('input', {
      type: 'text',
      class: 'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg dark:border-slate-600 dark:bg-slate-800',
      placeholder: t('typeAnswer'),
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-label': t('typeAnswer'),
    });
    const submit = () => {
      const res = checkTyped(input.value, current, { nearMiss: settings.typingNearMiss });
      if (res.correct) {
        feedback(true);
        session.grade(current, true);
        reveal();
      } else if (res.near) {
        showNear(input.value);
      } else {
        feedback(false);
        session.grade(current, false);
        reveal();
      }
    };
    const row = h('div', { class: 'mt-5' }, input, h('div', { class: 'mt-3 flex justify-center' }, button(t('check') + '  (Enter)', { variant: 'primary', onClick: submit })));
    setTimeout(() => input.focus(), 30);
    typingSubmit = submit;
    return row;
  }

  let typingSubmit = null;
  let feedbackNode = null;
  function feedback(correct) {
    const live = document.getElementById('sr-live');
    if (live) live.textContent = correct ? t('correct') : t('incorrect');
  }
  function showNear(value) {
    const body = h('div', { class: 'mt-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' },
      h('p', { class: 'mb-2', text: t('almost') }),
      h('div', { class: 'flex justify-center gap-2' },
        button(t('reallyWrong'), { variant: 'outline', onClick: () => { session.grade(current, false); reveal(); } }),
        button(t('countCorrect'), { variant: 'primary', onClick: () => { session.grade(current, true); reveal(); } }),
      ),
    );
    const slot = container.querySelector('#near-slot');
    if (slot) mount(slot, body);
  }

  function render() {
    mount(container,
      header(),
      card(),
      h('div', { id: 'sr-live', class: 'sr-only', 'aria-live': 'polite' }),
      h('div', { id: 'near-slot' }),
      controls(),
      h('div', { class: 'mt-6 text-center text-xs text-slate-400' },
        session.gradeMode === 'multiple'
          ? h('span', {}, '1–4 = choose · Space = next · S = speak · Esc = end')
          : session.gradeMode === 'typing'
            ? h('span', {}, 'Enter = check · Space = next · S = speak · Esc = end')
            : h('span', {}, 'Space = reveal · 1 = didn’t · 2 = knew it · S = speak · Esc = end')),
    );
  }

  keyHandler = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      if (e.key === 'Enter' && session.gradeMode === 'typing' && !revealed && typingSubmit) { e.preventDefault(); typingSubmit(); }
      return;
    }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); speakCurrent(); return; }
    if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
    if (session.gradeMode === 'multiple') {
      if (!chosen && options) {
        const idx = parseInt(e.key, 10);
        if (idx >= 1 && idx <= options.length) { e.preventDefault(); selectOption(options[idx - 1]); }
      } else if (chosen && e.key === ' ') { e.preventDefault(); advance(); }
      return;
    }
    if (session.gradeMode === 'typing') {
      if (e.key === ' ' && revealed) { e.preventDefault(); advance(); }
      return;
    }
    if (e.key === ' ') { e.preventDefault(); if (!revealed) reveal(); }
    else if (revealed && (e.key === '1')) { e.preventDefault(); grade(false); }
    else if (revealed && (e.key === '2')) { e.preventDefault(); grade(true); }
  };
  document.addEventListener('keydown', keyHandler);

  if (session.isEmpty()) {
    mount(container, h('div', { class: 'rounded-xl border border-slate-200 p-8 text-center dark:border-slate-800' },
      h('p', { class: 'mb-4 text-slate-500', text: t('emptyFilter') }),
      button(t('back'), { variant: 'primary', onClick: () => navigate(routes.setup(id)) })));
    return () => cleanup();
  }

  advance();
  return () => cleanup();
}
