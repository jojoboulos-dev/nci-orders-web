'use strict';
/* ══════════════════════════════════════════════════════════════════
 * INSTRUCTIONS ON SCHEDULED DAYS
 *
 * Dr Boulos, 4 November 2026: "I want to schedule instructions for
 * specific days. mainly asparaginase and intrathecals, TXV gives those by
 * a schedule … by days from chemo, if today is D2 TXV, I want to be able
 * to schedule asparaginase "تعطى الاسبارا اليوم" ITH "تعطى حقنة الظهر اليوم"
 * for Days 2 4 6 9 11 13 as an example, make it future customizable."
 *
 * Each patient carries a list of schedules: a line of text and the days
 * of the chemotherapy it falls on. On those days the line prints on the
 * daily order sheet by itself; on any other day it does not.
 *
 * THE DAY IS THE CHEMOTHERAPY'S, NOT THE CALENDAR'S. "D2 TXV" is the day
 * the record already counts: the day number entered with the cycle,
 * advanced by one each calendar day (Sheet.dayLabel). So D9 lands on the
 * right date however the block was started.
 *
 * AND IT BELONGS TO ONE BLOCK. A schedule remembers the chemo/cycle name
 * it was written for. When a new block starts and the cycle is renamed,
 * the old schedule stops printing rather than firing on the new block's
 * day 9: the asparaginase of one block is not the next block's.
 *
 * Wrapped in an IIFE: the renderer's scripts share one global scope.
 * ══════════════════════════════════════════════════════════════════ */
(function () {

const txt = (v) => (v == null ? '' : String(v)).trim();

/* the two he named; anything typed is added to the list for next time */
/* 6 November 2026: "add another instruction for oncovin, and another for
   adriamycin" */
const PRESETS = ['تعطى الاسبارا اليوم', 'تعطى حقنة الظهر اليوم',
  'تعطى الاونكوفين اليوم', 'تعطى الادرياميسين اليوم'];

/* "2 4 6 9 11 13", "2,4,6", "D2 D4", "9-13" → [2, 4, 6, 9, 10, 11, 12, 13].
   Arabic-Indic digits are read too. Nothing below 1 or above 400. */
function parseDays(s) {
  const t = txt(s).replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/d/gi, ' ');
  const out = new Set();
  t.split(/[^\d-]+/).forEach((part) => {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) return;
    const a = +m[1];
    const b = m[2] ? +m[2] : a;
    if (b < a || b - a > 60) return;
    for (let n = a; n <= b; n++) if (n >= 1 && n <= 400) out.add(n);
  });
  return [...out].sort((x, y) => x - y);
}

/* which day of the chemotherapy a date is — the count Sheet.dayLabel prints */
function chemoDay(p, iso) {
  const o = p || {};
  if (o.cycleDay == null && !o.cycleName) return null;
  const base = Number(o.cycleDay) || 1;
  const a = Date.parse(`${txt(o.cycleStartDate)}T00:00:00Z`);
  const b = Date.parse(`${txt(iso)}T00:00:00Z`);
  const off = isFinite(a) && isFinite(b) ? Math.round((b - a) / 86400000) : 0;
  const n = base + (off > 0 ? off : 0);
  return n > 0 ? n : null;
}

const sameCycle = (a, b) => txt(a).toLowerCase().replace(/\s+/g, ' ')
  === txt(b).toLowerCase().replace(/\s+/g, ' ');

/* is this schedule for the block the child is in now? */
function current(p, s) { return sameCycle(s && s.cycle, p && p.cycleName); }

/* the lines that print on this date, in the order they were added */
function dueOn(p, iso) {
  const n = chemoDay(p, iso);
  if (!n) return [];
  return ((p && p.schedules) || [])
    .filter((s) => s && txt(s.text) && current(p, s) && (s.days || []).indexOf(n) >= 0)
    .map((s) => txt(s.text))
    .concat(leucovorin(p, iso), reminders(p, iso))
    .filter((t, i, all) => all.indexOf(t) === i);
}

/* ── THE SAME LINES, IN ENGLISH, FOR THE BOARD ──────────────────────
 * 7 November 2026: "reminders in the ward review should be in english".
 * The sheet keeps the ward's Arabic; the board says it in English, in full:
 * the drug (the four the ward names, leucovorin, or the protocol line's own
 * English name), when, and "under anaesthesia" / "per protocol" where the
 * Arabic says so. A line the doctor wrote that names none of these is shown
 * as written. */
