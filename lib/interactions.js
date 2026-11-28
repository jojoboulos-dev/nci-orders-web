'use strict';
/* ══════════════════════════════════════════════════════════════════
 * The interaction alarm.
 *
 * Dr Boulos, 9 October 2026: "also add drug interactions alarm for the
 * doctor orders, use the attached pdfs".
 *
 * The pdf is the department's own "Oral Chemotherapy Administration &
 * Drug-Drug Interaction Management Guide" — thirteen oral agents, each with
 * a table of the drugs that must not, or should not, be given beside them.
 * It is in `data/interactions.json`, transcribed row by row by
 * tools/import_interactions_20261009.py.
 *
 * WHAT THIS FILE DOES AND WHAT IT REFUSES TO DO.
 *
 * It reads the order the doctor has already written — the drugs ticked on
 * the daily sheet, the chemotherapy sheets queued for that child, and
 * whatever was typed into the free line — and says when two of them are a
 * pair the guide names. It says which pair, what the guide says happens,
 * and what the guide says to do. It then stops.
 *
 * It does not reduce a dose, it does not untick a drug, it does not block
 * printing, and it never says a combination is safe. An alarm that is not
 * raised means only that the department's guide does not carry that pair,
 * which is not the same as the pair being fine: the guide covers thirteen
 * oral agents and twenty-six concomitant drugs, and the ward gives
 * hundreds. Silence here is silence, not clearance, and the panel says so
 * on its face.
 *
 * Severity is the guide's own three letters and is never promoted or
 * demoted on the way to the screen. X and D are shown open; C — monitor —
 * is folded away behind a count, because a ward that is shown nine grey
 * warnings a day stops reading the red one.
 *
 * The guide has two halves — thirteen monograph pages and a one-page
 * summary grid — and they do not agree everywhere. Dr Boulos, 9 October
 * 2026: "always take the more severe interaction whenever in disagreement".
 * So the data file holds both, merged, with the severer letter winning and
 * both letters kept; where they differed the alarm says so. A pair the grid
 * carries alone has a letter and NO mechanism, and the card says that
 * rather than borrowing a sentence of pharmacology from somewhere else.
 *
 * Matching is by name, never by class. "Any CYP3A4 inhibitor" is not a
 * thing this app can recognise on a written line, and guessing at it would
 * be an alarm nobody could check. Each interacting drug carries the Arabic
 * the ward actually writes and the English its row in the drug list
 * carries, and check_interactions.js asserts that the ones the hospital
 * stocks still match a real row — so an alarm cannot quietly stop firing
 * because somebody renamed a drug.
 *
 * Wrapped in an IIFE for the reason icu.js is: the renderer's scripts share
 * one global scope.
 * ══════════════════════════════════════════════════════════════════ */
