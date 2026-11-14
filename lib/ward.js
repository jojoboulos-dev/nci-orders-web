'use strict';
/* ══════════════════════════════════════════════════════════════════
 * THE WARD HANDOVER
 *
 * Dr Boulos, 24 October 2026, with the blank attached: "we'll rename the
 * button ICU handover to just handover, and when the user clicks it, it
 * will display a choice: ICU or Wards … this will be the handover,
 * patients data above are filled, also date of admission, the data below
 * is filled by the physician by typing, leave the labs part out, it will
 * be handwritten after printing. And add a button called copy handover,
 * that if pressed, copies the data in this format (not table) … in a
 * paragraph fasion for documentation purposes."
 *
 * HIS BLANK, COLUMN FOR COLUMN. Name, MRN, room, weight, height and age
 * across the top — and the admission date, which he asked for and the
 * blank has nowhere for. Then eight columns: the tall left-hand cell
 * (diagnosis, comorbidity, chemotherapy day, supportive), the date, and
 * per day Clinically, Lab, Imaging, Cultures, Medications and To-do.
 *
 * THE LAB COLUMN IS NOT TYPED. "leave the labs part out, it will be
 * handwritten after printing." So it prints with the blank's own
 * skeleton — the three obliques, Monos, CRP, Others — and the app never
 * asks for it. It is the one column the paper is better at.
 *
 * IMAGING AND CULTURES ARE THE LATEST, NOT A DAY'S. 24 October: "latest
 * only but they dont have to be done on admission, an echo can be done
 * before admission." So each carries its own date, which may be before
 * the stay began, and the two columns are one tall cell each rather than
 * a row per day — an echo from the week before admission must not be
 * made to look like one done on day three.
 *
 * SEVEN DAYS FROM ADMISSION, as the blank runs 1/9 to 7/9. A longer stay
 * prints a second sheet, and which week is a box on the screen.
 *
 * NOTHING IS INVENTED. A field nobody filled prints empty; the copy
 * paragraph leaves out the sentence it would have gone in rather than
 * writing "last CT chest: , ".
 *
 * Wrapped in an IIFE for the reason icu.js is: the renderer's scripts
 * share one global scope.
 * ══════════════════════════════════════════════════════════════════ */