const EN_DRUGS = [
  [/الاسبارا/, 'Asparaginase'], [/حقن[ةه]\s+الظهر/, 'Intrathecal (ITH)'],
  [/[اأإ]ونكوفين/, 'Vincristine (Oncovin)'], [/[اأإ]درياميسين/, 'Doxorubicin (Adriamycin)'],
  [/ليكوفورين/, 'Calcium leucovorin'],
];
function whenEn(t) {
  if (/غدا\s+الجمعة/.test(t)) return 'on Friday';
  if (/يوم\s+السبت/.test(t)) return 'on Saturday';
  if (/غدا/.test(t)) return 'tomorrow';
  if (/اليوم/.test(t)) return 'today';
  return '';
}
const drugEn = (en) => txt(en).replace(/^[–\-•\s]+/, '').split(/\s+\d|[(:—,;]/)[0].trim();
function inEnglish(p, line) {
  const t = txt(line);
  let name = (EN_DRUGS.find(([re]) => re.test(t)) || [])[1];
  if (!name) {
    const s = ((p && p.schedules) || []).find((x) => x && txt(x.text) === t && txt(x.en));
    if (s) name = drugEn(s.en);
  }
  if (!name) return t;
  /* 7 November 2026: "ommitt 'under anasthesia' and 'per protocol'" */
  return `${name} ${whenEn(t)}`.trim();
}

/* ── THE DOSE ON A SCHEDULED LINE ───────────────────────────────────
 * Dr Boulos, 7 November 2026: "add doses to asparaginase, components to
 * ITH, and vcr/doxo scheduled, it can be calculated from BSA the same way
 * we write chemo".
 *
 * A schedule made from a protocol cycle carries that line's dosing as the
 * chemotherapy sheet holds it (`s.dose`, from Cycles.linesOf): a rule —
 * per m2 or per kg, with its maximum — weight bands or age bands, or, for
 * the intrathecal, the protocol's age table. The dose is worked out here
 * the way the chemotherapy sheet works it out (Chemo.ruleForLine and
 * Chemo.doseFor, the child's weight and height today), the full protocol
 * dose — a reduction is made on the chemotherapy sheet. Nothing is
 * guessed: no weight or height, no age band, no dosing on the schedule →
 * the line prints as before, without a dose.
 *
 *   تعطى الاسبارا ٧٨٠٠ وحدة اليوم
 *   تعطى حقنة الظهر (ميثوتركسات ١٢ مجم + سيتوسار ٣٦ مجم + هيدروكورتيزون ٢٤ مجم) غدا بالتخدير
 */
const lib = (n) => (typeof window !== 'undefined' && window[n]) || (typeof globalThis !== 'undefined' && globalThis[n]) || null;
const UNIT_AR = { mg: 'مجم', unit: 'وحدة', units: 'وحدة', iu: 'وحدة', mcg: 'ميكروجرام', g: 'جم' };
const UNIT_EN = { unit: 'u', units: 'u', iu: 'u' };
const ITH_EN = { mtx: 'MTX', arac: 'Ara-C', hc: 'HC' };
function doseText(p, dose, lang) {
  if (!dose || !p) return '';
  const Sh = lib('Sheet');
  if (dose.ith) {
    const m = Sh && Sh.ageMonths ? Sh.ageMonths(p) : null;
    if (m == null) return '';
    const band = (dose.ith.bands || []).find((b) => m >= b.from && m <= b.to);
    const rows = dose.ith.rows || [];
    if (!band || !rows.length || rows.some((r) => band[r.key] == null)) return '';
    return lang === 'en'
      ? `${rows.map((r) => `${ITH_EN[r.key] || r.key} ${band[r.key]}`).join(', ')} mg`
      : rows.map((r) => `${r.label} ${band[r.key]} ${r.unit}`).join(' + ');
  }
  const Ch = lib('Chemo');
  if (!Ch || !Ch.ruleForLine || !Ch.doseFor) return '';
  let rule = null;
  try { rule = Ch.ruleForLine(dose, p); } catch (e) { rule = null; }
  if (!rule) return '';
  const d = Ch.doseFor(rule, p, 0);
  if (!d || !txt(d.text)) return '';
  const u = String(rule.unit || '').toLowerCase();
  /* 7 November 2026: units (asparaginase) "whole number" — 7817.4 → 7817 */
  const amount = /^(unit|units|iu)$/.test(u) && Number.isFinite(d.value) ? String(Math.round(d.value)) : d.text;
  return `${amount} ${lang === 'en' ? (UNIT_EN[u] || rule.unit) : (UNIT_AR[u] || rule.unit)}`;
}
const nounOf = (t) => { const m = /^تعطى\s+(.+?)\s+اليوم$/.exec(txt(t)); return m ? m[1] : ''; };
/* the current schedule a due line comes from — its own line, or the
   day-before reminder of it ("تعطى حقنة الظهر غدا بالتخدير") */
function scheduleOf(p, line) {
  const t = txt(line);
  return ((p && p.schedules) || []).find((x) => x && (x.dose || txt(x.manualDose)) && current(p, x) && nounOf(x.text)
    && t.indexOf(`تعطى ${nounOf(x.text)} `) === 0) || null;
}
function lineDose(p, line, lang) {
  const sch = scheduleOf(p, line);
  /* a dose the doctor typed beside the line wins (doseInfo) */
  if (sch && txt(sch.manualDose)) return { text: txt(sch.manualDose), ith: false, noun: nounOf(sch.text) };
  return sch ? { text: doseText(p, sch.dose, lang), ith: !!sch.dose.ith, noun: nounOf(sch.text) } : null;
}
function withDose(p, line) {
  const t = txt(line);
  const d = lineDose(p, t, 'ar');
  if (!d || !d.text) return t;
  return t.replace(`تعطى ${d.noun} `, d.ith ? `تعطى ${d.noun} (${d.text}) ` : `تعطى ${d.noun} ${d.text} `);
}
/* 9 November 2026, Dr Boulos: "The scheduled lines of aspara and
   intrathecal, oncovin and adriamycin still do not mention the doses in
   milligrams." A scheduled line's dose as it prints, or why it cannot be
   worked out — shown beside the line on the orders screen, so a missing
   dose is never silent. */
function doseInfo(p, s) {
  if (!s) return { why: '' };
  if (txt(s.manualDose)) return { text: txt(s.manualDose), manual: true };
  if (!s.dose) {
    return { why: p && p.cycleKey && p.cycleKey.charAt(0) !== '@'
      ? 'the protocol gives this line no single dose'
      : 'no protocol dose: choose the chemo / cycle from the protocol list (Edit patient), not typed' };
  }
  const t = doseText(p, s.dose, 'ar');
  if (t) return { text: t };
  if (s.dose.ith) return { why: 'no dose: the child\'s date of birth (age) is needed' };
  return { why: 'no dose: the child\'s weight and height are needed' };
}
/* what the daily order sheet prints: the due lines, each with its dose */
function dueOnDosed(p, iso) {
  return dueOn(p, iso).map((t) => {
    /* 8 November 2026: the leucovorin after an ITH, with the cycle's dose
       (p.leucoDose, from its leucovorin line): "تعطى كالسيوم ليكوفورين ٨ مجم
       اليوم حسب البروتوكول" */
    /* 9 November 2026: "print calcium leucovorin at 5mg/m2 the day after
       every ith" — 5 mg/m² of the child's BSA, whatever the cycle */
    if (t === LEUCO_TODAY && p) {
      const d = doseText(p, LEUCO_ITH, 'ar');
      return d ? `تعطى كالسيوم ليكوفورين ${d} اليوم حسب البروتوكول` : t;
    }
    /* 12 November 2026, Dr Boulos: "add the arabic line from the chemo
       protocol to the doctor orders: اسبارا … على ساعة و نصف مع ديكسا افيل"
       — on the day it is given, the protocol's own wording (its forms:
       "اسباراجيناز ... وحدة وريد على ساعة و نصف مع ديكسا و افيل") */
    const full = protocolWords(p, t);
    if (full) return full;
    const d = withDose(p, t);
    if (/الاسبارا/.test(d) && / اليوم/.test(d) && !/ساعة/.test(d)) return d.replace(/ اليوم/, ` ${ASP_HOW} اليوم`);
    return d;
  });
}
/* 12 November 2026: "retrieve the whole arabic line for every
   chemotheraputic agent scheduled" — a line due today whose schedule keeps
   its protocol's wording (s.ar, Cycles.protocolLine) prints that wording,
   the dose in its first blank: "تعطى اونكوفين (فينكريستين) 1.2 مجم وريد على
   مدى ١٥ دقيقة اليوم". With no dose worked out, the blank stays for the pen. */
function protocolWords(p, line) {
  const t = txt(line);
  if (!/ اليوم$/.test(t)) return '';
  const sch = scheduleOf(p, t);
  if (!sch || !txt(sch.ar)) return '';
  const d = lineDose(p, t, 'ar');
  let ar = txt(sch.ar);
  if (d && d.text) {
    const unit = /(وحدة|مجم|ملجم|جم|ميكروجرام|مل)\s*$/.exec(d.text);
    ar = unit
      ? ar.replace(/\.{6,}\s*(وحدة|مجم|ملجم|جم|ميكروجرام|مل)?/, d.text)
      : ar.replace(/\.{6,}/, d.text);
  }
  return `تعطى ${ar} اليوم`;
}
const ASP_HOW = 'وريد على ساعة و نصف مع ديكسا و افيل';

/* ── THE CHEMOTHERAPY IN THE TO-DO ───────────────────────────────────
 * Dr Boulos, 7 November 2026: "always write chemo in the to do: 'asp
 * today', 'ith tomorrow', only today and tomorrow".
 *
 * Every chemotherapy line due on the day and the day after, in the ward's
 * shorthand: asp, ith, oncovin, adria — and any other protocol drug by its
 * own English name, lower case ("cytarabine today"). Calcium leucovorin is
 * the rescue, not chemotherapy, and a line the doctor wrote that names no
 * drug the app knows is left to the doctor. Worked out each time from the
 * schedule, never stored: the to-do is always the schedule's. */
const SHORT = [[/الاسبارا/, 'asp'], [/حقن[ةه]\s+الظهر/, 'ith'], [/[اأإ]ونكوفين/, 'oncovin'], [/[اأإ]درياميسين/, 'adria']];
function chemoShort(p, line) {
  const t = txt(line);
  if (/ليكوفورين/.test(t)) return '';
  const hit = SHORT.find(([re]) => re.test(t));
  if (hit) return hit[1];
  const s = ((p && p.schedules) || []).find((x) => x && txt(x.text) === t && txt(x.en));
  return s ? drugEn(s.en).toLowerCase() : '';
}
function chemoTodo(p, iso) {
  if (!txt(iso)) return [];
  const out = [];
  /* 12 November 2026, Dr Boulos: "remove doses of scheduled chemo from
     handover" — the drug and the day only: "asp today", "ith tomorrow".
     The doses stay on the doctor's order sheet (dueOnDosed). */
  const add = (line, when) => {
    const n = chemoShort(p, line);
    if (!n) return;
    const t = `${n} ${when}`;
    if (out.indexOf(t) < 0) out.push(t);
  };
  dueOn(p, iso).filter((t) => /اليوم/.test(t)).forEach((t) => add(t, 'today'));
  dueOn(p, addDays(iso, 1)).filter((t) => /اليوم/.test(t)).forEach((t) => add(t, 'tomorrow'));
  return out;
}

/* ── WHAT THE BOARD LISTS ───────────────────────────────────────────
 * 7 November 2026: "mention other chemo if due today, or anything due
 * tomorrow if tomorrow is friday, and make it say: Asparaginase on
 * Friday". Today: every line due today, any drug. Tomorrow: the day-before
 * reminders. On a Thursday, EVERYTHING due on Friday — not only the four
 * the sheet reminds of — each as "<drug> on Friday"; Saturday's reminders
 * as "<drug> on Saturday". [{ kind: 'today' | 'soon', text }] */
function boardLines(p, iso) {
  const out = [];
  const seen = new Set();
  const add = (kind, text) => { if (text && !seen.has(text)) { seen.add(text); out.push({ kind, text }); } };
  const due = dueOn(p, iso);
  due.filter((t) => /اليوم/.test(t)).forEach((t) => add('today', inEnglish(p, t)));
  const thursday = weekday(iso) === 4;
  if (thursday) {
    dueOn(p, addDays(iso, 1)).filter((t) => /اليوم/.test(t))
      .forEach((t) => add('soon', inEnglish(p, t).replace(/\s+today$/, ' on Friday')));
  }
  due.filter((t) => !/اليوم/.test(t) && /غدا|يوم السبت/.test(t))
    .filter((t) => !(thursday && /غدا\s+الجمعة/.test(t)) || !seen.has(inEnglish(p, t)))
    .forEach((t) => add('soon', inEnglish(p, t)));
  return out;
}

/* ── A WEEKLY ECHO FOR AML AND RELAPSED ALL ─────────────────────────
 * Dr Boulos, 6 November 2026: "add a reminder for a weekly echo for AML
 * and ALL relapse patients, add a reminder if more than 1 week has passed
 * since the last echo."
 *
 * WHO: the diagnosis, the cycle or the second title says AML (or acute
 * myeloid, or APL — not chronic myeloid), or says ALL together with
 * relapse / R-16 (the relapse protocol). The cycle keys carry the disease
 * («AML :: FLAG-M — Cycle n», «ALL Relapse (R-16) :: …»), so a child put
 * on one of those cycles is covered even when the diagnosis is brief.
 *
 * WHEN: from the last echo the doctor recorded (p.lastEcho): due on the
 * seventh day, overdue after it, and asked for daily while none is on
 * record. 7 November 2026: "doctor orders shouldnt show anything echo
 * related" — it shows on the board and the orders screen only, in English;
 * the `line` stays for reference but nothing prints it. */
const ECHO_TODAY = 'يعمل ايكو على القلب اليوم (أسبوعي)';
function needsEcho(p) {
  const o = p || {};
  const t = [o.diagnosis, o.cycleKey, o.cycleName, o.cycle2 && o.cycle2.key, o.cycle2 && o.cycle2.name].map(txt).join(' | ');
  const aml = /\bAML\b|\bAPL\b/.test(t) || /acute\s+myeloid/i.test(t);   // CML is neither
  const allRelapse = /\bALL\b/.test(t) && /relaps|\bR-?16\b/i.test(t);
  return aml || allRelapse;
}
/* 11 November 2026, Dr Boulos: "Please link registered echoes in the
   ward handover or the daily handover … with the echo alarm given to AML
   and ALL relapse patients. It should not give an alarm when an echo is
   registered within the past week." `dates`: the echoes the handover
   holds (Ward.echoDates) — the last echo is the latest of those and the
   one recorded on the orders screen, up to the day asked about. */
function echo(p, iso, dates) {
  if (!needsEcho(p) || !txt(iso) || (p && p.discharged)) return { state: 'n/a' };
  const day = txt(iso);
  const last = [txt(p.lastEcho)].concat((dates || []).map(txt))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= day).sort().pop() || '';
  const a = Date.parse(`${last}T00:00:00Z`);
  if (!last || !isFinite(a)) return { state: 'none', line: 'يعمل ايكو على القلب اليوم (أسبوعي) — لا يوجد ايكو سابق مسجل' };
  const days = Math.round((Date.parse(`${txt(iso)}T00:00:00Z`) - a) / 86400000);
  if (days < 7) return { state: 'ok', days, last, next: addDays(last, 7) };
  if (days === 7) return { state: 'due', days, last, line: ECHO_TODAY };
  return { state: 'overdue', days, last, line: `يعمل ايكو على القلب اليوم — متأخر، آخر ايكو منذ ${days} ${days <= 10 ? 'أيام' : 'يوما'}` };
}

