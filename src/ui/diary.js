/* Diary view: calendar, month overview, "on this day" and recent entries. */
import { $, ymd, pad, longDate, fmtDate, parseYmd, esc, wordCount } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { plain } from '../lib/markdown.js';
import { MOODS } from '../data/constants.js';
import { S, UI, live, diaryFor, noteTitle, isLockedPriv } from '../data/state.js';
import { leaveNote } from './nav.js';
import { onThisDay } from './home.js';
import { renderEditor } from './editor.js';

export function renderDiary(m) {
  UI.diaryDate = UI.diaryDate || ymd(); UI.diaryMonth = UI.diaryMonth || UI.diaryDate.slice(0, 7);
  m.innerHTML = `<div class="diary-view${UI.mobileEditor ? ' show-editor' : ''}">
    <section class="list-pane" aria-label="Diary calendar">
      <div class="pane-head"><button class="icon-btn mobile-only" data-act="openNav" aria-label="Open menu">${icon('menu')}</button><h2>Diary</h2><span class="spacer"></span>
        <button class="btn sm" data-act="today">Today</button><button class="icon-btn" data-act="diaryMenu" title="Diary options" aria-label="Diary options">${icon('more')}</button></div>
      <div class="diary-side" id="diarySide"></div></section>
    <section class="editor-pane" id="editorPane"></section></div>`;
  renderDiarySide(); renderEditor();
}
export function renderDiarySide() {
  const box = $('#diarySide'); if (!box) return;
  const [y, mo] = UI.diaryMonth.split('-').map(Number);
  const first = new Date(y, mo - 1, 1), dow = (first.getDay() + 6) % 7, days = new Date(y, mo, 0).getDate();
  const rows = Math.ceil((dow + days) / 7), today = ymd();
  const entries = {}; live().filter(n => n.type === 'diary').forEach(n => entries[n.date] = n);
  let cells = '';
  for (let i = 0; i < rows * 7; i++) {
    const d = new Date(y, mo - 1, 1 - dow + i), k = ymd(d), e = entries[k];
    const cls = ['cal-day', d.getMonth() !== mo - 1 ? 'out' : '', k === today ? 'today' : '', k === UI.diaryDate ? 'sel' : '', k > today ? 'future' : ''].join(' ');
    cells += `<button class="${cls}" data-act="pickDate" data-date="${k}" aria-label="${longDate(k)}${e ? ', has entry' : ''}"><span>${d.getDate()}</span><i class="dot${e ? '' : ' none'}" ${e && e.mood ? `style="background:${MOODS[e.mood].c}"` : ''}></i></button>`;
  }
  const monthEntries = Object.values(entries).filter(n => n.date.startsWith(UI.diaryMonth));
  const words = monthEntries.reduce((a, n) => a + wordCount(n.body), 0);
  let bars = '';
  for (let d = 1; d <= days; d++) {
    const e = entries[`${UI.diaryMonth}-${pad(d)}`];
    bars += `<i title="${d}${e && e.mood ? ': ' + MOODS[e.mood].n : ''}" style="height:${e ? (e.mood ? e.mood * 20 : 12) : 4}%;${e ? `background:${e.mood ? MOODS[e.mood].c : 'var(--accent)'};opacity:${e.mood ? 1 : .35}` : ''}"></i>`;
  }
  const moodCounts = [5, 4, 3, 2, 1].map(i => [i, monthEntries.filter(n => n.mood === i).length]).filter(x => x[1]);
  const otd = onThisDay(UI.diaryDate);
  const recent = Object.values(entries).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  box.innerHTML = `<div class="cal">
    <div class="cal-nav"><button class="icon-btn" data-act="calMove" data-d="-1" aria-label="Previous month">${icon('left')}</button>
      <strong>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
      <button class="icon-btn" data-act="calMove" data-d="1" aria-label="Next month">${icon('right')}</button></div>
    <div class="cal-grid">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<div class="cal-wd">${d}</div>`).join('')}${cells}</div></div>
    <div class="side-block"><h4>This month</h4><div class="small muted" style="margin-bottom:8px">${monthEntries.length} entr${monthEntries.length === 1 ? 'y' : 'ies'} · ${words.toLocaleString()} words</div>
      ${S.settings.mood ? `<div class="mood-chart" aria-label="Mood by day">${bars}</div>${moodCounts.length ? `<div class="legend">${moodCounts.map(([i, c]) => `<span><i class="mood-dot" style="background:${MOODS[i].c}"></i>${MOODS[i].n} ${c}</span>`).join('')}</div>` : '<div class="legend">Pick a mood in your entries to see your month.</div>'}` : ''}</div>
    ${otd.length ? `<div class="side-block"><h4>On this day</h4><div class="mini">${otd.map(n => `<button data-act="openNote" data-id="${n.id}">${icon('calendar')}<span class="t">${esc(n.date.slice(0, 4))} — ${esc(isLockedPriv(n) ? 'Private entry' : (n.title || plain(n.body).slice(0, 60) || 'Entry'))}</span></button>`).join('')}</div></div>` : ''}
    ${recent.length ? `<div class="side-block"><h4>Recent entries</h4><div class="mini">${recent.map(n => `<button data-act="openNote" data-id="${n.id}">${n.mood ? `<i class="mood-dot" style="background:${MOODS[n.mood].c}"></i>` : icon('book')}<span class="t">${esc(noteTitle(n))}</span><span class="d">${fmtDate(parseYmd(n.date), { day: 'numeric', month: 'short' })}</span></button>`).join('')}</div></div>` : ''}`;
}
export function pickDate(d) {
  leaveNote(); UI.diaryDate = d; UI.diaryMonth = d.slice(0, 7); UI.preview = false;
  const e = diaryFor(d); UI.current = e ? e.id : null; UI.mobileEditor = true;
  const v = $('.diary-view'); if (v) v.classList.add('show-editor');
  renderDiarySide(); renderEditor();
}