(function () {

const DAYS = 7;                      /* rows on one sheet, as his blank has */

/* the ones he named, and the ones beside them on the request forms.
   They are SUGGESTIONS: the box takes anything typed into it, because
   the fifth thing is exactly the thing no list has. */
const IMAGING_KINDS = ['Echo', 'CT chest', 'CT abdomen', 'CT brain', 'PAUS',
  'Chest X-ray', 'MRI brain', 'Bone scan', 'PET-CT', 'Doppler'];
const CULTURE_KINDS = ['Rectal swab', 'Blood culture', 'Urine culture',
  'Throat swab', 'Nasal swab', 'CSF culture', 'Wound swab', 'Line tip',
  'Stool culture', 'Sputum culture'];

const txt = (v) => (v == null ? '' : String(v)).trim();
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ── what one patient's sheet holds ─────────────────────────────── */
function blank() {
  return {
    summary: '', supportive: '',
    ct: { date: '', finding: '' },
    echo: { date: '', finding: '' },
    rectal: { date: '', result: '' },
    blood: { date: '', result: '' },
    /* ── ANYTHING ELSE THAT WAS DONE ───────────────────────────
     * Dr Boulos, 24 October 2026: "add the option for additional
     * imaging, echo, CT, PAUS, or just free text, same with
     * cultures/swabs." Four boxes cover the week most children have;
     * the fifth thing is why a handover gets rewritten by hand. Each
     * extra carries its own name, its own date and its own finding,
     * and is printed under the two above it. */
    moreImaging: [],                  /* [{label, date, finding}] */
    moreCultures: [],                 /* [{label, date, result}] */
    days: {},                         /* ISO date → {clinically, meds, todo} */
    temps: [],                        /* [[ms, °C]] the last 7 days, from the HIS */
  };
}

/* every field is filled in, whatever an older saved sheet was missing */
function normalise(st) {
  const b = blank();
  const s = Object.assign(b, st || {});
  ['ct', 'echo'].forEach((k) => { s[k] = Object.assign({ date: '', finding: '' }, s[k]); });
  ['rectal', 'blood'].forEach((k) => {
    s[k] = Object.assign({ date: '', result: '' }, s[k]);
  });
  ['moreImaging', 'moreCultures'].forEach((k) => {
    s[k] = (Array.isArray(s[k]) ? s[k] : []).map((e) => Object.assign(
      { label: '', date: '', finding: '', result: '' }, e || {}));
  });
  s.days = Object.assign({}, s.days);
  s.temps = Array.isArray(s.temps) ? s.temps : [];
  return s;
}

/* ── THE TO-DO, WITH THE DAY'S CHEMOTHERAPY ON TOP ─────────────────
 * 7 November 2026: "always write chemo in the to do: 'asp today', 'ith
 * tomorrow', only today and tomorrow" — Schedule.chemoTodo. The lines are
 * worked out, not stored, and put above what was typed; one already typed
 * is not written twice. */
function chemoTodoFor(p, iso) {
  const { Schedule } = requires();
  try { return Schedule && Schedule.chemoTodo ? Schedule.chemoTodo(p, iso) : []; } catch (e) { return []; }
}
function todoText(p, d, iso, st) {
  const typed = txt((d || {}).todo);
  const low = typed.toLowerCase();
  /* "asp 7800 u today" is already there if "asp today" was typed */
  const base = (t) => t.replace(/ \(.*\)/, '').replace(/ [\d.,-]+ (mg|u)\b/, '');
  const auto = chemoTodoFor(p, iso).concat(st ? cultureTodoFor(st, iso) : []).filter((t) => low.indexOf(base(t)) < 0);
  return auto.concat(typed ? [typed] : []).join('\n');
}

/* ── BLOOD CULTURES ON FEVER ───────────────────────────────────────
 * Dr Boulos, 8 November 2026: "Blood culture is withdrawn at the first
 * fever, and any culture that is withdrawn on a fever must have a
 * follow-up blood culture. Cultures are withdrawn Saturday, Monday, and
 * Wednesday. If a patient is febrile on Saturday, we will withdraw a
 * culture on Saturday and Monday. If his only spike is on Saturday, we will
 * not withdraw any more cultures. If he's still febrile on Monday, we will
 * have to withdraw another culture on Wednesday. If a patient is febrile on
 * Sunday, we will withdraw a blood culture on Sunday. And then we will skip
 * Monday and withdraw the follow-up blood culture on Wednesday".
 *
 * Walked day by day over the fever days (06:00 to 06:00, feverDays):
 *  - the first fever (the day before without fever, no follow-up waiting):
 *    a blood culture that day, whatever the day;
 *  - a culture taken on a fever day: a follow-up on the next culture day
 *    (Saturday, Monday, Wednesday) at least two days later — Saturday →
 *    Monday, Sunday → Wednesday, Monday → Wednesday, Wednesday → Saturday;
 *  - the follow-up day: a culture; febrile that day, another follow-up;
 *    without fever, no more.
 * Returns { take: { iso: 'first' | 'follow-up' }, next } — next is the
 * follow-up still to come, if any. A day with no reading counts as without
 * fever. */
const CULTURE_DAYS = [6, 1, 3];                     // Saturday, Monday, Wednesday
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const plusDays = (iso, n) => isoDay(Date.parse(`${iso}T00:00:00Z`) + n * 86400000);
function nextCultureDay(iso) {
  for (let n = 2; n < 9; n++) { const d = plusDays(iso, n); if (CULTURE_DAYS.indexOf(dow(d)) >= 0) return d; }
  return null;
}
function bloodCulturePlan(temps, nowMs) {
  const fd = feverDays(temps, nowMs);
  const take = {};
  let next = null;
  fd.days.forEach((day, i) => {
    const iso = isoDay(day.start);
    if (next && iso === next) {
      take[iso] = 'follow-up';
      next = day.febrile ? nextCultureDay(iso) : null;
      return;
    }
    const first = day.febrile && !next && !(i > 0 && fd.days[i - 1].febrile);
    if (first) { take[iso] = 'first'; next = nextCultureDay(iso); }
  });
  return { take, next };
}
/* the to-do lines: today's culture, and tomorrow's follow-up a day ahead */
function cultureTodoFor(st, iso, nowMs) {
  const temps = (st && st.temps) || [];
  if (!temps.length) return [];
  const plan = bloodCulturePlan(temps, nowMs);
  const out = [];
  if (plan.take[iso] === 'first') out.push('blood culture today (first fever)');
  else if (plan.take[iso] === 'follow-up' || plan.next === iso) out.push('follow-up blood culture today');
  if (plan.next === plusDays(iso, 1)) out.push('follow-up blood culture tomorrow');
  return out;
}

/* ── THE CULTURES, IN THE WARD'S ORDER ───────────────────────────
 * Dr Boulos, 7 November 2026: "always arrange cultures: Swabs: nasal and
 * rectal, then Blood, by date, then non blood (stool/urine/wound swabs/pus
 * cultures...)".
 *
 * One list from the two fixed boxes (rectal swab, blood culture) and every
 * extra: first the screening swabs — nasal, then rectal — then the blood
 * cultures, then everything else (stool, urine, wound swab, pus, throat,
 * CSF, line tip …). Inside each group by date, oldest first; an undated
 * one after the dated. Empty entries are left out. */
function cultureRank(label) {
  const l = txt(label).toLowerCase();
  if (/nasal|nose|anf|انف/.test(l)) return 0;
  if (/rectal|recta|شرج/.test(l)) return 1;
  if (/blood|\bbc\b|haemoculture|hemoculture|دم/.test(l)) return 2;
  return 3;
}
/* ── THE IMAGING, BY KIND AND BY DATE ─────────────────────────────
 * 11 November 2026, Dr Boulos: "please make sure Imagings of different
 * modalities are separated by a space, and are arranged chronologically,
 * both, in the handover window and the PDF". Every scan — the last CT
 * chest, the last echo and the others — in one list: grouped by modality
 * (echo, CT, MRI, X-ray, ultrasound, …), the groups in the order their
 * first scan was done, each group oldest to newest, a scan with no date
 * at the end of its group. `gap` marks the first of each group after the
 * first, where the space goes. */
function imagingKindOf(label) {
  const l = txt(label).toLowerCase();
  if (!l) return '';
  if (/echo|ايكو/.test(l)) return 'echo';
  if (/pet/.test(l)) return 'pet';
  if (/\bct\b|computed|اشعة مقطعية/.test(l)) return 'ct';
  if (/mri|magnetic|رنين/.test(l)) return 'mri';
  if (/x-?ray|cxr|\bxr\b|اشعة عادية/.test(l)) return 'xray';
  if (/paus|\bus\b|u\/s|ultra|sono|doppler|سونار/.test(l)) return 'us';
  if (/bone scan|scintig|\bmibg\b/.test(l)) return 'nuclear';
  return l;
}
function imagingList(st, opts) {
  const s = st || {};
  const blanks = !!(opts && opts.blanks);
  const all = [];
  const ct = s.ct || {};
  if (blanks || txt(ct.date) || txt(ct.finding)) all.push({ label: 'CT chest', fixed: 'ct', date: txt(ct.date), finding: txt(ct.finding) });
  const ec = s.echo || {};
  if (blanks || txt(ec.date) || txt(ec.finding)) all.push({ label: 'Echo', fixed: 'echo', date: txt(ec.date), finding: txt(ec.finding) });
  (s.moreImaging || []).forEach((e, i) => {
    if (!e || !(txt(e.label) || txt(e.date) || txt(e.finding))) return;
    all.push({ label: txt(e.label), date: txt(e.date), finding: txt(e.finding), more: i });
  });
  const byDate = (a, c) => (a.date ? 0 : 1) - (c.date ? 0 : 1)
    || (a.date < c.date ? -1 : a.date > c.date ? 1 : 0) || a.i - c.i;
  all.forEach((e, i) => { e.i = i; e.kind = imagingKindOf(e.label) || `other${i}`; });
  const first = {};
  all.slice().sort(byDate).forEach((e, n) => { if (!(e.kind in first)) first[e.kind] = n; });
  const out = all.sort((a, c) => first[a.kind] - first[c.kind] || byDate(a, c));
  out.forEach((e, n) => { e.gap = n > 0 && out[n - 1].kind !== e.kind; });
  return out;
}

/* every echo the handover holds: the last echo's box, the other scans
   named echo, and an echo written into a day's Clinically or Lab box
   ("echo done", "echo: EF 60%") — the day it was written on */
function echoDates(st0) {
  const st = st0 || {};
  const out = [];
  if (txt(st.echo && st.echo.date)) out.push(txt(st.echo.date));
  (st.moreImaging || []).forEach((e) => { if (e && imagingKindOf(e.label) === 'echo' && txt(e.date)) out.push(txt(e.date)); });
  Object.keys(st.days || {}).forEach((iso) => {
    const d = st.days[iso] || {};
    if (/\becho\b|ايكو/i.test(`${d.clinically || ''} ${d.labs || ''}`)) out.push(iso);
  });
  return out;
}

function cultureList(st, opts) {
  const s = st || {};
  const all = [];
  /* `blanks`: the printed sheet keeps its two fixed boxes even when empty,
     as places to write by hand */
  const blanks = !!(opts && opts.blanks);
  const r = s.rectal || {};
  if (blanks || txt(r.date) || txt(r.result)) all.push({ label: 'Rectal swab', fixed: 'rectal', date: txt(r.date), result: txt(r.result), final: txt(r.final) });
  const b = s.blood || {};
  if (blanks || txt(b.date) || txt(b.result)) all.push({ label: 'Blood culture', fixed: 'blood', date: txt(b.date), result: txt(b.result), final: txt(b.final) });
  (s.moreCultures || []).forEach((e) => {
    if (!e || !(txt(e.label) || txt(e.date) || txt(e.result))) return;
    all.push({ label: txt(e.label), date: txt(e.date), result: txt(e.result), final: txt(e.final) });
  });
  return all.map((e, i) => Object.assign(e, { rank: cultureRank(e.label), i }))
    .sort((a, c) => a.rank - c.rank
      || (a.date ? 0 : 1) - (c.date ? 0 : 1)
      || (a.date < c.date ? -1 : a.date > c.date ? 1 : 0)
      || a.i - c.i);
}

/* ── A CULTURE OF HIS, FINISHED ON THE HIS ──────────────────────────
 * 12 November 2026, Dr Boulos: "the cultures should get back to the
 * culture section in the software, not the handover print, if i have a
 * culture added to the app and NS or P, and it finalized, it should be
 * marked as finalized for me to check in the app, and the dialogue box
 * should stay the same, but the print should only show what I add."
 * Nothing is added to his cultures and nothing he typed is changed: a
 * culture he added whose result is NS, P or empty, of the kind the HIS has
 * finished (taken up to 6 days before), is flagged final (e.final = the
 * day) — shown in the app ("Finalised — check HIS"), never printed. The
 * HIS's other cultures are left to the dialogue box (cultureNeedsAlarm).
 * Returns the ones newly flagged. `pendings` is not used any more. */
const CULT_LABEL = { blood: 'Blood culture', rectal: 'Rectal swab', nasal: 'Nasal swab', urine: 'Urine culture', throat: 'Throat swab', csf: 'CSF culture', stool: 'Stool culture', sputum: 'Sputum culture', wound: 'Wound swab' };
function applyCultures(st, finals) {
  st.rectal = Object.assign({ date: '', result: '' }, st.rectal);
  st.blood = Object.assign({ date: '', result: '' }, st.blood);
  st.moreCultures = Array.isArray(st.moreCultures) ? st.moreCultures : [];
  const entries = (kind) => [].concat(
    kind === 'rectal' && st.rectal.date ? [st.rectal] : [],
    kind === 'blood' && st.blood.date ? [st.blood] : [],
    st.moreCultures.filter((e) => e && cultureKindOf(e.label) === kind));
  const newly = [];
  (finals || []).forEach((c) => {
    const kind = cultureKindOf(c.name);
    if (!kind || !c.iso) return;
    if (entries(kind).some((x) => x.final === c.iso)) return;
    const from = addDays(c.iso, -6);
    const open = entries(kind).filter((e) => e.date && e.date >= from && e.date <= c.iso && !e.final
      && ['', 'P', 'NS'].indexOf(resultKind(e.result)) >= 0).sort((a, b) => (a.date < b.date ? 1 : -1));
    const e = open[0];
    if (!e) return;
    e.final = c.iso;
    newly.push({ name: CULT_LABEL[kind] || txt(e.label) || txt(c.name), date: e.date, final: c.iso });
  });
  return newly;
}
/* "check HIS" put in a result by the version before this one goes back to P */
function undoCheckHis(st) {
  let n = 0;
  ['rectal', 'blood'].forEach((k) => { if (st[k] && /^check HIS$/i.test(txt(st[k].result))) { st[k].result = 'P'; n++; } });
  (st.moreCultures || []).forEach((e) => { if (e && /^check HIS$/i.test(txt(e.result))) { e.result = 'P'; n++; } });
  return n;
}

/* ── A CULTURE'S RESULT, AND WHEN A FINALISED ONE ALARMS ────────────
 * Dr Boulos, 8 November 2026: "culture results are either NG, P, NS,
 * organism, alarm me for cultures that are not in the handover, or P, or
 * NS, and make the result a choice, if organism, free text / cultures that
 * finalized and are in the handover as NG or an organism, no need to alarm
 * me". A result is NG, P or NS, or the organism's name. A culture the HIS
 * has finalised alarms only when the handover has no culture of its kind
 * dated up to 4 days before it, or has one that is P, NS or still blank. */
const CULTURE_CODES = ['NG', 'P', 'NS'];
function resultKind(r) {
  const t = txt(r);
  if (!t) return '';
  if (/^ng$|no growth/i.test(t)) return 'NG';
  if (/^p$|^pending$/i.test(t)) return 'P';
  if (/^ns$/i.test(t)) return 'NS';
  return 'organism';
}
/* which kind of culture a name is: blood, rectal, nasal, urine, … */
function cultureKindOf(name) {
  const n = txt(name).toLowerCase();
  if (/blood|b\/c\b|\bbc\b/.test(n)) return 'blood';
  if (/rect|anal|peri-?anal/.test(n)) return 'rectal';
  if (/nas|nose|mrsa/.test(n)) return 'nasal';
  if (/urin/.test(n)) return 'urine';
  if (/throat|pharyn/.test(n)) return 'throat';
  if (/stool|fec|faec/.test(n)) return 'stool';
  if (/csf/.test(n)) return 'csf';
  if (/sputum|bal\b|tracheal/.test(n)) return 'sputum';
  if (/wound|pus|abscess/.test(n)) return 'wound';
  if (/line|tip|catheter/.test(n)) return 'line';
  return n.replace(/culture|&|sensitivity|c\/s|swab|[0-9]/g, '').trim() || 'culture';
}
function cultureNeedsAlarm(st, c) {
  const iso = txt(c && c.iso);
  const kind = cultureKindOf(c && c.name);
  const from = iso ? new Date(Date.parse(`${iso}T00:00:00Z`) - 4 * 86400000).toISOString().slice(0, 10) : '';
  const mine = cultureList(st).filter((e) => (e.fixed || cultureKindOf(e.label)) === kind
    && (!iso || !e.date || (e.date >= from && e.date <= iso)));
  if (!mine.length) return { alarm: true, why: 'not in the handover' };
  /* the one it is: the same date, or else the latest before it */
  const e = mine.find((x) => x.date === iso) || mine.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const k = resultKind(e.result);
  if (k === 'NG' || k === 'organism') return { alarm: false };
  return { alarm: true, why: `the handover says ${k || 'nothing yet'}` };
}

/* ── STOP THE G-CSF? ────────────────────────────────────────────────
 * Dr Boulos, 7 November 2026: "Suggest to discontinue Neopogen or GCSF when
 * ANC is above 1000."
 *
 * A suggestion, never an action: nothing is unticked. It is made when a
 * G-CSF is ticked on the child's order (by any of its names, the ward's
 * list calls it "GM-CSF (Neupogen)") and TODAY's Lab box has a CBC whose
 * ANC — the second figure of (WBC/ANC/Hb/PLT) — is above 1000. The HIS
 * gives the ANC in 10^9/L (0.58 is 580), so a figure under 100 is read that
 * way and one of 100 or more as cells per µL; "-" is 0. No CBC today, no
 * suggestion: yesterday's count is not today's. */
const GCSF = /neupo|neopo|filgra|\bg-?csf\b|gm-?csf|granocyte|leucostim|lenogra|نيبوجن|نيوبوجين|نيوبوجن/i;
function ancOf(labs) {
  const m = /\(\s*([^()/\n]*)\/([^()/\n]*)\/([^()/\n]*)\/([^()/\n]*)\)/.exec(txt(labs));
  if (!m) return null;
  const v = m[2].replace(/\*/g, '').trim();
  if (v === '-') return 0;
  const n = parseFloat(v.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n < 100 ? n * 1000 : n);
}
function gcsfAdvice(patient, order, drugs, labsToday) {
  const sel = (order && order.sel) || {};
  const d = (drugs || []).find((x) => sel[x.id] && sel[x.id].on && GCSF.test(`${x.name_en || ''} ${x.short_en || ''} ${x.ar_name || ''}`));
  if (!d) return null;
  const anc = ancOf(labsToday);
  if (anc == null || !(anc > 1000)) return null;
  const name = (/neupogen/i.test(d.name_en || '') ? 'Neupogen' : txt(d.short_en) || txt(d.name_en) || 'G-CSF');
  return { drug: d, name, anc, text: `ANC ${anc.toLocaleString('en-US')} today — consider stopping ${name}` };
}

/* ── ZYLORIC, EPICOGEL, RENAGEL; LOKELMA ─────────────────────────────
 * Dr Boulos, 8 November 2026: "suggest to stop zylroic, epicogel, renagel
 * if PO4 and UA are normal or low, suggest to stop antihyperkalemic if K
 * is normal or low"; "suggest the opposite if the opposite". From today's
 * K, PO4 and uric acid as the HIS's ranges call them (HisLabs.levels, kept
 * on the day as `levels` when the labs are read); nothing when a value was
 * not done today. Suggestions only: nothing is ticked or unticked. */
const ANTILYSIS = /zyloric|allopurinol|epicogel|renagel|sevelamer/i;
const ANTI_K = /lokelma|kayexalate|resonium|sorbisterit|patiromer|veltassa/i;
function lysisAdvice(order, drugs, lv) {
  const l = lv || {};
  const sel = (order && order.sel) || {};
  const on = (re) => (drugs || []).filter((d) => sel[d.id] && sel[d.id].on && re.test(`${d.name_en || ''} ${d.short_en || ''}`));
  const nm = (d) => txt(d.short_en) || txt(d.name_en);
  const out = [];
  const lys = on(ANTILYSIS);
  if (l.po4 && l.ua) {
    const quiet = l.po4 !== 'high' && l.ua !== 'high';
    if (quiet && lys.length) out.push(`PO4 ${l.po4Value} and UA ${l.uaValue} not high — consider stopping ${lys.map(nm).join(', ')}`);
  }
  if (l.ua === 'high' && !lys.some((d) => /zyloric|allopurinol/i.test(nm(d)))) out.push(`UA ${l.uaValue} high — consider Zyloric`);
  if (l.po4 === 'high' && !lys.some((d) => /epicogel|renagel|sevelamer/i.test(nm(d)))) out.push(`PO4 ${l.po4Value} high — consider Epicogel / Renagel`);
  const ak = on(ANTI_K);
  if (l.k && l.k !== 'high' && ak.length) out.push(`K ${l.kValue} not high — consider stopping ${ak.map(nm).join(', ')}`);
  if (l.k === 'high' && !ak.length) out.push(`K ${l.kValue} high — consider Lokelma`);
  return out;
}

/* ── A WEEK OF TEMPERATURES, AND ITS CHART ─────────────────────────
 * Dr Boulos, 7 November 2026: "recover fever of the last week and show a
 * chart for review, on both windows and android".
 *
 * Every temperature the HIS's Observations grid gives (Fever from HIS,
 * Prepare the ward — on a PC, or for the phone) is kept on the child's
 * handover as `temps`: [[ms, °C], …], the last 7 days only, one reading
 * per time. The times are the HIS's own wall-clock times (parseObsWhen),
 * and "now" is taken the same way, so the week ends where the ward's clock
 * says. Kept with the child, so it travels to the phone with the ward.
 *
 * The chart: the 7 days left to right, 35 to 41 °C (wider if a reading
 * is), a red line at 38.3; a reading above 38.3 a red dot. 7 November
 * 2026: "make the temprature cut off 38.3 and define fever days: 6 am to 6
 * am next day, any spike abobe 38.3 is a fever, count fever days below the
 * graph, or afebrile days if afebrile" — the days on the chart run 06:00 to
 * 06:00, each marked under the graph (red: a fever that day), and under
 * them "Fever day 3" or "Afebrile day 2" (feverDays). An SVG string, drawn
 * the same on the PC and the phone. */
/* 9 November 2026, Dr Boulos: "read fever from 38C, not 38.3" — a reading of 38.0 or more is fever */
const FEVER_C = 38;
const DAY_MS = 86400000;
const SIX_MS = 6 * 3600000;
/* the fever day a time falls in: the 06:00 that opens it (wall-clock ms) */
const feverDayStart = (ms) => Math.floor((ms - SIX_MS) / DAY_MS) * DAY_MS + SIX_MS;
/* every fever day from the first reading to now, and where today stands:
   { days: [{ start, febrile, max }], febrile, count, since } — count is
   how many fever days in a row up to today (febrile), or how many without
   fever since the last one (afebrile; since the first reading when there
   was none, `since` then null). A day with no reading counts as afebrile. */
function feverDays(temps, nowMs) {
  const now = nowMs == null ? wallNow() : nowMs;
  const pts = (temps || []).map((x) => (Array.isArray(x) ? x : [x.ms, x.t])).filter((x) => x[0] <= now + 3600000);
  if (!pts.length) return { days: [], febrile: false, count: 0, since: null };
  const first = feverDayStart(Math.min(...pts.map((x) => x[0])));
  const today = feverDayStart(now);
  const days = [];
  for (let d = first; d <= today; d += DAY_MS) {
    const inDay = pts.filter((x) => x[0] >= d && x[0] < d + DAY_MS);
    const max = inDay.length ? Math.max(...inDay.map((x) => x[1])) : null;
    days.push({ start: d, febrile: max != null && max >= FEVER_C, max });
  }
  const last = days[days.length - 1];
  let i = days.length - 1;
  while (i >= 0 && days[i].febrile === last.febrile) i--;
  const since = last.febrile ? days[i + 1].start : (i >= 0 ? days[i].start : null);
  /* afebrile now: how many fever days the fever before it lasted */
  let j = i;
  while (j >= 0 && days[j].febrile) j--;
  const before = last.febrile ? 0 : i - j;
  return { days, febrile: last.febrile, count: days.length - 1 - i, since, before, start: last.febrile ? days[i + 1].start : null };
}
const feverDaysText = (fd) => (!fd || !fd.days.length ? ''
  : fd.febrile ? `Fever day ${fd.count}`
    : `Afebrile day ${fd.count}${fd.since == null ? ' (no fever recorded)' : fd.before ? ` (after ${fd.before} day${fd.before > 1 ? 's' : ''} of fever)` : ''}`);

/* ── FEVER DAY 5 ──────────────────────────────────────────────────
 * Dr Boulos, 7 November 2026: "I have to know how many days he was febrile
 * for, at day 5, suggest CT chest and voriconazole if he is not already on
 * them". From the fifth fever day in a row (feverDays): a CT chest unless
 * one is recorded on or after the day this fever began (the handover's
 * LAST CT CHEST), and voriconazole unless it is ticked on today's order. A
 * suggestion only — nothing is ordered or booked. */
const VORI = /vori|vfend|فوري/i;
const isoOfMs = (ms) => new Date(ms).toISOString().slice(0, 10);
function feverAdvice(st, order, drugs, nowMs) {
  const fd = feverDays((st && st.temps) || [], nowMs);
  if (!fd.febrile || fd.count < 5) return null;
  const sel = (order && order.sel) || {};
  const onVori = (drugs || []).some((x) => sel[x.id] && sel[x.id].on && VORI.test(`${x.name_en || ''} ${x.short_en || ''} ${x.ar_name || ''}`));
  const ct = txt(st && st.ct && st.ct.date);
  const ctDone = /^\d{4}-\d{2}-\d{2}/.test(ct) && ct.slice(0, 10) >= isoOfMs(fd.start);
  const want = [ctDone ? '' : 'CT chest', onVori ? '' : 'voriconazole'].filter(Boolean);
  if (!want.length) return null;
  return { day: fd.count, ct: !ctDone, vori: !onVori, text: `Fever day ${fd.count} — consider ${want.join(' and ')}` };
}
const WEEK_MS = 7 * 86400000;
/* 7 November 2026: "I have to know how many days he was febrile for" — a
   fever can outlast the chart's week, so three weeks are kept; the chart
   still shows seven days */
const KEEP_MS = 21 * 86400000;
const wallNow = (d0) => { const d = d0 || new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()); };
function addTemps(st, readings, nowMs) {
  const now = nowMs == null ? wallNow() : nowMs;
  const m = new Map(((st && st.temps) || []).map((x) => [x[0], x]));
  (readings || []).forEach((r) => {
    const ms = Array.isArray(r) ? r[0] : r && r.ms;
    const t = Array.isArray(r) ? r[1] : r && r.t;
    if (Number.isFinite(ms) && Number.isFinite(t) && t > 30 && t < 45) m.set(ms, [ms, t]);
  });
  st.temps = Array.from(m.values()).filter((x) => x[0] >= now - KEEP_MS && x[0] <= now + 3600000)
    .sort((a, b) => a[0] - b[0]);
  return st.temps.length;
}
function feverChartSvg(temps, nowMs, opts) {
  const o = Object.assign({ w: 640, h: 222 }, opts || {});
  const now = nowMs == null ? wallNow() : nowMs;
  const from = now - WEEK_MS;
  const pts = (temps || []).map((x) => (Array.isArray(x) ? x : [x.ms, x.t])).filter((x) => x[0] >= from && x[0] <= now + 3600000);
  const L = 34, Rr = 10, T = 22, B = 46;
  const W = o.w - L - Rr, H = o.h - T - B;
  const lo = Math.min(35, ...pts.map((x) => Math.floor(x[1]))), hi = Math.max(41, ...pts.map((x) => Math.ceil(x[1])));
  const X = (ms) => L + ((ms - from) / WEEK_MS) * W;
  const Y = (t) => T + (1 - (t - lo) / (hi - lo)) * H;
  const f1 = (n) => Math.round(n * 10) / 10;
  const max = pts.length ? Math.max(...pts.map((x) => x[1])) : null;
  const spikes = pts.filter((x) => x[1] >= FEVER_C).length;
  const fd = feverDays(pts, now);
  const title = pts.length
    ? `Temperature, last 7 days — ${pts.length} reading${pts.length > 1 ? 's' : ''}, highest ${max} °C${spikes ? `, ${spikes} at ${FEVER_C} or more` : ''}`
    : 'Temperature, last 7 days — no readings from the HIS yet';
  const parts = [`<svg class="feverchart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.w} ${o.h}" width="100%" role="img" aria-label="${esc(title)}">`,
    `<text x="${L}" y="14" font-size="12" font-weight="600" fill="#17242b">${esc(title)}</text>`,
    `<rect x="${L}" y="${T}" width="${W}" height="${H}" fill="#fafbfc" stroke="#dfe6ea"/>`];
  for (let t = lo; t <= hi; t++) {
    parts.push(`<text x="${L - 5}" y="${f1(Y(t) + 4)}" font-size="10" text-anchor="end" fill="#5f6f78">${t}</text>`);
    parts.push(`<line x1="${L}" x2="${L + W}" y1="${f1(Y(t))}" y2="${f1(Y(t))}" stroke="#eef1f3"/>`);
  }
  /* the fever days: a line at each 06:00, the date under its day, and a
     mark — red F for a day with fever, green for a day without */
  for (let ms = feverDayStart(from); ms <= now; ms += DAY_MS) {
    const a = Math.max(ms, from), b = Math.min(ms + DAY_MS, now);
    if (b <= a) continue;
    if (ms >= from) parts.push(`<line x1="${f1(X(ms))}" x2="${f1(X(ms))}" y1="${T}" y2="${T + H}" stroke="#e3e8ec"/>`);
    const d = new Date(ms);
    const lx = X((a + b) / 2);
    parts.push(`<text x="${f1(lx)}" y="${T + H + 13}" font-size="10" text-anchor="middle" fill="#5f6f78">${d.getUTCDate()}/${d.getUTCMonth() + 1}</text>`);
    const day = fd.days.find((x) => x.start === ms);
    if (day && (b - a) > DAY_MS / 4) {
      parts.push(day.febrile
        ? `<text x="${f1(lx)}" y="${T + H + 26}" font-size="10" font-weight="700" text-anchor="middle" fill="#c0392b">F ${day.max}</text>`
        : `<text x="${f1(lx)}" y="${T + H + 26}" font-size="10" text-anchor="middle" fill="#226b3c">${day.max == null ? '·' : 'afebrile'}</text>`);
    }
  }
  if (fd.days.length) {
    parts.push(`<text x="${L}" y="${o.h - 4}" font-size="12" font-weight="700" fill="${fd.febrile ? '#c0392b' : '#226b3c'}">${esc(feverDaysText(fd))}</text>`);
  }
  parts.push(`<line x1="${L}" x2="${L + W}" y1="${f1(Y(FEVER_C))}" y2="${f1(Y(FEVER_C))}" stroke="#c0392b" stroke-dasharray="4 3"/>`);
  if (pts.length > 1) parts.push(`<polyline fill="none" stroke="#0d5f6b" stroke-width="1.6" points="${pts.map((x) => `${f1(X(x[0]))},${f1(Y(x[1]))}`).join(' ')}"/>`);
  pts.forEach((x) => {
    const c = x[1] >= FEVER_C ? '#c0392b' : '#0d5f6b';
    const d = new Date(x[0]);
    parts.push(`<circle cx="${f1(X(x[0]))}" cy="${f1(Y(x[1]))}" r="${x[1] >= FEVER_C ? 4 : 2.8}" fill="${c}"><title>${x[1]} °C — ${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}</title></circle>`);
  });
  parts.push('</svg>');
  return parts.join('');
}

/* ── THE MEDICATIONS COME OFF THE ORDER ──────────────────────────
 * Dr Boulos, 24 October 2026: "auto retrieve drugs from orders."
 *
 * The same set the ICU handover takes, chosen the same way — every
 * antibiotic with the day it is on, plus whatever the ORDER ticked
 * across for the handover. 14 October: "The tick box to select handover
 * drugs should be in the doctor orders sheet not the handover", and
 * that decision is not made twice.
 *
 * It is a SUGGESTION. The moment somebody types in the cell it is
 * theirs, because a handover is written by a person who knows something
 * the order does not.
 */
function requires() {
  const w = typeof window !== 'undefined' ? window : {};
  const have = (name) => w[name]
    || (typeof module !== 'undefined' && typeof require === 'function'
      ? require(`./${name.toLowerCase()}.js`) : null);
  return { Icu: have('Icu'), Sheet: have('Sheet'), Schedule: have('Schedule') };
}

/* ── THE FLUIDS, PER EIGHT HOURS ─────────────────────────────────
 * Dr Boulos, 31 October 2026: "fluids given and im wards use /8 form:
 * (hyperhydration 80%: 500ml/8hr)".
 *
 * The ICU sheet says ml/hr because an ICU nurse sets a pump. A ward
 * nurse hangs a bag for a shift, and the figure she needs is the volume
 * for that shift. It is the same plan, read per eight hours instead of
 * per hour, in the shape he wrote it in.
 */
function fluidPer8(sel, patient, S) {
  if (!S || !S.fluidPlan) return '';
  const plan = S.fluidPlan(sel, patient);
  if (!plan || plan.mlPerHour == null) return '';
  const REG = { maint: 'maintenance', maint_deficit: 'maintenance + deficit',
    hyper: 'hyperhydration', insensible: 'insensible losses' };
  const f = (sel && sel.fluid) || {};
  const name = REG[f.regimen || 'maint'] || 'maintenance';
  const pct = plan.share === 1 ? '' : ` ${S.round1(plan.share * 100)}%`;
  const restr = plan.restricted ? ', fluid restriction' : '';
  return `(${name}${pct}${restr}: ${S.fmtDose(plan.mlPerHour * 8)}ml/8hr)`;
}

/* ── WHAT THE MEDICATIONS CELL IS FILLED WITH ────────────────────
 * Dr Boulos, 31 October 2026: "retrieve drugs in ward handover the same
 * way in ICU, all drugs name, dose if modifiable, fluids given and im
 * wards use /8 form".
 *
 * THE ONES TICKED FOR THE HANDOVER, and only those. 1 November 2026:
 * "Only show the drugs marked for handover in the doctor's orders
 * window. In the handover window. Right now the ward handover shows all
 * recorded drugs in the doctor's orders." On 31 October this took every
 * drug on the order, on the reading that a ward sheet is the whole of
 * what a child is on; having used it, he wants what the ICU sheet uses —
 * the decision made drug by drug on the order, where it is made, by
 * somebody who knows which of fourteen lines the next shift needs. The
 * tick lives on the order (14 October) and is read here, never asked
 * twice. Every antibiotic still goes: it has no tick to argue with.
 *
 * THE DOSE, WHERE IT CAN BE CHANGED. "dose if modifiable". A drug with
 * one dose needs no number here — it is on the order sheet beside this
 * one. A drug whose dose the physician chose inside a band, or an
 * infusion with a rate, carries that choice, because the next shift
 * cannot work out which end of the band was meant.
 *
 * AND THE DAY, FROZEN. "when recording drugs, record days given to drugs
 * on retrieve button click." D3 tazocin becomes D4 tomorrow, and the
 * figure that belongs on Tuesday's row is the one that was true on
 * Tuesday. The retrieve button writes TEXT into one day's cell, so the
 * count is fixed at the moment it is pressed and the row does not
 * silently re-count itself afterwards.
 */
/* ── HELD FOR ONE DAY ─────────────────────────────────────────────
 * 13 November 2026, Dr Boulos: "Add the option to hold the drug just for
 * today. There should be a hold button in front of it." A held drug stays
 * ticked; on its day it is left off the sheet and the handover, and the
 * next day it is back by itself. order.hold = { drugId: 'YYYY-MM-DD' }. */
function heldOn(order, id, iso) { return !!(order && order.hold && order.hold[id] === iso); }
/* "add the hold suggestions according to the drug interactions data …
   Voriconazole should be held on the days that there are vincristine or
   doxorubicin. Klaxan, obviously, and all anticoagulants should be held 24
   hours and 24 hours after intrathecals. So when scheduled intrathecals, if
   there is low molecular weight heparin, it should be held the day before,
   not the day after." So: voriconazole on a vincristine or doxorubicin day;
   an anticoagulant the day before an intrathecal and on its day; and the
   oral chemotherapy guide's "avoid combination" (X) pairs, the other drug
   held. Only suggestions: nothing is held until Hold today is pressed. */
const VORI_RE = /voricon|vfend|فيفند|فوريكونازول/i;
const ANTICOAG_RE = /enoxaparin|clexane|كليكسان|heparin|هيبارين|fondaparinux|tinzaparin|dalteparin|\blmwh\b|warfarin|marevan|rivaroxaban|xarelto|apixaban|eliquis|dabigatran|pradaxa/i;
const ITH_RE = /حقن[ةه]\s+الظهر|intrathecal|\bITH\b/i;
const VCR_RE = /[اأإ]ونكوفين|فينكريستين|vincristine|oncovin/i;
const DOXO_RE = /[اأإ]درياميسين|دوكسوروبيسين|doxorubicin|adriamycin/i;
/* the lines due that day, without the day-before reminders ("… غدا …") */
const onTheDay = (lines) => (lines || []).map((t) => String(t || '')).filter((t) => t && !/غدا/.test(t));
function holdSuggestions(o) {
  const out = [];
  const add = (d, why) => { if (!out.some((x) => x.id === d.id)) out.push({ id: d.id, name: d.name, why }); };
  const today = onTheDay(o.dueToday);
  const tomorrow = onTheDay(o.dueTomorrow);
  const vcr = today.some((t) => VCR_RE.test(t));
  const doxo = today.some((t) => DOXO_RE.test(t));
  const ithToday = today.some((t) => ITH_RE.test(t));
  const ithTomorrow = tomorrow.some((t) => ITH_RE.test(t));
  (o.drugs || []).forEach((d) => {
    const n = `${d.name || ''} ${d.ar || ''}`;
    if (VORI_RE.test(n) && (vcr || doxo)) add(d, `${[vcr && 'vincristine', doxo && 'doxorubicin'].filter(Boolean).join(' and ')} today`);
    if (ANTICOAG_RE.test(n)) {
      if (ithToday) add(d, 'intrathecal today');
      else if (ithTomorrow) add(d, 'intrathecal tomorrow — held from the day before');
    }
  });
  (o.ix || []).filter((a) => a && a.severity === 'X').forEach((a) => {
    const lbl = a.targetOn && a.targetOn.label;
    const d = (o.drugs || []).find((x) => x.name === lbl);
    if (d) add(d, `with ${a.agent}: avoid the combination (oral chemotherapy guide)`);
  });
  return out;
}
function drugsFromOrder(patient, order, drugs, forDate) {
  const { Icu: I, Sheet: S } = requires();
  const sel = (order && order.sel) || {};
  /* ── LESS ON THE CELL ─────────────────────────────────────────
   * Dr Boulos, 2 November 2026: "The medication is too cluttery. Just say
   * names and days of antibiotics, and then say the drugs which have been
   * ticked in the handover. Don't mention the doses unless it's
   * modifiable."
   *
   * So the cell is two runs, in that order: the antibiotics, each as its
   * day and its name, then everything else the order ticked across. An
   * antibiotic carries no RD/HD mark and no dose unless the dose is one the
   * physician chose; an infusion carries the rate it was set at and not
   * the ml/hr worked out from it; the bag stays in the shift form he asked
   * for on 31 October. */
  const abx = [];
  const rest = [];
  const name = (d) => (I && I.shortName ? I.shortName(d) : '')
    || txt(d.short_en) || txt(d.name_en);
  /* the adjustable dose, short: "20 mg/kg q8h" rather than "LD 30, then
     20 mg/kg/dose q8h" — the loading dose was given on day one */
  const spec = (d, s) => {
    const full = S && S.adjustableSpec ? txt(S.adjustableSpec(d, s)) : '';
    return full.replace(/^LD [^,]*, then /, '').replace(/\/dose\b/, '');
  };
  /* which drugs the ORDER sent across, and their three defaults — every
     antibiotic always, sedation and inotropes and the fluids unless
     unticked, the everyday supportives only if ticked. icu.js owns that
     question and is asked, not re-implemented. */
  const picked = {};
  if (I && I.icuCandidates && I.icuPicked) {
    try {
      (I.icuCandidates(patient, order, drugs, forDate) || []).forEach((c) => {
        if (I.icuPicked(order, c)) picked[c.id] = true;
      });
    } catch (e) { /* an order the handover cannot read sends nothing across */ }
  }
  let fluid = '';
  (drugs || []).forEach((d) => {
    const s = sel[d.id];
    if (!s || !s.on) return;
    if (heldOn(order, d.id, forDate)) return;
    if (!picked[d.id]) return;
    if (d.mode === 'fluid') {
      fluid = fluidPer8(s, patient, S) || fluid;
      return;
    }
    if (d.mode === 'infusion') {
      /* an infusion is a rate somebody set, so it keeps the rate — and
         only the rate */
      const t = I && I.infusionText ? I.infusionText(d, patient, s) : name(d);
      rest.push(String(t).replace(/\s+—\s+[\d.,]+\s*ml\/hr\s*$/, ''));
      return;
    }
    const sp = spec(d, s);
    /* 11 November 2026: "dont copy doses of zovirax or vfend or any
       antibiotics in the handover" — an antimicrobial (antibiotic,
       antifungal, antiviral) is its day and its name, never a dose */
    if (isAntimicrobial(d)) {
      if (I && I.isProphylacticCotrimoxazole && I.isProphylacticCotrimoxazole(d)) return;
      const day = (S && S.antibioticDay ? S.antibioticDay(patient, d, forDate) : 0) || 1;
      abx.push(`D${day} ${name(d)}`);
      return;
    }
    /* a line that prints nothing on the order prints nothing here */
    if (S && S.orderLine && !txt(S.orderLine(d, s, patient))) return;
    rest.push([name(d), sp && `(${sp})`].filter(Boolean).join(' '));
  });
  if (fluid) rest.push(fluid);
  return abx.concat(rest).filter(Boolean);
}

const ANTIMICROBIAL_RE = /zovirax|acyclo|aciclo|valacic|ganciclo|cymevene|vfend|voricon|fluconaz|diflucan|ambisome|amphoter|caspofung|cancidas|micafung|mycamine|posacon|noxafil|itracon|anidulaf|isavucon/i;
function isAntimicrobial(d) {
  if (!d) return false;
  if ((d.group || '') === 'antimicrobial') return true;
  if (/antibacterial|antifungal|antiviral/i.test(d.drug_class || '')) return true;
  if (/^(antibiotics?|antifungals?|antivirals?)$/i.test(txt(d.category))) return true;
  return ANTIMICROBIAL_RE.test(`${d.name_en || ''} ${d.short_en || ''}`);
}

function medsFromOrder(patient, order, drugs, forDate, today) {
  /* ── NOT TOMORROW'S ───────────────────────────────────────────
   * Dr Boulos, 24 October 2026: "dont fill future days with
   * medications." The sheet runs a week ahead of itself, and today's
   * order is not a prediction: a child written down as being on day
   * four of tazocin on Thursday, from Monday's order, is a record of
   * something that has not happened. The rows ahead stay empty for
   * whoever fills them in on the day. */
  const now = txt(today) || new Date().toISOString().slice(0, 10);
  if (txt(forDate) > now) return '';
  /* the antibiotics on one line and the rest on the next, so the eye
     finds the antibiotic day without reading past the mouthwash */
  try {
    const all = drugsFromOrder(patient, order, drugs, forDate);
    const abx = all.filter((t) => /^D\d+ /.test(t));
    const rest = all.filter((t) => !/^D\d+ /.test(t));
    return [abx.join(', '), rest.join(', ')].filter(Boolean).join('\n');
  } catch (e) { return ''; }
}

/* ── THE LAB COLUMN, WHICH MAY NOW BE TYPED ──────────────────────
 * Dr Boulos, 24 October 2026: "leave the labs part out, it will be
 * handwritten after printing." Then, 31 October: "add the option to fill
 * in labs typing."
 *
 * Both, not one: the column prints its handwriting skeleton for every day
 * nobody typed into, and the typed figures for every day somebody did. A
 * ward round where the morning's CBC is already on the screen and the
 * evening's is not gets one sheet with the morning's printed and a ruled
 * box for the evening.
 */
/* 12 November 2026, Dr Boulos: "culture data is still retrieved in labs
   box, just notify the user and mark the culture as finalized, check HIS
   please" — "on android and PC". The lines an earlier version put in the
   Lab box ("Blood C/S final 04/11 — see HIS", "Blood C/S sent 11/11, 09/11;
   Rectal Swab C/S sent 09/11 — awaiting") are never shown or printed
   (dayOf), and on the main PC they become the Cultures section's entries
   (cultureLinesOf → applyCultures). */
const CULT_LINE = /\bC\/S\s+(final|sent)\b|—\s*see HIS\s*$|—\s*awaiting\s*$/i;
function labsWithoutCultures(text) {
  return String(text == null ? '' : text).split('\n').filter((l) => !CULT_LINE.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** the cultures an old Lab box line names: { finals: [{name, iso}], pendings: [...] } */
function cultureLinesOf(text, dayIso) {
  const out = { finals: [], pendings: [] };
  const y = +(txt(dayIso).slice(0, 4)) || new Date().getFullYear();
  const dm = +(txt(dayIso).slice(5, 7)) || 12;
  String(text || '').split('\n').filter((l) => CULT_LINE.test(l)).forEach((line) => {
    line.replace(/—\s*(see HIS|awaiting)\s*$/i, '').split(';').forEach((part) => {
      const m = /^\s*(.+?)\s+(final|sent)\s+(.+)$/i.exec(part);
      if (!m) return;
      const name = m[1].trim().replace(/C\/S/i, 'Culture & Sensitivity');
      (m[3].match(/(\d{1,2})\/(\d{1,2})/g) || []).forEach((d) => {
        const [dd, mm] = d.split('/').map(Number);
        const iso = `${mm > dm ? y - 1 : y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
        (/final/i.test(m[2]) ? out.finals : out.pendings).push({ name, iso });
      });
    });
  });
  return out;
}
const dayOf = (st, iso) => {
  const d = Object.assign({ clinically: '', labs: '', meds: '', todo: '', medsTouched: false, medsAuto: '' }, (st.days || {})[iso] || {});
  /* never a culture line in the Lab box (labsWithoutCultures) */
  if (CULT_LINE.test(d.labs)) d.labs = labsWithoutCultures(d.labs);
  if (CULT_LINE.test(d.labsAuto || '')) d.labsAuto = labsWithoutCultures(d.labsAuto);
  return d;
};

/* ── WHAT THE MEDICATIONS CELL ACTUALLY SAYS ─────────────────────
 * Somebody's typing wins, always — including an emptied cell, which must
 * not refill itself.
 *
 * Otherwise it depends on the day. Dr Boulos, 2 November 2026: "past days
 * should not be changed when i click retrieve from order, they should
 * retain the data inputed in that day from doctors orders … the idea is to
 * accumulate notes over days and have a view of the past and the current
 * day highlighted." And: "future days should be blank."
 *
 *   TODAY     follows the order, live, as it always has.
 *   THE PAST  is what the order said ON THAT DAY — `medsAuto`, the copy of
 *             it the app keeps as each day goes by (see `snapshot`). It is
 *             never worked out again from today's order, which is a
 *             different order: Monday's row reading Thursday's antibiotics
 *             is a record of something that did not happen on Monday.
 *   THE FUTURE is empty.
 *
 * Without `today` it is the old reading — the order's list until somebody
 * types — for a caller that has no idea what day it is.
 */
function medsFor(st, iso, auto, today) {
  const d = dayOf(st, iso);
  if (d.medsTouched) return d.meds;
  if (txt(d.meds)) return d.meds;
  const live = () => (typeof auto === 'function' ? txt(auto(iso)) : '');
  if (!txt(today)) return live();
  if (iso > today) return '';
  if (iso === today) return live() || txt(d.medsAuto);
  return txt(d.medsAuto);
}

/* ── KEEPING THE DAY ─────────────────────────────────────────────
 * The order is one selection per patient, not one per date, so once a
 * day has gone by the app cannot ask what the order said then. It keeps
 * its own copy instead: today's list, written into today's row every time
 * the order or the handover is saved. Tomorrow that copy stops being
 * refreshed, and it is what yesterday's row prints from then on.
 *
 * Returns true when the record changed. A day somebody typed into is
 * theirs and is not touched.
 */
function snapshot(st, today, auto) {
  if (!st || !txt(today) || typeof auto !== 'function') return false;
  st.days = st.days || {};
  const d = dayOf(st, today);
  if (d.medsTouched) return false;
  const now = txt(auto(today));
  if (now === txt(d.medsAuto)) return false;
  st.days[today] = Object.assign(d, { medsAuto: now });
  return true;
}

/* ── the week ─────────────────────────────────────────────────────
 * Seven dates from admission, and the sheet for a longer stay is the
 * next seven. `week` is 0 for the first.
 */
function addDays(iso, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.toISOString().slice(0, 10);
}

/* 12 November 2026, Dr Boulos: "if tomorrow is friday, friday is off, make
   the app export todays handover, write saturdays doctor orders and record
   saturdays labs". The next working day after `iso`: tomorrow, or Saturday
   when tomorrow is a Friday. With its name for a button: "Tomorrow 13/11",
   or "Saturday 14/11". */
function nextWorkDay(iso) {
  const t = addDays(iso, 1);
  const d = new Date(`${t}T00:00:00Z`);
  return d.getUTCDay() === 5 ? addDays(iso, 2) : t;
}
function nextWorkLabel(iso) {
  const n = nextWorkDay(iso);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(n);
  const dm = m ? `${+m[3]}/${+m[2]}` : n;
  return n === addDays(iso, 1) ? `Tomorrow ${dm}` : `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${n}T00:00:00Z`).getUTCDay()]} ${dm}`;
}

function weeksSince(fromIso, toIso) {
  const a = Date.parse(`${txt(fromIso)}T00:00:00Z`);
  const b = Date.parse(`${txt(toIso)}T00:00:00Z`);
  if (!isFinite(a) || !isFinite(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000 / DAYS);
}

function sheetDates(admission, week) {
  const start = addDays(admission, (week || 0) * DAYS);
  if (!start) return [];
  const out = [];
  for (let i = 0; i < DAYS; i++) out.push(addDays(start, i));
  return out;
}

/* 1/9, the way his blank writes a date in that column */
function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso));
  return m ? `${+m[3]}/${+m[2]}` : txt(iso);
}
function fullDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : txt(iso);
}

/* ── THE CHEMOTHERAPY DAY, PER ROW ───────────────────────────────
 * Dr Boulos, 1 November 2026: "the lane date, admission day should have
 * day of chemo, day of admission."
 *
 * It used to sit once in the tall left-hand cell, as one figure for a
 * whole week of the stay — which is wrong on six of the seven rows, and
 * silently: a sheet that says "Day 6 CADO" beside seven dates reads as
 * though all seven were day 6. It is different on every row, exactly as
 * the admission day is, so it belongs in the date column beside it.
 *
 * It began as the NUMBER only, because the column was 7% of the page
 * wide and "Day 6 2ND CYCLE CADO" would not go in it. 2 November 2026,
 * with a photograph of the printed sheet: "the chemo date and admission
 * date is very vague … D15 induction, D3 admission." CH 10 above ADM 1,
 * stacked in a narrow column, reads as a pair of codes rather than as
 * two facts about the day; and which chemotherapy D15 belongs to was on
 * the far side of the page. So the column is gone — joined to CLINICALLY,
 * which gave it the width — and the day is written out in words on one
 * line. See `dayLine`.
 */
function chemoDayNo(patient, iso) {
  const p = patient || {};
  if (p.cycleDay == null && !p.cycleName) return null;
  const base = Number(p.cycleDay) || 1;
  const a = Date.parse(`${txt(p.cycleStartDate)}T00:00:00Z`);
  const b = Date.parse(`${txt(iso)}T00:00:00Z`);
  const off = (isFinite(a) && isFinite(b)) ? Math.floor((b - a) / 86400000) : 0;
  const n = base + (off > 0 ? off : 0);
  return isFinite(n) && n > 0 ? n : null;
}

/* which day of the admission a date is: the admission day is day 1 */
function admissionDay(admission, iso) {
  const a = Date.parse(`${txt(admission)}T00:00:00Z`);
  const b = Date.parse(`${txt(iso)}T00:00:00Z`);
  if (!isFinite(a) || !isFinite(b)) return null;
  return Math.floor((b - a) / 86400000) + 1;
}

/* ── SUGGESTED LABS, FOR APPROVAL ──────────────────────────────────
 * Dr Boulos, 8 November 2026: "use the culture rules and the swabs and INR
 * for new patients rules to suggest labs, pending my approval to book".
 * For a child on a day: a blood culture when the fever rule asks for one
 * (bloodCulturePlan — the first fever, or a follow-up); on the day of
 * admission, the rectal and nasal swabs and an INR. Nothing is booked: the
 * physician approves, and approved labs wait in labsToBook (the ward's
 * data) until the app can order them in the HIS (PLANS FOR LATER). */
const LAB_SUGGEST = {
  bc: 'Blood culture',
  swabs: 'Rectal swab + nasal swab',
  inr: 'INR',
};
/* ── A LINE READ FROM THE HIS, INTO WHAT IS WRITTEN ────────────────
 * 14 November 2026, Dr Boulos: "make sure fever pattern is added to the
 * clinical textbox, not replaces current text". Everything written stays,
 * in its order. Only the app's OWN earlier line of the same kind (the
 * last "Spike …" or "24h balance …" it put in, untouched since) is brought
 * up to date in its place; a line the physician wrote — or edited — is
 * never touched, and the new reading goes underneath. */
function addLine(text, mine, line) {
  const cur = txt(text);
  const l = txt(line);
  if (!l) return cur;
  if (!cur) return l;
  const rows = cur.split('\n');
  if (rows.some((r) => r.trim() === l)) return cur;            /* already there */
  for (let i = rows.length - 1; i >= 0; i--) {
    if (mine.test(rows[i]) && APP_LINE.test(rows[i].trim())) { rows[i] = l; return rows.join('\n'); }
  }
  return `${cur}\n${l}`;
}
/* the shapes the app writes: "Spike 38.6 (06:20)", "Spikes 38.6 (06:20), 39 (14:00)",
   "24h balance: in 1200, out 900 …" — nothing else is taken for the app's own */
const APP_LINE = /^(Spikes?\s+\d{2}(\.\d)?\s*\(\d{1,2}:\d{2}\)(,\s*\d{2}(\.\d)?\s*\(\d{1,2}:\d{2}\))*\s*$|24h balance\b.*)$/i;
/* ── NOTES BROKEN BY THE OLD PHONE SYNC, PUT RIGHT ONCE ──────────────
 * 14 November 2026 (Dr Boulos's screenshots): a phone note typed while it
 * synced came out with its letters on lines of their own — «i / n / k / g»,
 * «goo / d / h / u / s» — under a second copy of the text. Only a text that
 * carries that mark (three or more one-letter lines) is touched: the
 * one-letter lines and the scraps of three letters or fewer beside them go,
 * a line repeated word for word is kept once, and a line that is only the
 * start of another line goes. Every other line stays as written. */
function repairScatter(text) {
  const t = String(text || '');
  const rows = t.split('\n');
  const one = (r) => /^\s*\S\s*$/.test(r);
  if (rows.filter(one).length < 3) return t;
  const near = (i) => (i > 0 && one(rows[i - 1])) || (i < rows.length - 1 && one(rows[i + 1]));
  const kept = rows.filter((r, i) => !one(r) && !(r.trim().length <= 3 && near(i)));
  const out = [];
  kept.forEach((r) => { if (!out.some((o) => o.trim() === r.trim())) out.push(r); });
  return out.filter((r) => !out.some((o) => o !== r && o.trim().length > r.trim().length && o.trim().indexOf(r.trim()) === 0)).join('\n');
}
function repairScattered(state) {
  let n = 0;
  Object.keys((state && state.days) || {}).forEach((iso) => {
    const d = state.days[iso];
    ['clinically', 'labs', 'todo', 'meds'].forEach((k) => {
      if (typeof d[k] !== 'string') return;
      const r = repairScatter(d[k]);
      if (r !== d[k]) { d[k] = r; n++; }
    });
  });
  return n;
}
function labSuggestions(p, st, iso, nowMs) {
  const out = [];
  const plan = (st && (st.temps || []).length) ? bloodCulturePlan(st.temps, nowMs) : { take: {}, next: null };
  if (plan.take[iso] === 'first') out.push({ key: 'bc', label: LAB_SUGGEST.bc, why: 'first fever' });
  else if (plan.take[iso] === 'follow-up' || plan.next === iso) out.push({ key: 'bc', label: LAB_SUGGEST.bc, why: 'follow-up of a culture taken on fever' });
  const ad = admissionDay(p && p.admissionDate, iso);
  if (ad === 1) {
    out.push({ key: 'swabs', label: LAB_SUGGEST.swabs, why: 'new admission' });
    out.push({ key: 'inr', label: LAB_SUGGEST.inr, why: 'new admission' });
  }
  /* 14 November 2026, Dr Boulos: "suggest INR for everybody on saturday,
     suggest CBCs daily for everybody, suggest CRP daily for everybody" */
  out.push({ key: 'cbc', label: 'CBC', why: 'daily' });
  out.push({ key: 'crp', label: 'CRP', why: 'daily' });
  if (new Date(`${txt(iso)}T00:00:00Z`).getUTCDay() === 6 && !out.some((x) => x.key === 'inr')) out.push({ key: 'inr', label: LAB_SUGGEST.inr, why: 'Saturday' });
  return out;
}
/* the ward's approved list for a day: { pid: [{ key, label, why, at }] } */
const toBook = (data, iso) => (((data || {}).labsToBook || {})[iso]) || {};
function approveLabs(data, iso, pid, items, nowMs) {
  const all = data.labsToBook = Object.assign({}, data.labsToBook || {});
  /* only today and the days ahead are kept — approving for tomorrow
     keeps today's (12 November 2026: "request labs now or tomorrow") */
  Object.keys(all).forEach((d) => { if (d < addDays(iso, -1)) delete all[d]; });
  const day = all[iso] = Object.assign({}, all[iso] || {});
  const had = day[pid] || [];
  const fresh = (items || []).filter((x) => x && x.key && !had.some((h) => h.key === x.key))
    .map((x) => Object.assign({ key: x.key, label: x.label, why: x.why || '', at: nowMs == null ? Date.now() : nowMs },
      iso > localIso(nowMs) ? { ahead: true } : {}));
  day[pid] = had.concat(fresh);
  return fresh.length;
}
function unapproveLab(data, iso, pid, key) {
  const day = ((data.labsToBook || {})[iso]) || {};
  if (!day[pid]) return;
  day[pid] = day[pid].filter((x) => x.key !== key);
  if (!day[pid].length) delete day[pid];
}

/* ── THE LAB MENU, AND ITS NAMES IN THE HIS ────────────────────────
 * Dr Boulos, 8 November 2026 — his menu: "1 CBC 2 Basic chem AST, ALT,
 * Bili total and direct, urea, serum creat 3 Basic chem + electrolytes Na K
 * 4 Basic chem + extended electrolytes Na K Mg Ca PO4 uric acid 5 basic +
 * extended electrolytes + CRP 6 INR 7 ABG 8 Blood culture 9 rectal swab,
 * nasal swab"; "please add albumin to extended chemistry". The names are
 * the HIS's own, from his "labs names" recording of its order screen. */
const LAB_MENU = [
  { key: 'cbc', label: 'CBC' },
  { key: 'chem1', label: 'Basic chemistry', chem: 1 },
  { key: 'chem2', label: 'Basic chemistry + Na, K', chem: 2 },
  { key: 'chem3', label: 'Basic chemistry + extended electrolytes', chem: 3 },
  /* 12 November 2026: "separate CRP, make it a separate item, not a part
     of the extended chemistry. Checkable, just like the rest." (chem4, the
     old "+ CRP", stays readable below for what was approved before) */
  { key: 'crp', label: 'CRP' },
  { key: 'inr', label: 'INR (P.T + P.T.T.)' },
  { key: 'caion', label: 'Ionized calcium', optional: true },
  { key: 'abg', label: 'ABG' },
  { key: 'bc', label: 'Blood culture' },
  { key: 'swabs', label: 'Rectal swab + nasal swab' },
];
const HIS_BASIC = ['AST', 'ALT', 'Bilirubin - total', 'Bilirubin - direct', 'UREA', 'Creatinine, serum'];
const HIS_NAK = ['SODIUM', 'POTASSIUM'];
const HIS_EXT = ['Magnesium serum', 'Calcium - Total', 'PHOSPHORUS', 'URIC ACID', 'ALBUMIN'];
const HIS_LAB_TESTS = {
  cbc: ['CBC with automated Differential'],
  chem1: HIS_BASIC,
  chem2: HIS_BASIC.concat(HIS_NAK),
  chem3: HIS_BASIC.concat(HIS_NAK, HIS_EXT),
  chem4: HIS_BASIC.concat(HIS_NAK, HIS_EXT, ['CRP(Emergency)']),
  crp: ['CRP(Emergency)'],
  /* "order pt and ptt" */
  inr: ['P.T', 'P.T.T.'],
  /* "leave it as optional": on no menu item, ticked on its own */
  caion: ['Calcuim Ionized'],
  abg: ['ABG'],
  bc: ['Blood Culture & Sensitivity1'],
  swabs: ['Rectal Swab Culture & Sensitivity', 'NASAL MRSA SCREENING'],
};
/* the HIS's test names for a child's approved items, each once, in order;
   only one chemistry (the widest) */
function hisTestsFor(items) {
  const keys = (items || []).map((x) => (typeof x === 'string' ? x : x && x.key)).filter((k) => HIS_LAB_TESTS[k]);
  const chem = keys.filter((k) => /^chem\d$/.test(k)).sort().pop();
  const out = [];
  keys.filter((k) => !/^chem\d$/.test(k) || k === chem).forEach((k) => HIS_LAB_TESTS[k].forEach((n) => { if (out.indexOf(n) < 0) out.push(n); }));
  return out;
}
/* "blood cultures: fill from handover" — the HIS's request form for a
   blood culture, from the child's handover: the diagnosis (and the fever
   day when febrile), whether an antibiotic is on today's order, and "."
   where the handover has nothing */
function cultureForm(p, st, order, drugs, nowMs) {
  const dx = txt(p && p.diagnosis).replace(/\.*$/, '');
  const fd = feverDays((st && st.temps) || [], nowMs);
  const hx = [dx, fd.febrile ? `febrile day ${fd.count}` : ''].filter(Boolean).join(', ');
  const sel = (order && order.sel) || {};
  const abx = (drugs || []).filter((d) => d && d.day_counter && sel[d.id] && sel[d.id].on)
    .map((d) => txt(d.short_en || d.name_en)).filter(Boolean);
  return { hx: hx || '.', antibiotic: abx.length ? 'Yes' : 'No', antibiotics: abx, comments: '.' };
}
/* ── TODAY OR TOMORROW, AND THE NURSES' PAPER ──────────────────────
 * 12 November 2026, Dr Boulos: "When the user clicks the Add Labs button,
 * whether from the PC or the phone, give him a choice whether to request
 * labs now or tomorrow. Tomorrow can be registered after 12 PM." And: "when
 * the requested labs for tomorrow are checked for all the patients, print
 * a paper … a table, every patient's name, MRN, and the requested labs.
 * Chemistry should just say chemistry. This paper is for the nursing, so it
 * should be in Arabic. CBC … عد, chemistry … وظائف, blood cultures …
 * مزرعة دم, rectal swab … مسحة شرج, nasal swab … مسحة أنف, INR … سيولة." */
/* 12 November 2026, then: "if I record labs for tomorrow, the PC should
   request them for tomorrow after 12 a.m., which is the start of the next
   day. Not that you should not allow the user to record labs for tomorrow
   before 12 p.m. of this day." Tomorrow can be chosen at any hour; a lab
   approved for a day still to come is marked `ahead`. 13 November 2026: "I
   want all labs ordered right now with the schedule done in HIS right now"
   — it is ordered when Order in HIS is pressed, with its day as the HIS
   Schedule Date; the PC no longer orders anything by itself. */
const localIso = (ms) => { const d = new Date(ms == null ? Date.now() : ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const LAB_AR = { cbc: 'عد', chem: 'وظائف', crp: 'CRP', inr: 'سيولة', bc: 'مزرعة دم', swabs: 'مسحة شرج، مسحة أنف', abg: 'ABG', caion: 'Ionized Ca' };
function labsInArabic(items) {
  const out = [];
  (items || []).forEach((x) => {
    const k = typeof x === 'string' ? x : x && x.key;
    if (!k) return;
    const name = /^chem\d$/.test(k) ? LAB_AR.chem : k === 'chem4' ? LAB_AR.chem : (LAB_AR[k] || txt(x && x.label) || k);
    if (out.indexOf(name) < 0) out.push(name);
    /* the old "chemistry + CRP" item was both */
    if (k === 'chem4' && out.indexOf(LAB_AR.crp) < 0) out.push(LAB_AR.crp);
  });
  return out;
}
const AR_NUM = (v) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
/** The nurses' paper: one A4 page, in Arabic, the children with labs
    requested for `iso` — [{ name, mrn, room, items }]. */
function nursingLabsHtml(rows, iso) {
  const list = (rows || []).filter((r) => r && (r.items || []).length);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso));
  const date = m ? AR_NUM(`${+m[3]}/${+m[2]}/${m[1]}`) : txt(iso);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تحاليل ${esc(date)}</title><style>
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family: "Traditional Arabic", "Arial", sans-serif; color: #000; }
  h1 { font-size: 20pt; text-align: center; margin: 0 0 8mm; }
  table { width: 100%; border-collapse: collapse; font-size: 14pt; }
  th, td { border: 1px solid #000; padding: 2.4mm 3mm; text-align: right; vertical-align: top; }
  th { background: #eee; }
  td.n, th.n { width: 9mm; text-align: center; }
  td.mrn { direction: ltr; text-align: right; white-space: nowrap; }
  </style></head><body>
  <h1>التحاليل المطلوبة ليوم ${esc(date)}</h1>
  <table><thead><tr><th class="n">م</th><th>الاسم</th><th>الرقم الطبي</th><th>التحاليل المطلوبة</th></tr></thead><tbody>
  ${list.map((r, i) => `<tr><td class="n">${AR_NUM(i + 1)}</td><td>${esc(r.name)}</td><td class="mrn">${esc(r.mrn || '')}</td><td>${esc(labsInArabic(r.items).join('، '))}</td></tr>`).join('')}
  </tbody></table></body></html>`;
}

/* an approved item marked as ordered in the HIS (or how it failed) */
function markOrdered(data, iso, pid, keys, how, nowMs) {
  const day = ((data.labsToBook || {})[iso]) || {};
  (day[pid] || []).forEach((x) => {
    if ((keys || []).indexOf(x.key) >= 0) {
      if (how && how.ok) { x.ordered = nowMs == null ? Date.now() : nowMs; delete x.failed; }
      else x.failed = txt(how && how.reason) || 'not ordered';
    }
  });
}

/* ── THE DAY, IN WORDS, ON ONE LINE ──────────────────────────────
 *
 * 2 November 2026, giving the shape himself: "1/11, D2 2nd Cado, D4
 * admission". The date, then which day of which chemotherapy, then which
 * day of the admission — and the regimen NAMED, because "D15" on its own
 * is a number waiting for somebody to go and look up what it counts.
 *
 * The name is the patient's own "Chemo / cycle" — what he typed on the
 * record, in his own words. A day with no chemotherapy on the record is
 * the date and the admission day; a date before the admission is the
 * date alone. Nothing is invented and nothing is abbreviated.
 */
function dayLine(patient, iso) {
  const p = patient || {};
  const out = [shortDate(iso)];
  const cd = chemoDayNo(p, iso);
  if (cd) out.push(`D${cd}${txt(p.cycleName) ? ` ${txt(p.cycleName)}` : ''}`);
  const ad = admissionDay(p.admissionDate, iso);
  if (ad > 0) out.push(`D${ad} admission`);
  return out.join(', ');
}

/* ── THE PARAGRAPH ────────────────────────────────────────────────
 * Dr Boulos, 24 October 2026, giving the shape himself:
 *
 *   Neuroblastoma. Day 66 Cycle 1 Vp/Carbo, Day 51 admission,
 *   febrile D1, imaging:
 *   last CT chest: 23/04/2026, free, last echo: 23/04/2026, free,
 *   cultures: rectal: 23/04/2026, mrsa, blood culture: 23/04/2026, medsa,
 *   medications: macxipime,
 *   plan of care: echo repeart,
 *
 * Six lines, each ending in a comma, with "imaging:" hung on the end of
 * the clinical line. It is written that way to be pasted into a patient
 * record, so the shape is his and not tidied.
 *
 * AND NOTHING IN IT THAT WAS NOT FILLED IN. A line reading "last CT
 * chest: , " is worse than no line: it reads as a scan that was done and
 * said nothing. An empty line is left out altogether.
 */
function copyText(patient, st0, opts) {
  const o = Object.assign({ date: '', chemoDay: '' }, opts || {});
  const st = normalise(st0);
  const p = patient || {};
  const d = dayOf(st, o.date);
  const lines = [];

  /* line 1 — the left-hand column and where the child is in all this */
  const head = [];
  if (txt(p.diagnosis)) head.push(`${txt(p.diagnosis).replace(/\.*$/, '')}.`);
  if (txt(st.summary)) head.push(txt(st.summary).replace(/\s+/g, ' '));
  const after = [];
  if (txt(o.chemoDay)) after.push(txt(o.chemoDay));
  const ad = admissionDay(p.admissionDate, o.date);
  if (ad != null && ad > 0) after.push(`Day ${ad} admission`);
  const first = [head.join(' '), after.join(', ')].filter(Boolean).join(' ');
  if (first) lines.push(`${first}, `);

  /* line 2 — clinically, with "imaging:" hung on the end of it */
  /* by modality and by date (imagingList), on the one line of his six —
     the space between modalities is on the window and the PDF */
  const groups = [];
  imagingList(st).forEach((e) => {
    const body = [fullDate(e.date), e.finding].filter(Boolean).join(', ');
    const label = e.fixed === 'ct' ? 'last CT chest' : e.fixed === 'echo' ? 'last echo' : e.label.toLowerCase();
    const one = [label, body].filter(Boolean).join(': ');
    if (e.gap || !groups.length) groups.push([one]); else groups[groups.length - 1].push(one);
  });
  const img = groups.map((g) => g.join(', '));
  const clin = txt(d.clinically).replace(/\s+/g, ' ');
  if (clin && img.length) lines.push(`${clin}, imaging:`);
  else if (clin) lines.push(`${clin}, `);
  else if (img.length) lines.push('imaging:');

  /* line 3 — the imaging itself */
  if (img.length) lines.push(`${img.join(', ')}, `);

  /* line 4 — the cultures */
  /* in the ward's order — swabs, blood by date, the rest (cultureList) */
  const cul = cultureList(st).map((e) => {
    const body = [fullDate(e.date), e.result].filter(Boolean).join(', ');
    const label = e.fixed === 'rectal' ? 'rectal' : e.label.toLowerCase();
    return [label, body].filter(Boolean).join(': ');
  });
  if (cul.length) lines.push(`cultures: ${cul.join(', ')}, `);

  /* lines 5 and 6 */
  const meds = medsFor(st, o.date, o.autoMeds, o.today);
  if (txt(meds)) lines.push(`medications: ${txt(meds).replace(/\s+/g, ' ')}, `);
  const todo = o.date ? todoText(p, d, o.date, st) : txt(d.todo);
  if (todo) lines.push(`plan of care: ${todo.replace(/\s+/g, ' ')},`);

  return lines.join('\n');
}

/* ── the paper ────────────────────────────────────────────────────
 * A4 landscape: his blank's table is 25.6 cm across and eight columns
 * wide, and nothing narrower holds it without crushing the two columns
 * the ward actually writes in.
 */
function css() {
  return `
  /* 24 October 2026: "paper size is letter landscape" */
  @page { size: letter landscape; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, 'Segoe UI', sans-serif;
         color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pg { width: 279.4mm; height: 215.9mm; padding: 9mm 8mm 7mm;
        display: flex; flex-direction: column; overflow: hidden; --fs: 10pt; }
  /* 31 October 2026: "renew the page weekly" — and "add a button to print
     all handovers", so one document can hold a whole round. Every sheet
     but the last one starts a new piece of paper. */
  .pg { break-after: page; page-break-after: always; }
  .pg:last-of-type { break-after: auto; page-break-after: auto; }

  .top { display: flex; flex-wrap: wrap; gap: 2mm 7mm; align-items: baseline;
         margin-bottom: 2.5mm; }
  .top .f { font-size: var(--fs); white-space: nowrap; }
  .top .f b { font-weight: 700; }
  .top .f .k { font-size: calc(var(--fs) * .8); letter-spacing: 1.1px;
               color: #333; margin-right: 1.5mm; }
  .top .rm { font-size: calc(var(--fs) * 1.5); font-weight: 800; }
  .top .wd { direction: rtl; unicode-bidi: isolate; }
  .top .nm { direction: rtl; unicode-bidi: isolate; font-size: calc(var(--fs) * 1.18);
             font-weight: 700; }
  /* which week of the stay this sheet is, when there is more than one of
     them: a second sheet that does not say so gets filed as a first */
  .top .wk { margin-left: auto; }
  .top .wk b { border: 0.25mm solid #000; border-radius: 1mm; padding: 0.6mm 2mm;
               font-size: calc(var(--fs) * .84); letter-spacing: .6px; }

  table.hv { width: 100%; border-collapse: collapse; table-layout: fixed;
             flex: 1 1 auto; }
  table.hv th, table.hv td { border: 0.25mm solid #000; padding: 1mm 1.4mm;
        font-size: var(--fs); vertical-align: top; }
  table.hv th { background: #eee; text-align: center; font-weight: 700;
        font-size: calc(var(--fs) * .84); letter-spacing: .8px; }
  table.hv td.c { text-align: center; }
  /* the one column the app does not ask for: it prints its skeleton and
     the ward writes on it */
  /* room for a pen: the count across the top, then Monos and CRP, then
     Others — each on its own line with space under it to write in */
  table.hv td.lab { font-size: calc(var(--fs) * .78); color: #333; line-height: 1.3; }
  table.hv td.lab .cbc { display: flex; justify-content: space-between;
        align-items: baseline; width: 100%; font-size: calc(var(--fs) * .95);
        color: #000; padding-bottom: 3.6mm; }
  table.hv td.lab .lb2 { display: flex; justify-content: space-between;
        width: 100%; padding-bottom: 3.6mm; }
  table.hv td.lab .lb3 { padding-bottom: 3mm; }
  /* 31 October 2026: "add the option to fill in labs typing." A day
     somebody typed prints the figures at the size the rest of the row is
     read at, and loses the ruled box — there is nothing left to write. */
  table.hv td.lab.typed { font-size: var(--fs); color: #000; }
  table.hv td.hist, table.hv td.tall { font-size: calc(var(--fs) * .92); }
  /* the case summary is the long one and takes most of the column */
  table.hv td.hist .sum { white-space: pre-wrap; overflow-wrap: anywhere; }
  /* ── the day's own cell ──
     2 November 2026: "join dates and clinical", and the day written out
     — "1/11, D2 2nd Cado, D4 admission". The line is bold and sits over
     a hairline, so the eye finds the day down a column of seven; the
     condition is written under it in the ordinary hand. It does NOT
     wrap by preference — nowrap would clip a long regimen name, so it
     is left to wrap and the fitter shrinks the page if it must. */
  table.hv td.dc .dl { font-weight: 700; letter-spacing: .2px;
        padding-bottom: 0.8mm; margin-bottom: 1mm;
        border-bottom: 0.2mm solid #999; }
  table.hv td.dc .dl.fut { border-bottom: 0; }
  /* ── imaging over cultures, in one column at the end ──
     The rule between them is the only thing saying where one stops. */
  /* 2 November 2026: "have another title above the cultures, similar to
     the title above the imaging. Don't title both with the same …" — the
     column's heading says IMAGING, and the cultures under it get a heading
     bar of their own, drawn the way the table's headings are drawn and
     running the full width of the cell. */
  table.hv td.stack .half.under { margin-top: 1.6mm; }
  table.hv td.stack .sh { background: #eee; text-align: center; font-weight: 700;
        font-size: calc(var(--fs) * .84); letter-spacing: .8px;
        margin: 0 -1.4mm 1.2mm; padding: 1mm 1.4mm;
        border-top: 0.25mm solid #000; border-bottom: 0.25mm solid #000; }
  /* ── TODAY, OUTLINED ──
     2 November 2026: "highlight today's progress note with a thick
     borderline around all the boxes that are specific to today. Date,
     clinical status, lab, medications, and to-do list." One heavy frame
     round the four cells of today's row — and only those: the tall cells
     either side belong to the whole week. */
  table.hv td.now { border-top: 0.9mm solid #000; border-bottom: 0.9mm solid #000; }
  table.hv td.now.dc { border-left: 0.9mm solid #000; }
  table.hv td.now.end { border-right: 0.9mm solid #000; }
  .k2 { font-size: calc(var(--fs) * .74); letter-spacing: .6px; color: #444;
        display: block; }
  .v2 { display: block; margin-bottom: 1.2mm; white-space: pre-wrap;
        overflow-wrap: anywhere; }
  td .wr { white-space: pre-wrap; overflow-wrap: anywhere; }
  .culgap { height: 2.6mm; }
  /* 12 November 2026, Dr Boulos: "In the cultures and imaging: make the
     type of culture/imaging bold, not the first result that is bold" —
     every type label in the two bold and black; the results plain */
  .half .k2 { font-weight: 700; color: #000; }
  /* 5 November 2026: a red-flag figure, bold on a mid grey that a black
     and white printer keeps — black text on it stays easy to read */
  .rf { font-weight: 900; background: #b3b3b3; color: #000; padding: 0 .6mm;
        border-radius: .4mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `;
}

/* the lab skeleton, exactly as his blank prints it */
/* ── THE LAB CELL, FOR A PEN ─────────────────────────────────────
 * Dr Boulos, 24 October 2026: "add enouugh space for CBC handwriting,
 * monos should be in a new line with CRP, and the ( / / / ) should fill
 * the column width and maken it a little bit wider."
 *
 * Three lines. The count across the top with its obliques spread the
 * whole width of the cell, so each of the four figures has room to be
 * written between them; Monos and CRP together on the next; Others
 * under that. The column is wider than it was for the same reason.
 */
/* **7.4** in the typed lab box → bold on grey. Takes text already escaped. */
const redFlags = (html) => String(html).replace(/\*\*([^*\n]+)\*\*/g, '<b class="rf">$1</b>');
/* a CBC line written before 7 November 2026, "( 1 / 0.2 / 7.1 / 12 )",
   prints as the ward now writes it: "(1/0.2/7.1/12)" */
const tightCbc = (t) => String(t).split('\n').map((l) =>
  (/^\s*\([^()\n]*\/[^()\n]*\/[^()\n]*\/[^()\n]*\)\s*$/.test(l) ? l.replace(/\s+/g, '') : l)).join('\n');

const LAB_BLANK = '<div class="cbc"><span>(</span><span>/</span><span>/</span>'
  + '<span>/</span><span>)</span></div>'
  + '<div class="lb2"><span>Monos</span><span>CRP</span></div>'
  + '<div class="lb3">Others:</div>';

function fitWard(doc) {
  var MAX = 10, MIN = 6;
  function over(el) {
    if (el.scrollHeight > el.clientHeight + 0.5) return true;
    var c = el.querySelectorAll('td, th'), j;
    for (j = 0; j < c.length; j++) {
      if (c[j].scrollWidth > c[j].clientWidth + 0.5) return true;
    }
    return false;
  }
  function put(el, fs) { el.style.setProperty('--fs', fs + 'pt'); }
  var pages = doc.querySelectorAll('.pg'), i, k, lo, hi, mid;
  for (i = 0; i < pages.length; i++) {
    var el = pages[i];
    el.style.height = '';
    el.style.overflow = '';
    put(el, MAX);
    if (!over(el)) continue;
    put(el, MIN);
    if (over(el)) { el.style.height = 'auto'; el.style.overflow = 'visible'; continue; }
    lo = MIN; hi = MAX;
    for (k = 0; k < 14; k++) {
      mid = (lo + hi) / 2; put(el, mid);
      if (over(el)) hi = mid; else lo = mid;
    }
    put(el, lo);
  }
}

function fitScript() {
  return '<scr' + `ipt>(function(){
  var fit=function(){ (${fitWard.toString()})(document); };
  if(document.readyState==='complete') fit();
  else window.addEventListener('load', fit);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();</scr` + 'ipt>';
}

/* ── HOW MANY SHEETS A STAY NEEDS ────────────────────────────────
 * Dr Boulos, 31 October 2026: "renew the page weekly, day 8 admission
 * should have 2 pages, with the summary the same between them."
 *
 * The blank holds seven days. A stay of eight is not seven days and a
 * box to go and find the eighth in: it is two sheets, and the ward is
 * handed both. The left-hand column — diagnosis, chemotherapy day,
 * supportive, case summary — is REPEATED on each of them, because a
 * second sheet whose summary is on the first one is a sheet nobody can
 * read on its own.
 */
function weeksNeeded(admission, through) {
  const last = weeksSince(admission, through);
  return (isFinite(last) ? last : 0) + 1;
}

const pageLabel = (n, of) => (of > 1 ? `Week ${n} of ${of}` : '');

/** The head and the table of ONE sheet: one week of one patient. */
function pageHtml(o, dates, weekNo, weeks) {
  const p = o.patient || {};
  const st = o.state;

  const pair = (k, v) => `<span class="k2">${esc(k)}</span><span class="v2">${
    esc(v) || '&nbsp;'}</span>`;

  /* 1 November 2026: "chemotherapy day title should be removed from
     leftmost column" — it is in the date column now, where it is right
     on every row rather than on one of them — and "Case summary should
     be above supportive", which is the order they are read in: what
     this admission is about, then what is being given for it. */
  const hist = `${pair('DIAGNOSIS', p.diagnosis)}<span class="k2">CASE SUMMARY</span>`
    + `<span class="v2 sum">${esc(st.summary) || '&nbsp;'}</span>`
    + `${pair('SUPPORTIVE', st.supportive)}`;
  /* an extra with no name of its own is still printed — the finding is
     the point of it, and a nameless one is better than a lost one */
  const extras = (list, what) => (list || []).filter((e) =>
    txt(e.label) || txt(e.date) || txt(e[what]))
    .map((e) => pair(txt(e.label).toUpperCase() || 'ALSO',
      [fullDate(e.date), txt(e[what])].filter(Boolean).join(' — '))).join('');

  /* 11 November 2026: by modality and by date, a space between the
     modalities (imagingList) */
  const imaging = imagingList(st, { blanks: true }).map((e) => `${e.gap ? '<div class="culgap"></div>' : ''}${pair(
    e.fixed === 'ct' ? 'LAST CT CHEST' : e.fixed === 'echo' ? 'LAST ECHO' : e.label.toUpperCase() || 'ALSO',
    [fullDate(e.date), e.finding].filter(Boolean).join(' — '))}`).join('');
  void extras;
  /* 7 November 2026: swabs (nasal, rectal), then blood by date, then the
     rest — cultureList */
  /* 9 November 2026, Dr Boulos: "space different types of cultures, and
     make the first culture of every type, bold and a little larger font" —
     a gap between the kinds (rectal, blood, …), the first of each kind
     bold and larger */
  let prevKind = null;
  const cultures = cultureList(st, { blanks: true }).map((e) => {
    const kind = e.fixed || cultureKindOf(e.label) || txt(e.label).toLowerCase();
    const first = kind !== prevKind;
    const gap = first && prevKind !== null;
    prevKind = kind;
    return `${gap ? '<div class="culgap"></div>' : ''}<div class="cul${first ? ' culfirst' : ''}">${pair(
      e.fixed === 'rectal' ? 'RECTAL' : e.label.toUpperCase() || 'ALSO',
      [fullDate(e.date), e.result].filter(Boolean).join(' — '))}</div>`;
  }).join('');

  /* 2 November 2026: "move imaging and cultures to the most right, and
     make cultures and imaging over each other, not beside each other."
     Two narrow columns in the middle of the page became one column at
     the end of it, imaging above and cultures below a rule — and the
     width they gave up went to the day's own column. */
  const scans = `<div class="half">${imaging}</div>`
    + `<div class="half under"><div class="sh">CULTURES</div>${cultures}</div>`;
  const today = txt(o.through);

  const body = dates.map((iso, i) => {
    const d = dayOf(st, iso);
    const first = i === 0;
    const span = ` rowspan="${dates.length}"`;
    /* "future days should be blank" — and then: "everything should be
       gone, EVERYTHING except the date". A day still to come prints its
       date line and nothing else, not even the lab box for the pen */
    const future = today && iso > today;
    const now = today && iso === today ? ' now' : '';
    const clin = future ? '' : d.clinically;
    const labs = future ? '' : txt(d.labs);
    const meds = future ? '' : medsFor(st, iso, o.autoMeds, today);
    const todo = future ? '' : todoText(p, d, iso, st);
    return `<tr>
      ${first ? `<td class="hist"${span}>${hist}</td>` : ''}
      ${/* 2 November 2026: "join dates and clinical" — the date line,
           then the day's condition written under it. The two were read
           together and circled together on the sheet he sent back. */''}
      ${/* "not the date line, just the date": a day still to come is its
           date and nothing more — no chemotherapy day, no admission day,
           no rule under it */''}
      <td class="dc${now}">${future ? `<div class="dl fut">${esc(shortDate(iso))}</div>`
    : `<div class="dl">${esc(dayLine(p, iso))}</div>`}
        <div class="wr">${esc(clin)}</div></td>
      ${/* typed when somebody typed, and a ruled box for a pen when not */''}
      ${/* "everything should be gone, EVERYTHING except the date" — a day
           still to come has not even the ruled lab box */''}
      <td class="lab${labs ? ' typed' : ''}${now}">${labs
  ? `<div class="wr">${redFlags(esc(tightCbc(labs)))}</div>` : future ? '' : LAB_BLANK}</td>
      <td class="${now.trim()}"><div class="wr">${esc(meds)}</div></td>
      <td class="${now ? 'now end' : ''}"><div class="wr">${esc(todo)}</div></td>
      ${first ? `<td class="tall stack"${span}>${scans}</td>` : ''}
    </tr>`;
  }).join('');

  const head = (k, v) => `<div class="f"><span class="k">${esc(k)}</span>${v}</div>`;
  const label = pageLabel(weekNo, weeks);

  return `  <div class="pg">
    <div class="top">
      ${/* 3 November 2026: "add a detail on the top left, room number
           before the name". The room is the first thing on the sheet,
           because it is how the stack is sorted and how the bed is found. */''}
      ${head('ROOM', `<b class="rm">${esc(p.room || '')}</b>`)}
      ${head('NAME', `<b class="nm">${esc(p.name || '')}</b>`)}
      ${head('MRN', `<b>${esc(p.mrn || '')}</b>`)}
      ${txt(p.ward) ? head('WARD', `<b class="wd">${esc(p.ward)}</b>`) : ''}
      ${head('WEIGHT', `<b>${esc(p.weight ? `${p.weight} kg` : '')}</b>`)}
      ${head('HEIGHT', `<b>${esc(p.height ? `${p.height} cm` : '')}</b>`)}
      ${head('AGE', `<b>${esc(o.age || '')}</b>`)}
      ${head('ADMITTED', `<b>${esc(fullDate(p.admissionDate))}</b>`)}
      ${label ? `<div class="f wk"><b>${esc(label)}</b></div>` : ''}
    </div>
    <table class="hv">
      <colgroup>
        <col style="width:16%"><col style="width:25%"><col style="width:15%">
        <col style="width:15%"><col style="width:13%"><col style="width:16%">
      </colgroup>
      <thead><tr>
        <th>DIAGNOSIS · CASE SUMMARY<br>SUPPORTIVE</th>
        ${/* the day's own line spells out which chemotherapy day and
             which day of the admission, so the heading does not have to
             name counts that are written out underneath it anyway */''}
        <th>DATE · CLINICALLY</th>
        <th>LAB</th>
        <th>MEDICATIONS</th><th>TO DO LIST</th>
        <th>IMAGING</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    ${/* 2 November 2026: "remove the handed over by and received by lines
         below, no need." Two ruled lines nobody was signing, taking the
         room the table wanted. */''}
  </div>`;
}

/** every page one patient's stay needs, in order */
function patientPages(o0) {
  const o = Object.assign({ patient: {}, state: null, week: null, weeks: null,
    through: '', chemoDay: '', age: '', autoMeds: null, dates: null }, o0 || {});
  o.state = normalise(o.state);
  const p = o.patient || {};
  /* `dates` and `week` still name ONE sheet, for a caller that wants one;
     with neither, the stay decides how many there are */
  if (o.dates && o.dates.length) return [pageHtml(o, o.dates, 1, 1)];
  if (o.week != null) {
    return [pageHtml(o, sheetDates(p.admissionDate, o.week), o.week + 1, o.week + 1)];
  }
  /* ── THE CURRENT WEEK, AND NOT THE ONES BEFORE IT ──────────────
   * 1 November 2026: "When I click print all, just print the current
   * week. If a patient has been admitted for 28 days, don't show the
   * previous 3 weeks' paper and the PDF I will print."
   *
   * The sheet still RENEWS every week — a stay of eight days starts a
   * second sheet and does not cram fourteen rows onto one page, which
   * is what 31 October asked for. What has changed is which of them
   * comes out of the printer: the one the ward is living in. Three
   * weeks of finished paper reprinted every morning is three weeks of
   * paper in the bin, and the round is handed over on one sheet.
   */
  const through = txt(o.through) || new Date().toISOString().slice(0, 10);
  const weeks = Math.max(1, o.weeks || weeksNeeded(p.admissionDate, through));
  const from = o.weeks ? 0 : weeks - 1;
  const out = [];
  for (let w = from; w < weeks; w++) {
    out.push(pageHtml(o, sheetDates(p.admissionDate, w), w + 1, weeks));
  }
  return out;
}

function document_(pages, title, inlineFit) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>${css()}</style></head><body>
${pages.join('\n')}
${inlineFit ? fitScript() : ''}
</body></html>`;
}

/**
 * One patient's ward handover: a sheet for every week of the stay.
 *
 * @param {Object} o {patient, state, week, weeks, through, chemoDay, dates,
 *                    age, autoMeds, inlineFit}
 */
function sheetHtml(o0) {
  const o = Object.assign({ inlineFit: true }, o0 || {});
  const p = o.patient || {};
  return document_(patientPages(o), `Ward handover — ${txt(p.name)}`, o.inlineFit);
}

/* ── EVERY CHILD'S SHEET, IN ONE GO ──────────────────────────────
 * Dr Boulos, 31 October 2026: "add a button to print all handovers."
 *
 * A round is handed over as a stack of paper, printed once at eight in
 * the morning, and printing them one child at a time means one dialog
 * per bed. Each child's pages follow one another in the order the list
 * is given — which is the order the rail shows, which is the order the
 * ward walks in.
 */
function allSheetsHtml(list, o0) {
  const o = Object.assign({ inlineFit: true, through: '' }, o0 || {});
  const pages = [];
  (list || []).forEach((one) => {
    patientPages(Object.assign({}, one, { through: one.through || o.through }))
      .forEach((pg) => pages.push(pg));
  });
  if (!pages.length) return '';
  return document_(pages, `Ward handover — ${pages.length} sheet(s)`, o.inlineFit);
}

const Ward = { repairScatter, repairScattered, addLine, heldOn, holdSuggestions, undoCheckHis, labsWithoutCultures, cultureLinesOf, applyCultures, nextWorkDay, nextWorkLabel, labsInArabic, nursingLabsHtml, LAB_AR, echoDates, imagingList, imagingKindOf, lysisAdvice, LAB_MENU, HIS_LAB_TESTS, hisTestsFor, cultureForm, markOrdered, CULTURE_CODES, resultKind, cultureKindOf, cultureNeedsAlarm, labSuggestions, toBook, approveLabs, unapproveLab, LAB_SUGGEST, bloodCulturePlan, cultureTodoFor, nextCultureDay, FEVER_C, feverDays, feverDaysText, feverAdvice, VORI, KEEP_MS, feverDayStart, DAYS, IMAGING_KINDS, CULTURE_KINDS, ancOf, gcsfAdvice, GCSF, addTemps, feverChartSvg, wallNow, WEEK_MS, todoText, chemoTodoFor, cultureList, cultureRank,
  blank, normalise, dayOf, medsFor, snapshot, sheetDates, weeksSince, weeksNeeded, addDays,
  medsFromOrder, drugsFromOrder, fluidPer8, isAntimicrobial,
  shortDate, fullDate, admissionDay, chemoDayNo, dayLine, copyText, sheetHtml, allSheetsHtml,
  patientPages, fitWard, css, LAB_BLANK, redFlags, tightCbc };
if (typeof window !== 'undefined') window.Ward = Ward;
if (typeof module !== 'undefined') module.exports = Ward;

})();