/* ── THE DAY BEFORE ASPARAGINASE ───────────────────────────────────
 * Dr Boulos, 5 November 2026: "add an additional instruction تعطى الاسبارا
 * غدا in every day minus one of the تعطى الاسبارا اليوم. You have to tell
 * if a patient is going to receive asparaginase one day before. Also,
 * Friday is off. If a patient has aspara on Saturday, you have to say from
 * Thursday." So, for every asparaginase schedule of the current block:
 *   - the sheet of the day before an asparaginase day says
 *     «تعطى الاسبارا غدا»;
 *   - Thursday's sheet says «تعطى الاسبارا يوم السبت» for a Saturday one,
 *     Friday being off — and Friday's sheet, if one is printed, does not
 *     repeat it. */
/* Later the same day: "If any drug is scheduled for Friday, you have to
 * mention the name of the day. This also applies to Saturday. So if an
 * Aspara is scheduled for Friday, the Thursday sheet has to print
 * تعطى الاسبارا غداً الجمعة. The one day before rule also applies to
 * intrathecals … تعطى حقنة الظهر غدا بالتخدير." */
const REMIND = [
  { re: /الاسبارا\s+اليوم/, say: (when) => `تعطى الاسبارا ${when}` },
  /* 9 November 2026: "print تعطى حقنة الظهر غدا بالتخدير، يصوم before every ith" */
  { re: /حقن[ةه]\s+الظهر|intrathecal|\bITH\b/i, say: (when) => `تعطى حقنة الظهر ${when} بالتخدير، يصوم` },
  /* the same day-before reminder, Friday and Saturday named, for the two
     added on 6 November */
  { re: /[اأإ]ونكوفين|oncovin|vincristine|فينكريستين/i, say: (when) => `تعطى الاونكوفين ${when}` },
  { re: /[اأإ]درياميسين|adriamycin|doxorubicin|دوكسوروبيسين/i, say: (when) => `تعطى الادرياميسين ${when}` },
];
const ASPARA_DAY = REMIND[0].re;
const addDays = (iso, n) => {
  const d = new Date(`${txt(iso)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso) => new Date(`${txt(iso)}T00:00:00Z`).getUTCDay();   // 4 Thu, 5 Fri, 6 Sat
function reminders(p, iso) {
  const out = [];
  if (!txt(iso)) return out;
  const wd = weekday(iso);
  REMIND.forEach((k) => {
    const mine = ((p && p.schedules) || []).filter((s) => s && current(p, s) && k.re.test(txt(s.text)));
    if (!mine.length) return;
    const on = (date) => {
      const n = chemoDay(p, date);
      return !!n && mine.some((s) => (s.days || []).indexOf(n) >= 0);
    };
    /* Friday is off: its sheet repeats nothing */
    if (wd !== 5 && on(addDays(iso, 1))) out.push(k.say(wd === 4 ? 'غدا الجمعة' : 'غدا'));
    if (wd === 4 && on(addDays(iso, 2))) out.push(k.say('يوم السبت'));
  });
  return out;
}

/* ── CALCIUM LEUCOVORIN AFTER EVERY INTRATHECAL ───────────────────
 * 6 November 2026: "add calcium leucovorin according to protocol the next
 * day of every ITH automatically, and add a remark to give it tomorrow in
 * the order sheet of the day of ITH." Whatever scheduled the intrathecal —
 * a protocol cycle or the doctor — the day after it prints the leucovorin,
 * and the day of it says it is due tomorrow (Thursday names Friday). */
const LEUCO_TODAY = 'تعطى كالسيوم ليكوفورين اليوم حسب البروتوكول';
const LEUCO_ITH = { rule: { basis: 'bsa', per: 5, unit: 'mg', range: false } };
/* 12 November 2026, Dr Boulos: "make the calcium leucovorin rescue
   optional (tick), some protocols dont have rescue but have intrathecals"
   — p.leucoRescue: false, no rescue; true or not set, the rescue as before */
function leucovorin(p, iso) {
  if (p && p.leucoRescue === false) return [];
  const ith = ((p && p.schedules) || []).filter((s) => s && current(p, s) && REMIND[1].re.test(txt(s.text)));
  const n = chemoDay(p, iso);
  if (!ith.length || !n) return [];
  const has = (d) => ith.some((s) => (s.days || []).indexOf(d) >= 0);
  const out = [];
  if (has(n - 1)) out.push(LEUCO_TODAY);
  if (has(n)) out.push(weekday(iso) === 4 ? 'تعطى كالسيوم ليكوفورين غدا الجمعة' : 'تعطى كالسيوم ليكوفورين غدا');
  return out;
}

/* the days a schedule still has to come, from a date on */
function remaining(p, s, iso) {
  const n = chemoDay(p, iso) || 0;
  return (s.days || []).filter((d) => d >= n);
}

/* the other way round: the date chemo day n falls on, for booking a
   procedure "on D9 and D16" in advance. Only from the day the count was set
   on, and never before today's day when `fromIso` is given. */
function dateOfDay(p, n, fromIso) {
  const o = p || {};
  const base = Number(o.cycleDay) || 1;
  const a = Date.parse(`${txt(o.cycleStartDate)}T00:00:00Z`);
  if (!isFinite(a) || !(n >= base)) return null;
  const iso = new Date(a + (n - base) * 86400000).toISOString().slice(0, 10);
  return fromIso && iso < txt(fromIso) ? null : iso;
}

const Schedule = { protocolWords, doseInfo, doseText, withDose, dueOnDosed, chemoTodo, chemoShort, boardLines, inEnglish, ECHO_TODAY, needsEcho, echo, LEUCO_TODAY, leucovorin, PRESETS, parseDays, chemoDay, current, dueOn, reminders, remaining, dateOfDay };
if (typeof window !== 'undefined') window.Schedule = Schedule;
if (typeof module !== 'undefined') module.exports = Schedule;

})();