(function () {

let DATA = (typeof window !== 'undefined' && window.INTERACTIONS) || null;
if (!DATA && typeof require !== 'undefined') {
  try { DATA = require('../data/interactions.json'); } catch (e) { DATA = null; }
}
function setData(d) { DATA = d; }

const ORDER = { X: 0, D: 1, C: 2 };

/* Arabic is spelled more than one way; both sides are normalised the same
   way the pharmacy's names are, so كيتريل and كيترل are one word. */
const norm = (s) => String(s || '')
  .replace(/ى/g, 'ي')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ـ/g, '')
  .replace(/[ً-ْ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function hits(item, arPat, enPat) {
  if (arPat) {
    try {
      if (new RegExp(norm(arPat)).test(norm(item.ar || ''))) return true;
    } catch (e) { /* a bad pattern must not take the order screen down */ }
  }
  if (enPat) {
    try {
      if (new RegExp(enPat, 'i').test(String(item.en || ''))) return true;
    } catch (e) { /* as above */ }
  }
  return false;
}

/* ── the pool ─────────────────────────────────────────────────────
 * Everything this child is written up for today, as {en, ar, label,
 * source}. The caller builds it; this module never reaches into the
 * database itself, so it can be tested with a list of four strings.
 */
function scan(items) {
  const out = [];
  if (!DATA || !DATA.drugs) return out;
  const pool = (items || []).filter((x) => x && (x.en || x.ar));
  DATA.drugs.forEach((d) => {
    const on = pool.filter((it) => hits(it, d.ar, d.en));
    if (!on.length) return;
    d.interactions.forEach((ix) => {
      const t = (DATA.targets || {})[ix.target] || {};
      if (!t.en && !t.ar) return;          // not something the ward stocks
      const other = pool.filter((it) => hits(it, t.ar, t.en) && on.indexOf(it) < 0);
      if (!other.length) return;
      out.push({
        severity: ix.severity,
        agent: d.generic,
        agentBrand: d.brand,
        agentOn: on[0],
        target: ix.name,
        targetKey: ix.target,
        targetOn: other[0],
        others: other,
        cls: ix['class'],
        why: ix.why,
        manage: ix.manage,
        note: ix.note || null,
        from: ix.from || 'page',
      });
    });
  });
  out.sort((a, b) => (ORDER[a.severity] - ORDER[b.severity])
    || a.agent.localeCompare(b.agent) || a.target.localeCompare(b.target));
  return out;
}

const worst = (as) => (as || []).reduce(
  (w, a) => (ORDER[a.severity] < ORDER[w] ? a.severity : w), 'C');

function counts(as) {
  const c = { X: 0, D: 0, C: 0 };
  (as || []).forEach((a) => { c[a.severity] += 1; });
  return c;
}

/* ── what the band says ───────────────────────────────────────────
 * One line per X or D, a count for the C's, and the sentence that keeps
 * the whole thing honest.
 */
const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;' }[c]));

const SEVCLASS = { X: 'ix-x', D: 'ix-d', C: 'ix-c' };

function label(a) {
  const s = (DATA && DATA.severity && DATA.severity[a.severity]) || {};
  return `${a.severity} — ${s.label || ''}`;
}

function bandHtml(alarms) {
  const as = alarms || [];
  if (!as.length) return '';
  const c = counts(as);
  const loud = as.filter((a) => a.severity !== 'C');
  const quiet = as.filter((a) => a.severity === 'C');
  const rows = loud.map((a, i) => `
    <div class="ixrow ${SEVCLASS[a.severity]}">
      <span class="ixsev">${esc(a.severity)}</span>
      <span class="ixtxt"><b>${esc(a.agent)}</b> with <b>${esc(a.target)}</b>
        — ${esc(label(a))}</span>
      <button class="sm ixmore" data-ix="${as.indexOf(a)}">What to do</button>
    </div>`).join('');
  const quietLine = quiet.length ? `
    <div class="ixrow ix-c">
      <span class="ixsev">C</span>
      <span class="ixtxt">${quiet.length} more to monitor —
        ${esc(quiet.map((a) => `${a.agent} with ${a.target}`).join('; '))}</span>
      <button class="sm ixmore" data-ix="${as.indexOf(quiet[0])}">What to do</button>
    </div>` : '';
  return `<div class="ixband ${SEVCLASS[worst(as)]}">
    <div class="ixhead">Drug interactions on this order
      — ${c.X ? `${c.X} to avoid, ` : ''}${c.D ? `${c.D} needing a change, ` : ''}${c.C} to monitor</div>
    ${rows}${quietLine}
    <div class="ixfoot">From the department's own oral chemotherapy guide. It covers
      ${DATA.drugs.length} oral agents; nothing said here means a combination it does
      not carry is safe.</div>
  </div>`;
}

/* the long form, for the modal */
function detailHtml(alarms) {
  const as = alarms || [];
  const body = as.map((a) => `
    <div class="ixcard ${SEVCLASS[a.severity]}">
      <div class="ixcardhead"><span class="ixsev">${esc(a.severity)}</span>
        <b>${esc(a.agent)}</b>${a.agentBrand ? ` (${esc(a.agentBrand)})` : ''}
        with <b>${esc(a.target)}</b>
        <span class="ixcls">${esc(a.cls)}</span></div>
      <div class="ixsay"><b>${esc(label(a))}</b></div>
      <div class="ixwhy">${esc(a.why)}</div>
      <div class="ixdo"><b>What the guide says to do:</b> ${esc(a.manage)}</div>
      ${a.from === 'grid' ? '<div class="ixnote">This pair is in the guide\'s '
    + 'summary grid only — a letter with no monograph page behind it.</div>' : ''}
      <div class="ixon">On this order: ${esc(a.agentOn.label || a.agent)}
        &middot; ${esc(a.others.map((o) => o.label).join(' &middot; '))}</div>
      ${a.note ? `<div class="ixnote">Note on the source: ${esc(a.note)}</div>` : ''}
    </div>`).join('');
  return `<h3>Drug interactions on this order</h3>
    <div class="ixlist">${body || '<p>Nothing from the guide on this order.</p>'}</div>
    <p class="ixsrc">${esc(DATA.source)}</p>
    <p class="ixsrc"><b>This is a reminder, not a clearance.</b> The guide covers
      ${DATA.drugs.length} oral agents and the drugs listed against them. A
      combination it does not carry raises nothing here, and that is not the same
      as the combination being safe. Nothing on this screen changes a dose or a
      tick — every change stays the doctor's.</p>`;
}

/* ── THE CHILD'S ORAL CHEMOTHERAPY ─────────────────────────────────
 * 6 November 2026: "also add drug interaction warnings, according to
 * these files". The alarm existed, but twelve of the guide's thirteen oral
 * agents are not in the ward's drug list — 6-MP, etoposide capsules,
 * imatinib … arrive on chemotherapy sheets — so a child on 6-MP given
 * allopurinol or voriconazole on the ward raised nothing. The agents a
 * child takes are now kept on the child, and noted by themselves when a
 * chemotherapy sheet giving one BY MOUTH is printed or queued (an IV
 * etoposide line is not the guide's oral etoposide). */
const ORAL = /\bPO\b|\boral|orally|by mouth|بالفم|فموي|عن طريق الفم|اقراص|أقراص|قرص|كبسول/i;
function agentPatterns(d) {
  const out = [];
  try { if (d.en) out.push((t) => new RegExp(d.en, 'i').test(t)); } catch (e) { /* skipped */ }
  try { if (d.ar) { const re = new RegExp(norm(d.ar)); out.push((t) => re.test(norm(t))); } } catch (e) { /* skipped */ }
  if (d.short) {
    const s = d.short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^A-Za-z0-9])${s}([^A-Za-z0-9]|$)`, 'i');
    out.push((t) => re.test(t));
  }
  return out;
}
function oralAgentsIn(lines) {
  if (!DATA || !DATA.drugs) return [];
  const found = [];
  (lines || []).forEach((l) => {
    if (!l || l.type !== 'order') return;
    const t = `${l.raw || ''} ${l.english || ''}`;
    if (!ORAL.test(t)) return;
    DATA.drugs.forEach((d) => {
      if (found.indexOf(d.generic) < 0 && agentPatterns(d).some((f) => f(t))) found.push(d.generic);
    });
  });
  return found;
}
/* the agents kept on a child, as items the scan reads */
function oralItems(p) {
  if (!DATA || !DATA.drugs) return [];
  return ((p && p.oralChemo) || []).map((g) => DATA.drugs.find((d) => d.generic === g)).filter(Boolean)
    .map((d) => ({ en: `${d.generic} ${d.brand || ''}`, ar: '', label: `${d.generic} (this child's oral chemotherapy)`,
      source: 'the oral chemotherapy on the patient record' }));
}
const agents = () => ((DATA && DATA.drugs) || []).map((d) => ({ generic: d.generic, brand: d.brand, short: d.short }));

const Interactions = { oralAgentsIn, oralItems, agents, scan, bandHtml, detailHtml, counts, worst, setData, norm, hits,
  get data() { return DATA; } };
if (typeof window !== 'undefined') window.Interactions = Interactions;
if (typeof module !== 'undefined') module.exports = Interactions;

})();
