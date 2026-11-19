'use strict';
/* ═══════════════════════════════════════════════════════════════
   sheet.js — dose maths, Arabic text assembly, and the printable
   recreation of the NCI Pediatric Oncology order sheet.
   Everything here is pure: give it a patient + selections and it
   returns a self-contained HTML page.
   ═══════════════════════════════════════════════════════════════ */

/* ── Arabic-Indic numerals ───────────────────────────────────── */
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicNumerals(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/[0-9]/g, (d) => AR_DIGITS[+d])
    /* A full stop becomes the Arabic decimal separator ONLY between two
       digits. It used to be every full stop, which turned the ten dots of
       a hand-fill blank into "………٫" and the full stop ending a sentence
       into a stray comma. */
    .replace(/(?<=[٠-٩])\.(?=[٠-٩])/g, '٫');
}

/* ── Arabic body text always reads in Arabic-Indic digits ────────
 * Converting the DATA was never enough. The drug list the app actually
 * runs on lives in the doctor's own data file, and anything he types
 * afterwards — a dose slot, an extra line on the sheet, a template he
 * edits in the drug editor — arrives with whatever digits he typed. So
 * the conversion happens at RENDER time, at the point every Arabic order
 * line passes through, and nothing he writes can escape it.
 *
 * The test is the text itself: a string containing Arabic script is body
 * text and is converted; a string without it is a title, an English dose
 * spec or a note in English, and is left exactly as written. That is what
 * keeps titles, dates, the MRN and the left-hand English column in Latin
 * digits while the orders themselves read ٨, never 8.
 */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

function arabicBody(s) {
  if (s === null || s === undefined || s === '') return '';
  const t = String(s);
  return ARABIC_SCRIPT.test(t) ? toArabicNumerals(t) : t;
}

/* ── Dose maths ──────────────────────────────────────────────────
   Mirrors the workbook:  =IF(wt*perKg > max, max, wt*perKg)
   Rounded to 1 decimal place; a trailing ".0" is dropped so 900.0
   prints as ٩٠٠ and 15.6 prints as ١٥٫٦                          */
function round1(n) {
  return Math.round(n * 10) / 10;
}

/* One decimal place is right for a dose in the tens or hundreds of
   milligrams. It is not right below one milligram: the Wilms UH-3 table
   gives vincristine as 0.24 mg for a child of 0.25-0.29 m2, and one decimal
   place printed that as ٠٫٢ — a sixth of the dose lost, on a drug whose
   whole range on that sheet is 0.24 to 0.8 mg. Under 1, the figure keeps two
   decimals; everything else is unchanged. */
function fmtDose(n) {
  const a = Math.abs(n);
  if (a > 0 && a < 1) {
    const r2 = Math.round(n * 100) / 100;
    return String(r2);
  }
  const r = round1(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/* Infusion arithmetic carries three decimal places — 0.25 mic/kg/min must
   not become 0.3 — and volumes print at two, which is as fine as a syringe
   or a pump can be set. Trailing zeros are dropped: a rate of exactly 1
   prints as ١, not ١٫٠٠. */
function round3(n) {
  return Math.round(n * 1000) / 1000;
}

/* Three decimals on quantities, two on volumes — a PRINTING rule, never a
   step in the arithmetic. Rounding a derived figure mid-calculation once put
   a 2 kg child's concentration 100% out; the plan stays exact and only the
   printed text is rounded.
   A real quantity must never print as a flat zero: for the rare value too
   small for its own precision, widen rather than lie about it. */
function fmtAt(n, places) {
  if (n === null || n === undefined || !isFinite(n)) return '';
  for (let p = places; p <= 6; p++) {
    const v = parseFloat(n.toFixed(p));
    if (v !== 0 || n === 0) return String(v);
  }
  return String(n);
}

function fmtCalc(n) { return fmtAt(n, 3); }
function fmtVol(n) { return fmtAt(n, 2); }

/* ── Tablets ─────────────────────────────────────────────────────
 * Dr Boulos, 16 October 2026: "In the tablets or oral medications, add an
 * option to specify the content of one tab, and then later add an option
 * to approximate to the nearest half tab if the dose is not a solid tab.
 * Also add an option to dissolve the tablet in 5 millimeters of water and
 * give a volume out of it in case the user needs to give 3.2 milligrams
 * out of 10 milligram tablet."
 *
 * A calculated dose lands on 73.6 mg and the ward has 50 mg tablets. The
 * nurse then does one of two things, and before today did both of them in
 * her head at three in the morning:
 *
 *   ROUND IT. One and a half tablets, and the child gets 75 mg. This
 *   CHANGES THE DOSE, so the sheet prints the dose that is actually given
 *   — 75 — and says in brackets where it came from. It is off unless the
 *   physician turns it on for that drug on that day; the app does not
 *   round anybody's dose by itself.
 *
 *   DISSOLVE IT. One tablet in 5 ml of water, and give the fraction. 3.2
 *   mg out of a 10 mg tablet is 1.6 ml. The dose does NOT change here;
 *   only the way it is measured. This is the one that makes small doses
 *   possible at all, and it is why the water volume is stated on the line
 *   rather than assumed — «قرص ١٠ مجم فى ٥ سم: ١٫٦ سم» is the same shape
 *   of sentence the ward already writes by hand on the text templates.
 *
 * TWO THINGS IT REFUSES TO DO, both for the same reason — the house rule
 * is that this app never invents a dose:
 *
 *   It will not round to no tablet at all. If half a tablet is more than
 *   the dose, rounding to the nearest half gives zero, and a prescription
 *   reading «٠ قرص» is worse than useless. The plan comes back null and
 *   the milligrams print as they were.
 *
 *   It will not dissolve one tablet to deliver a whole tablet or more.
 *   Five millilitres of water hold one tablet; asking for 7 ml of it is
 *   asking for a tablet and a half out of a glass containing one. Whole
 *   tablets and over go out as milligrams.
 */
const TABLET_WATER_ML = 5;

/* how many tablets reads on paper: ٠٫٥ ، ١ ، ١٫٥ — the numeral and not
   «نصف», because a fraction in words beside Arabic-Indic digits is one
   more thing to misread at the bedside */
const fmtTabs = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function tabletPlan(drug, sel, md) {
  const strength = Number(drug && drug.tab_mg);
  const mode = (sel && sel.tab) || '';
  if (!(strength > 0) || !md || !mode) return null;
  const dose = md.capped;
  if (!(dose > 0)) return null;

  if (mode === 'half') {
    const exact = dose / strength;
    const tabs = Math.round(exact * 2) / 2;
    if (!(tabs > 0)) return null;              // never «٠ قرص»
    const given = tabs * strength;
    /* how far the rounding moved the dose. Half a tablet can be a long way
       from the calculated figure on a small child, and the screen says so
       in amber rather than letting a 56% rise go by unremarked. */
    const shift = (given - dose) / dose;
    return { mode, strength, tabs, exact, given, shift,
      doseText: fmtDose(given),
      note: `(${toArabicNumerals(fmtTabs(tabs))} قرص من ${
        toArabicNumerals(fmtDose(strength))} مجم)` };
  }

  if (mode === 'dissolve') {
    /* an empty box means the usual five millilitres; a nought in it means
       nothing can be dissolved, and is refused rather than quietly read
       as five */
    const raw = sel ? sel.tabWater : null;
    const water = (raw === '' || raw == null) ? TABLET_WATER_ML : Number(raw);
    if (!(water > 0) || dose >= strength) return null;   // one tablet, no more
    const ml = (dose / strength) * water;
    return { mode, strength, water, ml, given: dose,
      doseText: md.text,
      note: `(قرص ${toArabicNumerals(fmtDose(strength))} مجم فى ${
        toArabicNumerals(fmtVol(water))} سم: ${toArabicNumerals(fmtVol(ml))} سم)` };
  }
  return null;
}

/* why a tablet option the physician asked for is not being applied — said
   on the screen in English, never silently */
function tabletRefusal(drug, sel, md) {
  const strength = Number(drug && drug.tab_mg);
  const mode = (sel && sel.tab) || '';
  if (!(strength > 0) || !mode || !md || !(md.capped > 0)) return '';
  if (tabletPlan(drug, sel, md)) return '';
  if (mode === 'half') {
    return `half a ${fmtDose(strength)} mg tablet is more than this dose — `
      + 'rounding would give none, so the milligrams stand';
  }
  const raw = sel ? sel.tabWater : null;
  const water = (raw === '' || raw == null) ? TABLET_WATER_ML : Number(raw);
  if (!(water > 0)) return 'a tablet cannot be dissolved in no water';
  return `${fmtDose(md.capped)} mg is a whole ${fmtDose(strength)} mg tablet or more, `
    + 'and one dissolved tablet cannot deliver it — the milligrams stand';
}

function computeDose(perUnit, max, base) {
  if (!perUnit || !base) return null;
  const raw = perUnit * base;
  const capped = max != null && raw > max ? max : raw;
  return { raw, capped, capped_at_max: max != null && raw > max, text: fmtDose(capped) };
}

/* ── Body surface area, capped ───────────────────────────────────
 * Mosteller. Dr. Boulos, in capitals: "MAXIMUM BSA IS 2 METRES SQUARED,
 * ANY CALCULATION BASED ON BSA MUST MAX AT 2."
 *
 * The cap lives inside bsa() rather than at the call sites on purpose:
 * every dose, infusion, fluid volume and chemotherapy form in the app goes
 * through this one function, so there is no route by which an uncapped
 * figure can reach a prescription. A big adolescent is dosed at 2 m², not
 * at 2.3.
 *
 * bsaRaw() is the true Mosteller value, for showing the physician what the
 * child actually measures — never for arithmetic.
 */
const BSA_MAX = 2;

function bsaRaw(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  return Math.sqrt((weightKg * heightCm) / 3600);
}

function bsa(weightKg, heightCm) {
  const b = bsaRaw(weightKg, heightCm);
  return b == null ? null : Math.min(b, BSA_MAX);
}

/* true when the cap is actually biting, so the sheet can say so */
function bsaCapped(weightKg, heightCm) {
  const b = bsaRaw(weightKg, heightCm);
  return b != null && b > BSA_MAX;
}

/* A drug is dosed per kilogram (the default) or per square metre. */
function doseBase(drug, patient) {
  return (drug && drug.dose_basis === 'm2')
    ? bsa(patient.weight, patient.height)
    : patient.weight;
}

/* ── a dose the physician may move, within the range the book gives ──
 * Dr Boulos, 23 September 2026: "sometimes i need to increase some drug
 * doses, like phenytoin and tiratam ... add an option to change the dose
 * for a drug from 4mg/kg/day to 8mg/kg/day as an example, this is not for
 * all drugs, make it a check when adding a new drug."
 *
 * So a drug may be marked `adjustable`, with `md_per_kg_min` and
 * `md_per_kg_max` (and the same pair for a loading dose). The order panel
 * then shows a box beside it, exactly as an infusion has one, and what the
 * physician types there rides on the order as `sel.perKg` / `sel.ldPerKg`.
 *
 * Nothing here can print a dose outside the range the drug carries: an
 * empty, non-numeric or out-of-range box falls back to the drug's own
 * figure, and anything inside the range is clamped to it. A drug that is
 * not marked adjustable ignores the box entirely.
 */
function perKgFor(drug, sel, which) {
  const isLd = which === 'ld';
  const dflt = isLd ? (drug && drug.ld_per_kg) : (drug && drug.md_per_kg);
  if (!drug || !drug.adjustable) return dflt;
  const typed = sel && (isLd ? sel.ldPerKg : sel.perKg);
  const v = parseFloat(typed);
  if (!isFinite(v) || v <= 0) return dflt;
  const a = (isLd ? drug.ld_per_kg_min : drug.md_per_kg_min) ?? dflt;
  const b = (isLd ? drug.ld_per_kg_max : drug.md_per_kg_max) ?? dflt;
  if (a == null || b == null) return dflt;
  return Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
}

/* ── the five order-sheet groups, in printing order ──────────────
   Every drug carries a `group` key; the sheet prints each group under
   its bold, right-aligned Arabic heading. Continuous IV infusions are
   a placeholder for now — that category needs its own rate/fluid
   handling, which is still to be designed. */
const DRUG_GROUPS = [
  { key: 'antimicrobial', ar: 'مضادات حيوية:', en: 'Antimicrobials' },
  { key: 'regular', ar: 'علاجات دورية:', en: 'Regular medications' },
  { key: 'topical', ar: 'علاجات موضعية:', en: 'Topical medications' },
  { key: 'infusion', ar: 'علاجات وريدية مستمرة:', en: 'Continuous IV infusions' },
  { key: 'instruction', ar: 'تعليمات:', en: 'Instructions' },
];
const DRUG_GROUP_AR = DRUG_GROUPS.reduce((m, g) => (m[g.key] = g.ar, m), {});

/* ── what KIND of drug this is ───────────────────────────────────
 * Dr Boulos, 8 October 2026: "using basic internet search functions,
 * classify drugs in the database (cardio/CNS/...)".
 *
 * `group` above is not a class — it is a PLACE: which heading the drug
 * prints under on the daily sheet. Everything from allopurinol to
 * amlodipine to a cough syrup sits in "regular" together, because that is
 * where they belong on the paper.
 *
 * `drug_class` says what the drug IS, and the two are independent on
 * purpose: furosemide is cardiovascular and prints under the continuous
 * infusions; the eye-and-ear drops are an anti-infective and print under
 * regular medications. Nothing on the printed sheet reads this — it is for
 * finding a drug in a list of 116 and for seeing what a child is actually
 * on. The classes were read off what each drug contains; see
 * tools/classify_drugs_20261008.py for the brand names that had to be
 * looked up.
 */
const DRUG_CLASSES = [
  { key: 'antibacterial', en: 'Antibacterial' },
  { key: 'antifungal', en: 'Antifungal' },
  { key: 'antiviral', en: 'Antiviral' },
  { key: 'cardiovascular', en: 'Cardiovascular' },
  { key: 'cns', en: 'CNS — sedation, analgesia, seizures' },
  { key: 'respiratory', en: 'Respiratory' },
  { key: 'gastrointestinal', en: 'Gastrointestinal' },
  { key: 'renal', en: 'Renal and metabolic' },
  { key: 'endocrine', en: 'Endocrine and steroids' },
  { key: 'haematology', en: 'Haematology' },
  { key: 'oncology', en: 'Chemotherapy' },
  { key: 'allergy', en: 'Antihistamine' },
  { key: 'fluids', en: 'Fluids' },
  { key: 'topical', en: 'Topical, eye and mouth' },
  { key: 'supportive', en: 'Supportive and vitamins' },
  { key: 'none', en: 'Not a drug — an instruction or a measurement' },
];
const DRUG_CLASS_EN = DRUG_CLASSES.reduce((m, c) => (m[c.key] = c.en, m), {});

/* ── the nutrition recommendations ───────────────────────────────
 * Dr Boulos, 8 October 2026: "add another title توصيات التغذية below
 * regular/continous IV infusion … make it underlined and bold like them,
 * and leave it for handwriting, lowest line in the orders".
 *
 * It is a heading of the same kind as the five above — bold, underlined,
 * flush right — and it is the only one the app never fills in. What goes
 * under it is decided at the bedside between the doctor and whoever is
 * feeding the child, so it prints as the heading and three rules to write
 * on, on every sheet whether anything else was ordered or not. Three and
 * not two since 16 October 2026 — "should have 3 lines below, not just 2,
 * a minimum" — because two is one line of handwriting and an apology.
 *
 * It sits DIRECTLY AFTER THE LAST DRUG — Dr Boulos, 14 October 2026: "Put
 * the توصيات التغذية headline just after the last drug. Not at the bottom
 * two lines." It used to print below the blank rules at the foot of the
 * page, which on a short round left it an inch under the last order with
 * nothing in between.
 *
 * The rules are deliberately NOT `.line.blank`. The fitter gives the
 * blank writing rules up first when a page is tight, which would leave
 * this heading at the very bottom of a full sheet with nowhere to write
 * under it — a heading nobody can answer. These rules are part of the
 * section, so the sheet shrinks or spills to keep them.
 */
const NUTRITION_AR = 'توصيات التغذية:';
const NUTRITION_RULES = 3;
/* 6 November 2026: the nutrition module (renderer/nutrition.js) writes
   the dietitian's orders for the day here. They print under the heading,
   and the rules to write on follow them: three in all, never fewer than
   one, so there is always room for the pen after what was typed. */
function nutritionLines(written) {
  const typed = (written || []).map((t) => String(t == null ? '' : t).trim()).filter(Boolean);
  return [{ text: NUTRITION_AR, heading: true },
    ...typed.map((t) => ({ text: t, wrap: true })),
    ...Array.from({ length: Math.max(1, NUTRITION_RULES - typed.length) }, () => ({ write: true }))];
}

/* ── Continuous IV infusions ─────────────────────────────────────
 * An ampoule holds `amp_mg` mg in `amp_ml` ml. It is made up to
 * `dilute_ml` ml TOTAL of the chosen diluent (or given neat), and run at
 * whatever ml/hour delivers `dose_per` unit/kg (or /m2) per hour or per
 * minute. Prints as, e.g.
 *   امبول دورميكم (١٠ ملجم فى ٢ مل) فى ٢٠ سم محلول ملح، بمعدل ٠٫٧ سم فى الساعة   5 mic/kg/min
 */
const DILUENTS = {
  ns: 'محلول ملح',
  g5: 'محلول ج٥٪',
  g5ns: 'محلول ج٥٪ + ملح',
  none: '',
};

/* The prescribing dose belongs to the ORDER, not the drug: the same
   ampoule is run at whatever the patient needs today. `sel.dose` is what
   the physician typed; the drug's own dose_per is only the starting
   suggestion. Everything else — concentration, ml/hour — follows from it.
   A drug that carries a range (fentanyl 0.5-4 mic/kg/hr, ketamine 5-20
   mic/kg/min) holds the typed figure inside it, the same way an adjustable
   calculated drug does: a slip of the finger cannot run a pump off the end
   of the scale. A drug with no range keeps whatever is typed. */
function infusionDose(drug, sel) {
  const typed = sel && sel.dose;
  const n = Number(typed);
  const asked = (typed !== undefined && typed !== '' && isFinite(n) && n > 0) ? n : drug.dose_per;
  const lo = drug.dose_min, hi = drug.dose_max;
  if (lo == null || hi == null) return asked;
  return Math.min(Math.max(asked, Math.min(lo, hi)), Math.max(lo, hi));
}

/* ── the 24-hour syringe ──────────────────────────────────────────
 * The ward's own convention for adrenaline and noradrenaline: instead of
 * a fixed dilution run at whatever rate the dose needs, make up ONE
 * syringe per day at a round rate the nurse never has to change —
 * 24 ml at 1 ml/hour, or 48 ml at 2 ml/hour. Both run for exactly 24
 * hours, so the syringe must hold 24 hours' worth of drug and the maths
 * runs backwards: the dose fixes the QUANTITY to draw up, not the rate.
 *   V = 24R  ⇒  (mgPerHour × 24) / V  ==  mgPerHour / R   ✓ */
const SYRINGE_24 = {
  '24': { volumeMl: 24, ratePerHour: 1 },
  '48': { volumeMl: 48, ratePerHour: 2 },
};

/* A drug may ship preferring the 24-hour syringe (adrenaline, noradrenaline);
   the order still wins, including an explicit '' meaning "standard dilution". */
function syringe24Choice(sel, drug) {
  const v = (sel && sel.syr24 != null) ? sel.syr24 : (drug && drug.syr24_default);
  return SYRINGE_24[String(v)] || null;
}

/* ── adult mode ───────────────────────────────────────────────────
 * Dr Boulos, 26 September 2026: "Add an adult mode of infusion for every
 * drug where the user inputs ampoule volume and power, and number of
 * ampoules per 50ml syringe, and dose in mic or mg per min or hour or
 * just define the rate, and you complete the calculation whichever way,
 * not per kg or m2 ... add the option of vials, where its like an ampoule
 * but it has powder, just milligrams, not in volume."
 *
 * Nothing here is per kilogram. The ward says what it is holding — an
 * ampoule of so many milligrams in so many millilitres, or a VIAL, which
 * is a powder and adds no volume at all — and how many go into the 50 ml
 * syringe. That fixes the concentration. After that the physician gives
 * EITHER the dose or the rate and the other one follows:
 *
 *      concentration = ampoules x strength / 50 ml
 *      rate  = dose per hour / concentration
 *      dose  = rate x concentration
 */
const ADULT_SYRINGE_ML = 50;
/* The pump rates the ward will actually set, slowest first. Dr Boulos,
   26 September 2026, on what to do when the ampoules come to more than the
   syringe holds: "i meant more concentration and to allow dosage in rates
   more than 2, like 4 or 5 or 8 or even 10."

   The arithmetic only runs one way: for a fixed dose per hour, a SLOWER rate
   needs a STRONGER syringe, so more ampoules and more volume. The most
   concentrated syringe the ward can make is therefore the slowest rate whose
   ampoules still fit 50 ml — and when the drug is dilute that rate is 4, 5,
   8 or 10 ml an hour, not 1. */
const ADULT_RATES = [0.1, 0.5, 1, 2, 4, 5, 8, 10];

const perHourMg = (amount, unit, time) =>
  (unit === 'mcg' ? amount / 1000 : amount) * (time === 'min' ? 60 : 1);
const fromHourMg = (mgPerHour, unit, time) =>
  (unit === 'mcg' ? mgPerHour * 1000 : mgPerHour) / (time === 'min' ? 60 : 1);

const num = (v) => {
  const n = Number(v);
  return (v !== undefined && v !== null && v !== '' && isFinite(n) && n > 0) ? n : null;
};

function adultUnits(drug, sel) {
  return {
    unit: (sel && sel.adultUnit) || (drug.dose_unit === 'ml' ? 'mg' : drug.dose_unit) || 'mg',
    time: (sel && sel.adultTime) || drug.dose_time || 'hr',
  };
}

/* What the ward is holding, and what one 50 ml syringe of it comes to. */
function adultMakeUp(drug, sel) {
  const vial = sel && sel.vial != null ? !!sel.vial : !!drug.vial;
  const strength = num(sel && sel.ampMg) || num(drug.amp_mg);
  const perAmpMl = vial ? 0 : (num(sel && sel.ampMl) || num(drug.amp_ml) || 0);
  const count = num(sel && sel.ampCount) || 1;
  if (!strength) return null;
  const drugMg = strength * count;
  const drawMl = perAmpMl * count;
  return {
    vial, strength, perAmpMl, count, drugMg, drawMl,
    volumeMl: ADULT_SYRINGE_ML,
    concentration: drugMg / ADULT_SYRINGE_ML,      // mg per ml
    // a powder adds no volume, so only an ampoule can overfill the syringe
    overfill: drawMl > ADULT_SYRINGE_ML,
  };
}

/* How many ampoules a 50 ml syringe needs to deliver this mg/hour at each of
   the ward's standard rates, and whether that many physically fit. Slowest
   (most concentrated) first, so the first one that fits is the strongest
   syringe the ward can make. */
function adultRateOptions(make, mgPerHour) {
  if (!make || !mgPerHour) return [];
  return ADULT_RATES.map((rate) => {
    const needMg = (mgPerHour / rate) * ADULT_SYRINGE_ML;
    /* Ampoules come whole, so the syringe ends up a little STRONGER than the
       rung asked for, and the pump must therefore be set a little SLOWER than
       the rung. `setRate` is the figure the ward dials; `rate` is only the rung
       that chose the ampoule count. Printing the rung would overdose by the
       rounding - 8 ampoules at a nominal 2 ml/hr really wants 1.88. */
    const ampoules = Math.ceil(needMg / make.strength);
    const drawMl = make.vial ? 0 : ampoules * make.perAmpMl;
    const concentration = (ampoules * make.strength) / ADULT_SYRINGE_ML;
    const setRate = mgPerHour / concentration;
    return {
      rate, ampoules, drawMl, concentration, setRate,
      drugMg: ampoules * make.strength,
      fits: drawMl <= ADULT_SYRINGE_ML,
      hours: ADULT_SYRINGE_ML / setRate,
    };
  });
}

function adultPlan(drug, sel) {
  const make = adultMakeUp(drug, sel);
  if (!make || !make.concentration) return null;
  const { unit, time } = adultUnits(drug, sel);
  const typedDose = num(sel && sel.adultDose);
  const typedRate = num(sel && sel.adultRate);

  let mgPerHour, from;
  if (typedDose != null) {
    mgPerHour = perHourMg(typedDose, unit, time);
    from = 'dose';
  } else if (typedRate != null) {
    mgPerHour = typedRate * make.concentration;
    from = 'rate';
  } else {
    return { adult: true, ...make, unit, time, mgPerHour: null, mlPerHour: null, from: null,
             options: [], tooFast: false, needsFit: make.overfill, best: null, dose: null };
  }
  const mlPerHour = mgPerHour / make.concentration;
  const options = adultRateOptions(make, mgPerHour);
  return {
    adult: true, ...make, unit, time, from,
    mgPerHour,
    mlPerHour,
    dose: fromHourMg(mgPerHour, unit, time),
    /* a 50 ml syringe that will not see the day out: the ward is changing
       it more than once a shift, and a slower, stronger one is wanted */
    tooFast: mlPerHour * 24 > ADULT_SYRINGE_ML,
    /* the make-up the ward should reach for: the strongest 50 ml syringe
       whose ampoules fit, whatever rate that turns out to need */
    best: options.find((o) => o.fits) || null,
    /* show the table when the syringe cannot be made as entered, or when the
       one that can be made would not last the day */
    needsFit: make.overfill || mlPerHour * 24 > ADULT_SYRINGE_ML,
    options,
  };
}

/* Is this child's infusion already at or past an adult's dose?
   Dr Boulos: "Whenever the weight of the child or the dosage cause a dose
   per time that is larger than the minimum, suggest adult dosing, and
   whenever it passes the maximum, strongly suggest adult dosing."

   `adult_min` and `adult_max` are ALWAYS micrograms an hour, on every drug,
   whatever unit that drug is dosed in elsewhere. The list mixes mic/min,
   mic/hr and mg/hr, so a range read in the drug's own unit would mean a
   different thing on every row - and would change meaning again the moment
   the panel's own unit selectors were touched. One fixed unit, asked for and
   stored the same way everywhere. */
const ADULT_RANGE_UNIT = 'mcg';
const ADULT_RANGE_TIME = 'hr';

/* ── the ceiling, and what it is measured in ──────────────────────
 * Dr Boulos, 30 September 2026: "you told me no literature describes dosing
 * per time not by weight, then what is the ceiling?"
 *
 * A fair question, and the answer differs by drug. Some of these ceilings
 * ARE stated without a weight — noradrenaline at 2 to 80 mic/min, ketamine
 * at 1 to 30 mg/hr, fentanyl at 50 to 150 mic/hr, furosemide in mg/hr,
 * omeprazole at a flat 8 mg/hr. Those are honest absolute figures and
 * `adult_max` holds them, in micrograms an hour.
 *
 * The inotropes are not like that. Adrenaline, milrinone and dobutamine are
 * only ever published per kilogram, so an absolute ceiling for them was
 * arithmetic on an imaginary 70 kg adult — and a ceiling derived that way is
 * wrong for every adult who is not 70 kg, by more than twofold across the
 * range: 42 000 mic/hr of dobutamine is 14 mic/kg/min in a 50 kg adult and
 * 6.4 in a 110 kg one, while claiming to be weight-free.
 *
 * So a drug may carry `adult_max_kg` instead — micrograms per kilogram per
 * minute, the unit its own literature uses — and the ceiling is then worked
 * out against the weight actually on the record. No reference adult enters
 * it, and the comparison is like for like.
 *
 * Exactly one of the two is set. `adult_max_kg` wins if both are.
 */
function adultCeiling(drug, patient) {
  const perKg = num(drug.adult_max_kg);
  if (perKg != null) {
    const w = Number(patient && patient.weight);
    if (!w || !isFinite(w)) return null;      // no weight, no ceiling, no guess
    return { hi: perKg * w * 60, basis: 'kg', stated: perKg, unit: 'mcg/kg/min' };
  }
  const flat = num(drug.adult_max);
  if (flat != null) return { hi: flat, basis: 'flat', stated: flat, unit: 'mic/hr' };
  return null;
}

function adultAdvice(drug, patient, sel) {
  if (sel && sel.adult) return null;
  const cap = adultCeiling(drug, patient);
  if (!cap) return null;
  const plan = infusionPlan(drug, patient, sel);
  if (!plan || !plan.mgPerHour) return null;
  const given = fromHourMg(plan.mgPerHour, ADULT_RANGE_UNIT, ADULT_RANGE_TIME);
  /* ONLY the maximum warns. Dr Boulos, 29 September 2026: "remove the alarm
     when minimum adult dose is reached, just maximum."

     The starting dose fired far too readily to mean anything - ketamine's
     adult floor is 1 mg/hr, which a 3.4 kg baby on the ordinary paediatric
     dose already passes, and adrenaline's is 1 mic/min, passed by a 10 kg
     child. A banner that appears on almost every infusion is one nobody
     reads, and it would have been drowning out the one that matters.
     `adult_min` stays in the data and in the drug editor - it is the
     starting dose the adult panel is built around - it simply no longer
     raises anything on a paediatric order. */
  /* Sitting exactly ON the ceiling is not past it. The comparison has to
     tolerate binary floating point or it becomes a lottery: dobutamine's
     ceiling and its paediatric maximum are both 20 mic/kg/min, and without
     this the same order warned above 54.5 kg and not below, purely because
     20 * w * 60 and the dose worked back through mg an hour do not land on
     the same double. */
  if (given > cap.hi * (1 + 1e-9)) {
    return { level: 'strong', given, lo: num(drug.adult_min), hi: cap.hi,
             basis: cap.basis, stated: cap.stated, statedUnit: cap.unit,
             /* what the child is actually getting, in the ceiling's own unit,
                so the banner can compare two figures that mean the same thing */
             givenStated: cap.basis === 'kg'
               ? given / (Number(patient.weight) * 60) : given,
             unit: ADULT_RANGE_UNIT, time: ADULT_RANGE_TIME };
  }
  return null;
}

/* ── manual mode ──────────────────────────────────────────────────
 * Dr Boulos, 14 October 2026: "Even for pediatric mode infusions, add a
 * tickbox called manual mode: user enters 2 of the three: rate ml/hr and
 * dose mic/kg/min and preparation: ml per 50 ml syringe, and the 3rd is
 * calculated automatically."
 *
 * Three quantities, one equation, any two give the third:
 *
 *     rate (ml/hr) x prep (ml of neat drug in the 50 ml syringe)
 *     --------------------------------------------------------- x ampoule mg/ml
 *                           50 ml
 *
 *   = milligrams an hour  =  dose x weight x (60 if per minute) / 1000 if mic
 *
 * THE FIELD LEFT EMPTY IS THE ONE THE APP WORKS OUT. That rule is the
 * whole interface: there is no mode switch inside the mode, nothing to
 * remember, and the figure the app supplied is the one with nothing typed
 * over it. Fill all three and the app does not quietly pick a winner — it
 * says they do not agree and prints none of them, because two of three
 * figures that contradict each other is exactly how the wrong rate gets
 * hung.
 *
 * Nothing here reads the drug's own dose rules. Manual mode exists for the
 * infusion the protocol does not cover, so the ceilings, the standard
 * dilutions and the 24-hour syringe all stand aside; what it will not do
 * is invent a number, and a missing weight or ampoule leaves it silent.
 */
const MANUAL_SYRINGE_ML = 50;

function manualInfusion(drug, patient, sel) {
  const m = (sel && sel.manual) || {};
  const w = Number(patient && patient.weight);
  const ampMg = num(m.ampMg != null && m.ampMg !== '' ? m.ampMg : drug && drug.amp_mg);
  const ampMl = num(m.ampMl != null && m.ampMl !== '' ? m.ampMl : drug && drug.amp_ml);
  const unit = m.unit || (drug && drug.dose_unit) || 'mcg';
  const time = m.time || (drug && drug.dose_time) || 'min';
  const out = { manual: true, unit, time, ampMg, ampMl, syringeMl: MANUAL_SYRINGE_ML,
    rate: null, dose: null, prep: null, derived: null, conflict: false, why: null };
  if (!(w > 0)) { out.why = 'no weight on the record'; return out; }
  if (!(ampMg > 0) || !(ampMl > 0)) {
    out.why = 'the ampoule strength and volume are needed before anything can be '
      + 'worked out'; return out;
  }
  const ampConc = ampMg / ampMl;                       // mg per ml of neat drug
  /* dose -> mg an hour, and back */
  const toMgHr = (dose) => dose * w * (time === 'min' ? 60 : 1) / (unit === 'mcg' ? 1000 : 1);
  const fromMgHr = (mgHr) => mgHr * (unit === 'mcg' ? 1000 : 1) / (w * (time === 'min' ? 60 : 1));

  const given = {
    rate: num(m.rate), dose: num(m.dose), prep: num(m.prep),
  };
  const have = Object.keys(given).filter((k) => given[k] != null && given[k] > 0);
  if (have.length < 2) {
    out.why = 'fill in two of the three — the rate, the dose and the millilitres '
      + `of drug in the ${MANUAL_SYRINGE_ML} ml syringe`;
    Object.assign(out, given);
    return out;
  }
  const solve = (what) => {
    if (what === 'rate') return toMgHr(given.dose) * MANUAL_SYRINGE_ML / (given.prep * ampConc);
    if (what === 'dose') return fromMgHr(given.rate * given.prep * ampConc / MANUAL_SYRINGE_ML);
    return toMgHr(given.dose) * MANUAL_SYRINGE_ML / (given.rate * ampConc);
  };
  if (have.length === 2) {
    const missing = ['rate', 'dose', 'prep'].find((k) => have.indexOf(k) < 0);
    Object.assign(out, given);
    out[missing] = solve(missing);
    out.derived = missing;
  } else {
    /* all three. They either agree or they do not; the app does not choose. */
    Object.assign(out, given);
    const want = solve('rate');
    if (Math.abs(want - given.rate) > Math.max(0.01, want * 0.02)) {
      out.conflict = true;
      out.why = `these three do not agree: ${fmtVol(given.prep)} ml in `
        + `${MANUAL_SYRINGE_ML} ml at ${fmtVol(given.rate)} ml/hr is `
        + `${fmtCalc(solve('dose'))} ${DOSE_UNIT_EN[unit] || unit}/kg/${time}, not `
        + `${fmtCalc(given.dose)}. Clear whichever one the app should work out`;
    }
  }
  if (!out.conflict) {
    out.drugMg = out.prep * ampConc;
    out.concentration = out.drugMg / MANUAL_SYRINGE_ML;
    out.mgPerHour = out.rate * out.concentration;
    out.overfill = out.prep > MANUAL_SYRINGE_ML;
    if (out.overfill) {
      out.why = `${fmtVol(out.prep)} ml of drug will not go into a `
        + `${MANUAL_SYRINGE_ML} ml syringe`;
    }
  }
  return out;
}

/* what manual mode prints on the sheet */
function manualInfusionLine(drug, patient, sel) {
  const m = manualInfusion(drug, patient, sel);
  if (m.conflict || m.why || m.rate == null || m.dose == null || m.prep == null) return '';
  const amp = `(${toArabicNumerals(fmtCalc(m.ampMg))} ملجم فى ${
    toArabicNumerals(fmtVol(m.ampMl))} مل)`;
  return `${drug.ar_name || ''} ${amp} ${toArabicNumerals(fmtVol(m.prep))} مل `
    + `فى سرنجة ${toArabicNumerals(MANUAL_SYRINGE_ML)} سم، بمعدل `
    + `${toArabicNumerals(fmtVol(m.rate))} سم فى الساعة`
      .replace(/\s+/g, ' ');
}

function manualInfusionSpec(drug, patient, sel) {
  const m = manualInfusion(drug, patient, sel);
  if (m.conflict || m.dose == null) return '';
  return `${fmtCalc(m.dose)} ${DOSE_UNIT_EN[m.unit] || m.unit}/kg/${m.time === 'min' ? 'min' : 'hr'}`;
}

function infusionPlan(drug, patient, sel) {
  if (sel && sel.adult) return adultPlan(drug, sel);
  const base = drug.dose_basis === 'm2' ? bsa(patient.weight, patient.height) : patient.weight;
  const dose = infusionDose(drug, sel);
  if (!base || !dose) return null;

  /* A fluid ordered by VOLUME — hypertonic saline at 0.1 to 0.5 ml/kg/hr —
     has no ampoule, no dilution and no concentration: the dose IS the pump
     rate. None of what follows applies to it, and neither the 24-hour
     syringe nor fluid restriction means anything for a bag of saline. */
  if (drug.dose_unit === 'ml') {
    return {
      volumeDose: true, syringe: false, neat: true, restricted: false,
      mlPerHour: dose * base * (drug.dose_time === 'min' ? 60 : 1),
      dose, ampCount: 1,
      finalMl: null, concentration: null, mgPerHour: null, drugMg: null,
    };
  }

  if (!drug.amp_mg) return null;
  // per-hour requirement, in mg
  const perHour = dose * base * (drug.dose_time === 'min' ? 60 : 1);
  const mgPerHour = drug.dose_unit === 'mcg' ? perHour / 1000 : perHour;

  const syr = syringe24Choice(sel, drug);
  if (syr) {
    /* Fluid restriction on a 24-hour syringe: the SAME day's drug made up
       to HALF the volume, run at half the rate. The concentration doubles
       and the pump gives the same mg/hour in half the water — and the
       syringe still lasts exactly 24 hours, which is the whole point of
       the ward's syringe convention. (Doubling the drug in the full volume
       would halve the rate too, but the syringe would then have to hang
       for 48 hours.) */
    const restricted = !!(sel && sel.restrict);
    const volumeMl = restricted ? syr.volumeMl / 2 : syr.volumeMl;
    const mlPerHour = restricted ? syr.ratePerHour / 2 : syr.ratePerHour;
    const drugMg = mgPerHour * 24;                       // one full day in the syringe
    const stock = drug.amp_ml ? drug.amp_mg / drug.amp_ml : null;  // mg per ml of the ampoule
    const drawMl = stock ? drugMg / stock : null;
    return {
      syringe: true,
      volumeMl,
      mlPerHour,
      drugMg,
      drawMl,
      restricted,
      // more stock to draw than the syringe holds: the ward must use a
      // stronger ampoule or the bigger syringe. Flagged, never hidden —
      // and a restricted syringe is half the size, so this matters more.
      overfill: drawMl != null && drawMl > volumeMl,
      concentration: drugMg / volumeMl,
      diluent: (drug.diluent && drug.diluent !== 'none') ? drug.diluent : 'g5',
      mgPerHour, dose, neat: false, finalMl: volumeMl,
    };
  }

  const neat = !drug.diluent || drug.diluent === 'none';
  const finalMl = neat ? drug.amp_ml : drug.dilute_ml;
  if (!finalMl) return null;

  /* Fluid restriction: DOUBLE the milligrams drawn into the same volume of
     diluent, which doubles the concentration and so halves the pump rate.
     The child gets exactly the same mg/hour in half the water. It applies
     to a diluted infusion only — there is nothing to concentrate in a drug
     given neat, and the 24-hour syringe fixes its own rate by convention. */
  const restricted = !neat && !!(sel && sel.restrict);
  const ampCount = restricted ? 2 : 1;
  const concentration = (drug.amp_mg * ampCount) / finalMl;   // mg per ml drawn up
  return { syringe: false, neat, finalMl, concentration, mgPerHour, dose,
           restricted, ampCount, drugMg: drug.amp_mg * ampCount,
           mlPerHour: mgPerHour / concentration };
}

/* mcg prints as "mic" at the bedside; ml is a volume and stays ml. */
const DOSE_UNIT_EN = { mcg: 'mic', mg: 'mg', ml: 'ml' };
const doseSpec = (drug, dose) =>
  `${fmtCalc(dose)} ${DOSE_UNIT_EN[drug.dose_unit] || 'mg'}`
  + `/${drug.dose_basis === 'm2' ? 'm2' : 'kg'}/${drug.dose_time === 'min' ? 'min' : 'hr'}`;

/* ── an adult dose still prints per kilogram ──────────────────────
 * Dr Boulos, 14 October 2026: "always print dose per kg, 3 mic/kg/min, not
 * 180mic/min, even if it is adult mode and user entered mic per minute
 * value".
 *
 * Adult mode exists because the ward thinks in absolute rates when a child
 * is big enough — 180 micrograms a minute of adrenaline, the way it is
 * written on an adult chart. But the SHEET is read by a nurse at the
 * bedside of a child, who checks it against a weight; 3 mic/kg/min is a
 * figure she can sanity-check in her head and 180 mic/min is not. So
 * whatever was typed, the note column prints per kilogram.
 *
 * The weight is always there — a patient cannot be admitted without one —
 * so there is no fallback branch here and no silent absolute figure. If a
 * weight ever is missing the spec prints nothing at all rather than an
 * absolute rate dressed up as a per-kilogram one. */
const adultSpec = (plan, patient) => {
  if (plan.dose == null) return '';
  const w = Number(patient && patient.weight);
  const unit = DOSE_UNIT_EN[plan.unit] || 'mg';
  const time = plan.time === 'min' ? 'min' : 'hr';
  if (!(w > 0)) return '';
  return `${fmtCalc(plan.dose / w)} ${unit}/kg/${time}`;
};

/* the absolute figure, for the screen beside the per-kilogram one */
const adultSpecFlat = (plan) => (plan.dose == null ? ''
  : `${fmtCalc(plan.dose)} ${DOSE_UNIT_EN[plan.unit] || 'mg'}/${plan.time === 'min' ? 'min' : 'hr'}`);

/* ── A DOSE THE PHYSICIAN CHOSE, IN THE LEFT MARGIN ──────────────
 * Dr Boulos, 24 October 2026: "for drugs with changable doses, write the
 * dose to the left, like we do with inotropes."
 *
 * An inotrope has carried its own figure in the left-hand English column
 * since the handover work — "0.5 mic/kg/min" — because the Arabic line
 * says the ampoules and the rate, not the dose, and the dose is what a
 * doctor checks. An adjustable antibiotic has exactly the same problem:
 * amikacin at 15 and amikacin at 30 mg/kg print the same Arabic sentence
 * with a different number of milligrams in it, and nothing on the page
 * says which of its two doses was meant. Now the margin says.
 *
 * IT IS ALWAYS SHOWN, not only when the dose has been moved. A figure
 * that appears only when somebody changed something is a figure nobody
 * trusts when it is absent.
 *
 * PER DOSE, NOT PER DAY. Every per-kilogram figure in the drug list is
 * the dose for ONE administration — that is the standing rule the whole
 * list is built on — so the margin says so, and gives the interval the
 * drug's own Arabic suffix states. A suffix nothing can be read out of
 * prints the dose without an interval rather than a guessed one.
 */
const latinDigits = (s) => String(s == null ? '' : s)
  .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x660))
  .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x6F0));

/* "مجم/ ٨ س  وريد" → 8. The number must be the one the word for HOURS
   follows, so "٣ أيام أسبوعيا" — three days a week — is not an interval. */
function everyHours(drug) {
  /* a bare «س» is hours; «سم» is millilitres, and a word boundary is no
     use here because Arabic letters are not word characters */
  const m = /(\d+(?:\.\d+)?)\s*(?:ساعات|ساعة|ساعه|س(?![\u0600-\u06FF]))/
    .exec(latinDigits(drug && drug.suffix_ar));
  const n = m ? Number(m[1]) : NaN;
  return isFinite(n) && n > 0 && n <= 72 ? n : null;
}

function adjustableSpec(drug, sel) {
  if (!drug || !drug.adjustable || drug.mode !== 'calc') return '';
  const per = perKgFor(drug, sel, 'md');
  if (per == null) return '';
  const unit = DOSE_UNIT_EN[drug.dose_unit] || 'mg';
  const basis = drug.dose_basis === 'm2' ? 'm2' : 'kg';
  const hrs = everyHours(drug);
  const ld = drug.ld_per_kg != null
    ? `LD ${fmtCalc(perKgFor(drug, sel, 'ld'))}, then ` : '';
  return `${ld}${fmtCalc(per)} ${unit}/${basis}/dose${hrs ? ` q${fmtCalc(hrs)}h` : ''}`;
}

/* The English dose spec, for the sheet's left-hand note column. */
function infusionSpec(drug, patient, sel) {
  if (sel && sel.manualOn) return manualInfusionSpec(drug, patient, sel);
  const plan = infusionPlan(drug, patient, sel);
  if (!plan) return '';
  return plan.adult ? adultSpec(plan, patient) : doseSpec(drug, plan.dose);
}

function infusionLine(drug, patient, sel) {
  /* manual mode stands in front of everything: the ward has given the
     make-up and the rate itself, and nothing is recomputed around it */
  if (sel && sel.manualOn) return manualInfusionLine(drug, patient, sel);
  const plan = infusionPlan(drug, patient, sel);
  if (!plan) return '';
  /* Adult mode: the ward's own make-up, and the rate that delivers it. */
  if (plan.adult) {
    if (plan.mlPerHour == null) return '';
    const what = plan.vial
      ? `${toArabicNumerals(fmtCalc(plan.count))} فيال (${toArabicNumerals(fmtCalc(plan.strength))} ملجم)`
      : `${toArabicNumerals(fmtCalc(plan.count))} امبول (${toArabicNumerals(fmtCalc(plan.strength))}`
        + ` ملجم فى ${toArabicNumerals(fmtVol(plan.perAmpMl))} مل)`;
    const warn = plan.overfill ? ' (تنبيه: الكمية أكبر من حجم السرنجة)' : '';
    return `${drug.ar_name || ''} ${what} واكمال إلى ٥٠ سم، `
      + `بمعدل ${toArabicNumerals(fmtVol(plan.mlPerHour))} سم فى الساعة${warn}`
      .replace(/\s+/g, ' ');
  }
  /* Ordered by volume: no ampoule to name and nothing to dilute it in —
     the bag hangs and the pump runs at the rate the weight asks for. */
  if (plan.volumeDose) {
    return `${drug.ar_name || ''} بمعدل ${toArabicNumerals(fmtVol(plan.mlPerHour))} سم فى الساعة`
      .replace(/\s+/g, ' ').trim();
  }
  const amp = `(${toArabicNumerals(fmtCalc(drug.amp_mg))} ملجم فى ${toArabicNumerals(fmtVol(drug.amp_ml))} مل)`;
  // three decimals, not one: 0.25 mic/kg/min must never print as 0.3
  const spec = doseSpec(drug, plan.dose);
  if (plan.syringe) {
    // one syringe per 24 hours: the quantity is what varies, the rate never does
    const qty = `${toArabicNumerals(fmtCalc(plan.drugMg))} ملجم`;
    const draw = plan.drawMl != null
      ? ` (${toArabicNumerals(fmtVol(plan.drawMl))} مل من الامبول ` +
        `${toArabicNumerals(fmtCalc(drug.amp_mg))} ملجم فى ${toArabicNumerals(fmtVol(drug.amp_ml))} مل)`
      : '';
    const upTo = `واكمال إلى ${toArabicNumerals(fmtVol(plan.volumeMl))} سم ${DILUENTS[plan.diluent] || DILUENTS.g5}`;
    const rate24 = `بمعدل ${toArabicNumerals(fmtVol(plan.mlPerHour))} سم فى الساعة لمدة ٢٤ ساعة`;
    // an impossible syringe must never print as if it were fine
    const warn = plan.overfill ? ' (تنبيه: الكمية أكبر من حجم السرنجة)' : '';
    return arabicBody(`${drug.ar_name || ''} ${qty}${draw} ${upTo}، ${rate24}${warn}`
      .replace(/\s+/g, ' ').trim());
  }
  const how = plan.neat
    ? 'بدون تخفيف'
    : `فى ${toArabicNumerals(fmtVol(drug.dilute_ml))} سم ${DILUENTS[drug.diluent] || ''}`.trim();
  const rate = `بمعدل ${toArabicNumerals(fmtVol(plan.mlPerHour))} سم فى الساعة`;
  /* Under fluid restriction the sentence is unchanged — only the number of
     ampoules in front of it and the rate at the end of it. */
  const head = plan.ampCount > 1
    ? `${toArabicNumerals(plan.ampCount)} امبول` : 'امبول';
  return `${head} ${drug.ar_name || ''} ${amp} ${how}، ${rate}`
    .replace(/\s+/g, ' ').trim();
}

/* ── IV fluids ───────────────────────────────────────────────────
 * Maintenance by the 4-2-1 rule; deficit by percent dehydration (or the
 * 50 / 100 ml/kg shorthand); hyperhydration at 3000 or 4000 ml/m2/day.
 * Maintenance and deficit normally carry potassium, hyperhydration does
 * not — but the physician decides per order. */
const FLUID_TYPES = {
  g5: 'ج٥٪',
  ns: 'محلول ملح',
  g5ns: 'ج٥٪ + محلول ملح',
  g10: 'ج١٠٪',
};

function maintenanceMlPerHour(weightKg) {
  if (!weightKg) return 0;
  const first = Math.min(weightKg, 10) * 4;
  const second = Math.max(0, Math.min(weightKg, 20) - 10) * 2;
  const rest = Math.max(0, weightKg - 20) * 1;
  return first + second + rest;
}

function fluidPlan(sel, patient) {
  const f = (sel && sel.fluid) || {};
  const regimen = f.regimen || 'maint';
  const w = patient.weight, b = bsa(patient.weight, patient.height);
  // The percentage now applies to EVERY regimen, not just maintenance —
  // a hyperhydration or an insensible-loss order can be restricted too.
  const share = fluidShare(f);
  const pct = share === 1 ? '' : `${round1(share * 100)}% of `;
  let mlPerHour = 0, note = '';

  if (regimen === 'hyper') {
    if (!b) return null;
    const perDay = (Number(f.hyperMl) || 3000) * b * share;
    mlPerHour = perDay / 24;
    note = `${pct}hyperhydration ${Number(f.hyperMl) || 3000} ml/m²/day`;
  } else if (regimen === 'insensible') {
    // insensible losses: 400 ml/m2/day
    if (!b) return null;
    const perDay = INSENSIBLE_ML_M2 * b * share;
    mlPerHour = perDay / 24;
    note = `${pct}insensible losses ${INSENSIBLE_ML_M2} ml/m²/day`;
  } else {
    if (!w) return null;
    const maint = maintenanceMlPerHour(w) * share;
    mlPerHour = maint;
    note = `${pct}maintenance (4-2-1)`;
    if (regimen === 'maint_deficit') {
      // percent dehydration x weight x 10, or the 20/50/100 ml/kg shorthand.
      // The deficit is a replacement, so the restriction applies to it too.
      const dp = Number(f.dehydPct) || 0;
      const deficit = (dp ? w * dp * 10 : w * (Number(f.dehydMlKg) || 50)) * share;
      mlPerHour = maint + deficit / 24;
      note += ` + deficit ${round1(deficit)} ml over 24 h`;
    }
  }

  /* Note: fluid RESTRICTION is not a property of the fluid order — it is a
     property of a drug infusion (double the milligrams into the same
     diluent, half the pump rate). The IV fluid line is reduced with the
     percentage instead. See infusionPlan. */

  /* The margin note is read at a glance, so it stays short: the regimen
     and its percentage. */
  const regName = regimen === 'hyper' ? 'hyperhydration'
    : regimen === 'insensible' ? 'insensible losses'
      : regimen === 'maint_deficit' ? 'maintenance + deficit' : 'maintenance';
  const printNote = share === 1 ? regName : `${round1(share * 100)}% ${regName}`;

  return { mlPerHour, per8h: mlPerHour * 8, note, printNote, share };
}

/* How much of theregimen to give, as a fraction. Blank or nonsense means
   the whole of it. `maintPct` is the old key, kept so saved orders still
   read correctly. */
function fluidShare(f) {
  const pct = Number((f || {}).pct != null && (f || {}).pct !== ''
    ? (f || {}).pct : (f || {}).maintPct);
  if (!isFinite(pct) || pct <= 0 || pct > 200) return 1;
  return pct / 100;
}
const maintenanceShare = fluidShare;      // the old name, still exported

/* Insensible losses, per square metre per day. */
const INSENSIBLE_ML_M2 = 400;

/* Deficit shorthands, in ml/kg. */
const DEHYDRATION_STEPS = [
  { mlKg: 20, label: 'Mild — 20 ml/kg' },
  { mlKg: 50, label: 'Moderate — 50 ml/kg' },
  { mlKg: 100, label: 'Severe — 100 ml/kg' },
];

function fluidLine(sel, patient) {
  const plan = fluidPlan(sel, patient);
  if (!plan) return '';
  const f = (sel && sel.fluid) || {};
  const type = FLUID_TYPES[f.type || 'g5ns'] || FLUID_TYPES.g5ns;
  const k = f.k ? ' + ٥ سم بوتاسيوم لكل ٥٠٠ مل' : '';
  if ((f.delivery || 'q8') === 'cont') {
    return arabicBody(`محاليل ${type} بمعدل ${toArabicNumerals(fmtDose(plan.mlPerHour))} سم فى الساعة${k}`);
  }
  const per8 = Math.round(plan.per8h / 10) * 10;      // a practical bag volume
  return arabicBody(`${toArabicNumerals(per8)} سم محاليل ${type} كل ٨ ساعات${k}`);
}

/* ── RD / HD, read before the drug not after it ──────────────────
   "Renal dose" and "high dose" are written into the Arabic suffix, so they
   printed at the END of the line — the far LEFT of an RTL order, which is
   the last place the eye reaches. The ward reads the marker as part of the
   drug's name ("HD Meronam"), so it is moved to the head of the string,
   which in RTL puts it immediately to the right of the drug name.
   MD and LD are deliberately not hoisted: a maintenance or loading dose is
   the ordinary case and does not get a marker at all. */
function hoistDoseMark(line) {
  const m = String(line).match(/\s+(RD|HD)\s*$/);
  if (!m) return line;
  return m[1] + ' ' + line.slice(0, line.length - m[0].length).trim();
}

/* ── Build one Arabic order line ─────────────────────────────────
   calc drugs:  [name] [LD ٱrabic + join] [MD arabic] [suffix]
   text drugs:  template with {1} {2} … replaced by what the user typed */
/* 9 November 2026, Dr Boulos: "linezolid is saved under many names, make
   it 2, oral and IV, and add strata by age … dont make below 12 and more
   than 12 two drugs". A drug may carry `strata`: [{ minYears, maxYears,
   set: { …the fields that differ } }]; the child's age picks one, whose
   fields are laid over the drug's for that child. */
function forAge(drug, patient) {
  if (!drug || !Array.isArray(drug.strata) || !drug.strata.length) return drug;
  const m = ageMonths(patient);
  if (m == null) return drug;
  const y = m / 12;
  const kg = Number(patient && patient.weight);
  /* "same goes for vori, tavanic" — some strata are by weight as well
     (minKg / maxKg: voriconazole ≥ 50 kg, ≥ 40 kg) */
  const s = drug.strata.find((x) => (x.minYears == null || y >= x.minYears) && (x.maxYears == null || y < x.maxYears)
    && (x.minKg == null || (kg && kg >= x.minKg)) && (x.maxKg == null || (kg && kg < x.maxKg)));
  if (!s) return drug;
  const out = Object.assign({}, drug, s.set || {});
  /* a loading dose given on the first day only: from day 2 of the drug
     (patient.drugStart) the line is the maintenance dose alone */
  if (out.ldDay1 && antibioticDay(patient, drug, isoToday()) > 1) { out.ld_per_kg = null; out.ld_max = null; out.ld_join = ''; }
  return out;
}
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function orderLine(drug0, sel, patient) {
  const drug = forAge(drug0, patient);
  if (drug.mode === 'infusion') return infusionLine(drug, patient, sel);
  if (drug.mode === 'fluid') return fluidLine(sel, patient);
  if (drug.mode === 'calc') {
    const base = doseBase(drug, patient);
    const md = computeDose(perKgFor(drug, sel, 'md'), drug.md_max, base);
    const parts = [drug.ar_name];
    if (drug.ld_per_kg) {
      const ld = computeDose(perKgFor(drug, sel, 'ld'), drug.ld_max, base);
      if (ld) parts.push(toArabicNumerals(ld.text), drug.ld_join || '');
    }
    /* a tablet plan changes what is PRINTED as the dose when it rounds,
       so it is read before the figure goes on the line, not bolted on after */
    const tab = tabletPlan(drug, sel, md);
    if (md) parts.push(toArabicNumerals((tab && tab.doseText) || md.text));
    parts.push(drug.suffix_ar || '');
    if (tab) parts.push(tab.note);
    const line = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return arabicBody(hoistDoseMark(line));
  }
  // free-text template
  let t = drug.template_ar || '';
  const vals = (sel && sel.slots) || {};
  for (let i = 1; i <= (drug.slots || 0); i++) {
    const v = vals[i];
    t = t.replace('{' + i + '}', v ? toArabicNumerals(v) : '        ');
  }
  return arabicBody(hoistDoseMark(t.replace(/\{\d+\}/g, '        ')));
}

/* ── Antibiotic day counter ──────────────────────────────────────
   "D3 Meronam" = the third day since Meronam was first prescribed.
   The first day of a course is D1. The number is derived from the
   date the drug was first ticked, and can be overridden per patient. */
function antibioticDay(patient, drug, forDate) {
  if (!drug || !drug.day_counter) return null;
  const starts = (patient && patient.drugStart) || {};
  const start = starts[drug.id];
  if (!start) return 1;
  const n = daysBetween(start, forDate) + 1;
  return n > 0 ? n : 1;
}

/* Given a day number, the date it should be anchored to so that
   `antibioticDay` reproduces it. Used when the doctor corrects the number. */
function anchorDateForDay(dayNumber, forDate) {
  const d = new Date(forDate + 'T00:00:00');
  d.setDate(d.getDate() - (Math.max(1, dayNumber) - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── Day label: D<n> <chemo>, auto-advanced from admission ────── */
function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00');
  const b = new Date(isoB + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/* '2026-08-27' → '27 / 8 / 2026' — day first, year on the right.
   Latin digits: the date and the cycle day stay in English on every sheet,
   even though the orders themselves read in Arabic-Indic numerals. Both
   sit in a Latin-script line ("Day 4 Induction I", "Date: 27 / 8 / 2026")
   where an Arabic-Indic digit is bidi class AN and reorders the line. */
function formatDMY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${+d} / ${+m} / ${y}`;
}

/* ── age, from the date of birth ─────────────────────────────────
 * The record used to hold the age as typed text — "9Y", "8M" — which was
 * out of date the moment it was saved, and was what the dose bands read.
 * It holds the MONTH and YEAR of birth now (the ward does not reliably
 * have the day, and no dose band in the app turns on one), and the age is
 * worked out for whatever date the sheet is being written for.
 *
 * The month is counted from its first day, so a child born in March 2022
 * is 3 years old on any day of March 2025 — the reading a ward would give.
 *
 * A DAY of birth is optional and was added on 20 September 2026, because
 * under a year "8M" is not enough to tell a nurse what a baby is: a
 * fortnight can be the difference between one dose band and the next. When
 * the day is there the age is exact and prints in days too; when it is not,
 * nothing is guessed and the age reads in whole months as it always did.
 */
function ageParts(patient, forDate) {
  const y = parseInt(patient && patient.dobYear, 10);
  const m = parseInt(patient && patient.dobMonth, 10);
  if (!y || !m) return null;
  const now = forDate ? new Date(forDate + 'T00:00:00') : new Date();
  if (isNaN(now.getTime())) return null;

  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  let days = 0;
  const dd = parseInt(patient && patient.dobDay, 10);
  const exact = dd >= 1 && dd <= 31;
  if (exact) {
    days = now.getDate() - dd;
    if (days < 0) {
      /* the birthday has not come round this month: step back a whole
         month and count from the birthday in the month before, which is
         as long as that month happens to be */
      months -= 1;
      const prevLen = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days = Math.max(0, prevLen - Math.min(dd, prevLen) + now.getDate());
    }
  }
  return months >= 0 ? { months, days, exact } : null;
}

/* The age in months — fractional when the day of birth is known, so a band
   cut at 12 months does not catch a baby of 11 months and 29 days. */
function ageMonths(patient, forDate) {
  const a = ageParts(patient, forDate);
  return a ? a.months + a.days / 30.4 : null;
}

/* "4Y 3M", "8M 12D", "19D", "—". Under a YEAR the days print as well, when
   the record carries a day of birth. From one year to two the ward thinks
   in months, so the whole age prints in months; from two years it is years
   and months, and the months are dropped when they are zero. */
function ageText(patient, forDate) {
  const a = ageParts(patient, forDate);
  if (!a) return '';
  if (a.months < 12 && a.exact) {
    if (!a.months) return `${a.days}D`;
    return a.days ? `${a.months}M ${a.days}D` : `${a.months}M`;
  }
  if (a.months < 24) return `${a.months}M`;
  const y = Math.floor(a.months / 12);
  const m = a.months % 12;
  return m ? `${y}Y ${m}M` : `${y}Y`;
}

/* 'M' / 'F' as the sheets print it, and nothing at all if it is unset */
function sexText(patient) {
  const s = String((patient && patient.sex) || '').trim().toUpperCase();
  return s === 'M' || s === 'F' ? s : '';
}

function dayLabel(patient, forDate) {
  if (!patient.cycleName && patient.cycleDay == null) return '';
  const base = Number(patient.cycleDay) || 1;
  const offset = patient.cycleStartDate ? daysBetween(patient.cycleStartDate, forDate) : 0;
  const n = base + (offset > 0 ? offset : 0);
  const first = `Day ${n} ${patient.cycleName || ''}`.trim();
  /* 6 November 2026: "add the option to add a second title. A patient can
     be day 3 total 15 and day 2 ICU at the same time." */
  const c2 = patient.cycle2;
  if (!c2 || !String(c2.name || '').trim()) return first;
  const o2 = c2.startDate ? daysBetween(c2.startDate, forDate) : 0;
  return `${first} · Day ${(Number(c2.day) || 1) + (o2 > 0 ? o2 : 0)} ${String(c2.name).trim()}`;
}

/* ── Paper: one size that fits A4 AND US Letter ──────────────────
 * Some machines in the hospital run US regional settings, so their printer
 * driver's paper is Letter. The app asks for A4 everywhere it can —
 * `pageSize: 'A4'` on both the print and the save-PDF calls, and
 * `@page { size: A4 }` in the CSS — but a driver with no A4 falls back to
 * its own default, and then a 297 mm sheet on a 279.4 mm page runs onto a
 * second page. That is the "2-page Letter document".
 *
 * Chromium's own PDF export happens to SCALE the sheet down to fit, which
 * is why this looked fine in testing and not on the ward. The Windows
 * print path does not scale — it paginates.
 *
 * So the sheet stops depending on the paper at all, and is sized to the
 * INTERSECTION of the two:
 *
 *      A4      210.0 x 297.0 mm
 *      Letter  215.9 x 279.4 mm
 *      sheet   210.0 x 277.0 mm     fits inside both, with slack
 *
 * On A4 that leaves 20 mm at the foot, which reads as an ordinary bottom
 * margin. On Letter it leaves 2.4 mm, enough to absorb driver rounding.
 * Every engine — daily sheet, chemo forms, ICU handover — uses these. */
const PAGE_W_MM = 210;
const PAGE_H_MM = 277;
const PAGE_H_PX = 1046.9;        // 277 mm at 96 dpi, for the fit scripts

/* ── The printable sheet ─────────────────────────────────────────
   Times New Roman, per Dr. Boulos. It used to lead with Simplified
   Arabic, which collides ر with و — "أورام" printed with the two letters
   overlapping. Simplified Arabic is dropped from the stack entirely
   rather than demoted, so it can never be picked again; the remaining
   fallbacks are all serif faces with real Arabic coverage, for the rare
   machine with no Times New Roman. */
const SHEET_FONT =
  "'Times New Roman','Traditional Arabic','Arabic Typesetting',Tahoma,'Liberation Serif','FreeSerif',serif";

/* Fit a patient's orders onto the page — and NEVER lose one.
 *
 * The order of sacrifice is: the empty writing rules first (they are only
 * space to write in), then the type down to a floor of 9pt, and only then
 * a second page. An order line is never given up. The previous version
 * stopped at the floor and let `.orders { overflow:hidden }` clip whatever
 * was left, so a patient on more than 27 orders had the tail of the sheet
 * silently dropped — the pharmacy saw a complete-looking page that was
 * missing drugs.
 *
 * A continuation page is a clone of the sheet: same patient tag, same date
 * and cycle day, same signatures, and both pages are numbered so a missing
 * one is obvious at the bedside. */
/* ── keep every order sheet on one page, and spill the rest ───────
 * Written as an ordinary function rather than a string because it has to
 * run in TWO places, and they must agree exactly:
 *
 *   the printed page   as an inline <script>, in the clean window main.js
 *                      opens to print or to write the PDF
 *   the preview        called from the app itself on the frame's document.
 *                      The renderer's Content Security Policy is
 *                      `script-src 'self'` and refuses an inline script
 *                      inside a srcdoc frame, so the review preview was
 *                      showing an unpaginated sheet with all its spare
 *                      blank rules while the paper came out paginated.
 */
function fitSheetPages(doc) {

  var MAX=14, MIN=9;
  /* .sheet is a fixed box (PAGE_H_MM), so its own height never changes —
     the test is whether the orders block overflows the space left for it.
     Measured on the LAST ROW's own rectangle, in fractions of a pixel.
     scrollHeight is rounded to whole pixels, so a row hanging half a pixel
     past the edge read as fitting and was then clipped away — which is how
     a single line went missing at exactly 28 orders. */
  function over(el){
    var o=el.querySelector('.orders');
    if(!o) return false;
    if(o.scrollHeight > o.clientHeight + 1) return true;
    var last=o.lastElementChild;
    if(!last) return false;
    return last.getBoundingClientRect().bottom > o.getBoundingClientRect().bottom + 0.02;
  }
  function all(){ return doc.querySelectorAll('.sheet'); }

  /* the page that carries this sheet's overflow, made on demand */
  function continuation(el){
    var next=el.nextElementSibling;
    if(next && next.classList.contains('sheet') &&
       next.getAttribute('data-pt')===el.getAttribute('data-pt') &&
       next.hasAttribute('data-cont')) return next;
    var clone=el.cloneNode(true);
    clone.setAttribute('data-cont','1');
    clone.querySelector('.orders').innerHTML='';
    clone.style.setProperty('--fs', el.style.getPropertyValue('--fs')||MAX+'pt');
    el.parentNode.insertBefore(clone, el.nextSibling);
    return clone;
  }

  /* move whole lines off the end of this page onto the next one, keeping
     their order, until this page holds */
  function spill(el){
    var guard=0;
    while(over(el) && guard++<400){
      var orders=el.querySelector('.orders');
      var kids=orders.children;
      if(kids.length<2) break;      /* a single line taller than the page */
      var next=continuation(el), no=next.querySelector('.orders');
      no.insertBefore(kids[kids.length-1], no.firstChild);
    }
  }

  function fitOne(el){
    el.style.setProperty('--fs', MAX+'pt');
    /* A continuation page keeps the full size its first page settled on, so
       every page of one patient's round reads at the same size. It only
       ever spills further. */
    if(el.hasAttribute('data-cont')){ if(over(el)) spill(el); return; }
    /* give up the empty writing rules first — they are the cheapest thing
       on the page to lose. Removed, not hidden, so a spill never carries
       an invisible row onto the next page. */
    var blanks=el.querySelectorAll('.orders .line.blank');
    for(var b=blanks.length-1; b>=0 && over(el); b--) blanks[b].remove();
    if(!over(el)) return;
    el.style.setProperty('--fs', MIN+'pt');
    if(over(el)){
      /* Even the floor will not hold it, so a second page is being paid for
         either way — spend it on readable type rather than on 9pt. Back to
         full size and let it flow. */
      el.style.setProperty('--fs', MAX+'pt');
      spill(el);
      return;
    }
    var lo=MIN, hi=MAX;              /* largest size that still fits */
    for(var k=0;k<14;k++){
      var mid=(lo+hi)/2;
      el.style.setProperty('--fs', mid+'pt');
      if(!over(el)) lo=mid; else hi=mid;
    }
    el.style.setProperty('--fs', lo+'pt');
  }

  /* "Page 1 of 2" on every page of a patient who needed more than one */
  function number(){
    var by={};
    var s=all();
    for(var i=0;i<s.length;i++){
      var k=s[i].getAttribute('data-pt');
      (by[k]=by[k]||[]).push(s[i]);
    }
    for(var k in by){
      var g=by[k];
      for(var j=0;j<g.length;j++){
        var slot=g[j].querySelector('.dayline .pg');
        if(slot) slot.textContent = g.length>1 ? 'Page '+(j+1)+' of '+g.length : '';
      }
    }
  }

  /* A page that received a spill has no writing rules left under its
     orders — put them back until the page is full, so the last page of a
     long round looks like every other sheet. */
  function pad(el){
    var orders=el.querySelector('.orders'), guard=0;
    while(!over(el) && guard++<60){
      var row=document.createElement('div');
      row.className='line blank';
      row.innerHTML='<span class="dmark"></span><span class="txt">.</span>';
      orders.appendChild(row);
    }
    if(orders.lastChild && orders.lastChild.classList &&
       orders.lastChild.classList.contains('blank')) orders.removeChild(orders.lastChild);
  }

  function fit(){
    /* the list grows as pages spill, so it is re-read every time */
    var i=0, guard=0;
    while(i<all().length && guard++<200){ fitOne(all()[i]); i++; }
    var s=all();
    for(var j=0;j<s.length;j++) if(s[j].hasAttribute('data-cont')) pad(s[j]);
    number();
  }
  fit();
}

const SHEET_FIT = '<scr' + `ipt>(function(){
  var fit=function(){ (${fitSheetPages.toString()})(document); };
  if(document.readyState==='complete') fit();
  else window.addEventListener('load',fit);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fit);
})();</scr` + 'ipt>';

function sheetCss(fontOverride) {
  const f = fontOverride ? `'${fontOverride}',${SHEET_FONT}` : SHEET_FONT;
  return `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  /* A browser drops background colours when it PRINTS unless it is told
     not to, which sent every tinted table head — the chemotherapy sheets'
     look-up tables, the ICU tabs — to the printer white. 20 September 2026. */
  body { font-family: ${f}; color: #000;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Geometry measured off the scanned blank at 300 dpi:
     content box x 23.4-192.3mm, demarcation at y 96.8mm (0.76mm thick),
     21 order rules from y 108.3mm on an 8.04mm pitch. */
  .sheet {
    width: ${PAGE_W_MM}mm; height: ${PAGE_H_MM}mm; padding: 11mm 17.7mm 10mm 23.4mm;
    display: flex; flex-direction: column;
    page-break-after: always; position: relative; background: #fff;
  }
  .sheet:last-child { page-break-after: auto; }

  /* ── letterhead: ONE row, three equal-height blocks ─────────────
     Quality stamp at the left, patient tag in the middle, NCI logo with
     the department name under it at the right. The tag sets the height and
     the two side blocks stretch to match it, so the three read as one band
     across the top of the page instead of three sizes stacked. */
  .lh { direction: ltr; display: flex; align-items: stretch; gap: 4mm; }
  .lh .side { flex: 0 0 30mm; display: flex; flex-direction: column;
              align-items: center; justify-content: center; gap: 1mm;
              min-width: 0; overflow: hidden; }
  /* the images take whatever height the row has, never more */
  .lh .side img { flex: 0 1 auto; min-height: 0; max-height: 100%;
                  max-width: 100%; object-fit: contain; }
  /* centred under the logo — RTL text defaults to flush right, which left
     the two lines ragged against the edge of the page */
  .lh .dept {
    font-size: 9.5pt; font-weight: 700; line-height: 1.3;
    direction: rtl; white-space: nowrap; text-align: center; width: 100%;
  }

  /* ── patient tag ───────────────────────────────────────────────
     The identity above the biometrics, centred between the two logos. */
  .hdr { flex: 1; min-width: 0; display: flex; justify-content: center; }
  .tag {
    border: 0.5mm solid #000; padding: 2.4mm 7mm 2mm; width: 100%;
    text-align: center; display: flex; flex-direction: column;
    justify-content: center;
  }
  .tag .id { direction: rtl; font-size: 15pt; font-weight: 700; line-height: 1.5; }
  .tag .id .mrn, .tag .id .dx { font-size: 12.5pt; font-weight: 600; }
  /* the hospital number keeps Latin digits — it is an identifier, not body
     text — so it is isolated from the surrounding RTL run */
  .tag .id .mrn { direction: ltr; unicode-bidi: isolate; }
  .tag .bio {
    direction: ltr; display: flex; justify-content: center; gap: 7mm;
    font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11pt; font-weight: 700;
    margin-top: 1.4mm; padding-top: 1.4mm; border-top: 0.3mm solid #000;
  }
  .tag .bio .k { font-weight: 400; }

  /* ── the blank template ──────────────────────────────────────────
     Same sheet, nothing filled in: rules to write the identity on, a
     hand-written date and cycle day, and a full page of order rules. */
  .tag .fill { flex: 1; border-bottom: 0.3mm solid #000; height: 1.15em; }
  .tag .fill.sm { display: inline-block; width: 16mm; height: 0.95em;
                  vertical-align: -0.15em; }
  .tag.blank .id { padding: 0 2mm; }
  .tag.blank .id > div { display: flex; align-items: flex-end; gap: 2.5mm;
                         margin-bottom: 1.8mm; direction: ltr; }
  .tag.blank .lb { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 8.5pt;
                   font-weight: 600; color: #444; letter-spacing: .5px;
                   white-space: nowrap; padding-bottom: 0.4mm; }

  .demarcation { border-top: 0.76mm solid #000; margin-top: 1.5mm; }

  /* ── date and day of cycle, BELOW the thick line ── */
  .dayline {
    direction: ltr; display: grid; grid-template-columns: 1fr auto 1fr;
    align-items: baseline; font-family: 'Segoe UI', Tahoma, sans-serif;
    padding: 1.6mm 0 1.2mm;
  }
  /* Arabic-Indic digits are bidi "AN" and would flip a d/m/y date to y/m/d;
     override so it always reads in the order it was written */
  .dayline .date { text-align: left; font-size: 11pt; font-weight: 600;
                   direction: ltr; unicode-bidi: bidi-override; }
  .dayline .day  { text-align: center; font-size: 12.5pt; font-weight: 700; letter-spacing: .3px; }
  /* only filled in when a patient's orders needed more than one page */
  .dayline .pg   { text-align: right; font-size: 10.5pt; font-weight: 700; }

  /* ── orders ──────────────────────────────────────────────────────
     14pt to match the chemotherapy sheets, and no rule under a line that
     already carries text — the rules are there to write ON, so only the
     empty ones keep them. --fs lets the whole block shrink to fit a page. */
  .orders { direction: rtl; flex: 1; min-height: 0; overflow: hidden;
            font-size: var(--fs, 14pt); line-height: 1.55; }
  /* The row height is in em so it SHRINKS WITH THE TYPE. It used to be a
     flat 8mm, which capped the sheet at 27 rows however small the font got
     — and the overflow was then clipped away silently. 1.62em is the same
     8mm at the 14pt default. */
  .orders .line {
    min-height: 1.62em; padding: 0.6mm 2mm; display: grid;
    grid-template-columns: 13mm 1fr auto; align-items: center;
  }
  /* an English aside, flush left, for what the Arabic line cannot carry */
  .orders .line .note {
    direction: ltr; unicode-bidi: isolate; text-align: left;
    /* capped and wrapping: an over-long note used to squeeze the Arabic
       order into four wrapped lines to keep itself on one */
    max-width: 44mm; white-space: normal; line-height: 1.2;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: calc(var(--fs, 14pt) * 0.66); font-weight: 700;
    padding-right: 4mm;
  }
  .orders .line.wrap .txt { white-space: normal; line-height: 1.3; }
  /* antibiotic course day, first thing on the line at the far right */
  .orders .line .dmark {
    direction: ltr; unicode-bidi: isolate; text-align: right; padding-left: 3mm;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: calc(var(--fs, 14pt) * 0.78); font-weight: 700; white-space: nowrap;
  }
  .orders .line .txt { white-space: normal; }
  /* Every order sits ON a rule, written or not — that is what the ward's
     own paper does, and the pharmacist ticks against it. Only the group
     headings are free of one. */
  .orders .line { border-bottom: 0.3mm solid #555; }
  .orders .line.cat { border-bottom: 0; }
  .orders .line.blank { color: transparent; }
  /* The nutrition rules. The same rule as any order carries, but they are
     the section itself rather than padding, so they are not blank rules
     and the fitter never takes them away. */
  .orders .line.write .txt { min-height: 1em; }
  /* a hand-filled blank: room to write, with a rule to write on */
  .wblank { display: inline-block; border-bottom: 0.25mm dotted #7a8691;
            margin: 0 0.6mm; vertical-align: baseline; height: 1em; }
  /* group heading — bold, flush right, a little air above it */
  .orders .line.cat .txt { font-weight: 700; text-decoration: underline; }
  .orders .line.cat { margin-top: 1.8mm; }
  .orders .line.cat:first-child { margin-top: 0; }

  .foot {
    direction: rtl; display: flex; justify-content: space-around;
    font-size: 9.5pt; padding-top: 6mm; color: #000;
  }
  .foot .sig { border-top: 0.3mm solid #000; padding-top: 1mm; min-width: 55mm; text-align: center; }
  `;
}

/**
 * Build the printable HTML for one or more patients.
 * @param {Array} sheets  [{patient, lines:[string], date:'YYYY-MM-DD'}]
 * @param {Object} opts   {logos:{nci,qa}, font, minLines, blank}
 *   blank — the same sheet with nothing filled in: rules to write the
 *   identity, date and cycle day on, and a full page of order rules. Used
 *   for the pad of forms the ward keeps for writing by hand.
 */
function blankSheetHtml(opts) {
  return buildSheetsHtml(
    [{ patient: { name: '', mrn: '', diagnosis: '', age: '', weight: null, height: null },
      lines: [], date: '' }],
    Object.assign({}, opts, { blank: true })
  );
}

function buildSheetsHtml(sheets, opts) {
  /* Deliberately more blank writing rules than will fit: the fit script
     hides the ones that overflow, so the page always ends full instead of
     trailing off into a white band above the signatures. */
  // inlineFit:false leaves the fit to the caller — the app's own preview
  // frame, where the Content Security Policy refuses inline scripts
  const o = Object.assign({ logos: {}, font: '', minLines: 30, blank: false }, opts || {});
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  /* An unfilled dose slot is written as a run of spaces, and HTML collapses
     those to one — so "زيلوريك ‹8 spaces› ق / ٨ س" printed with nowhere to
     write the dose. Each run becomes a fixed-width rule sized from the run.

     EIGHT spaces, not two. `orderLine` writes an unfilled `{n}` slot as
     exactly eight spaces, so eight is what a real blank looks like. The
     drug templates use TWO and THREE spaces as plain typographic spacing
     — "مجم/ ٢٤‹2›س‹3›وريد", "بي كوم‹2›أ/ أسبوع" — and at a threshold of two
     every one of those printed a dotted rule in the middle of a sentence
     where nothing is meant to be written. That is the "dots in spaces that
     do not exist" Dr Boulos reported, on the daily sheet this time, with a
     picture of the regular-medications block: a rule before every "بالفم"
     and every "وريد". (20 September 2026 — the same fix chemo.js took.) */
  /* arabicBody first: every order line on this sheet reads in Arabic-Indic
     digits whatever the doctor typed, while an English note or heading is
     left alone. See arabicBody(). */
  const BLANK_RUN = 8;
  const escB = (s) => esc(arabicBody(s)).replace(/ {2,}/g, (run, at) =>
    ((at <= 3 || run.length < BLANK_RUN) ? run : `<span class="wblank" style="width:${
      Math.min(26, Math.max(8, run.length * 1.2)).toFixed(1)}mm"></span>`));

  const pages = sheets
    .map(({ patient, lines, date, nutrition }, sheetIndex) => {
      const b = bsa(patient.weight, patient.height);
      // a line is either a plain string or {text, day}
      const written = lines
        .map((l) => (typeof l === 'string' ? { text: l } : l))
        .filter((l) => l && ((l.text && l.text.trim()) || l.write));
      const blanks = Math.max(0, o.minLines - written.length);
      const lineHtml = (l) =>
        l.heading
          ? `<div class="line cat"><span class="dmark"></span>` +
            `<span class="txt">${escB(l.text)}</span></div>`
          : l.write
            /* a rule to write on that the fitter may not take away — see
               nutritionLines(). No text, so nothing collapses it. */
            ? '<div class="line write"><span class="dmark"></span><span class="txt"></span></div>'
            : `<div class="line${l.wrap ? ' wrap' : ''}"><span class="dmark">${l.day ? 'D' + l.day : ''}</span>` +
              `<span class="txt">${escB(l.text)}</span>` +
              (l.note ? `<span class="note">${esc(l.note)}</span>` : '') + '</div>';
      const orderHtml =
        written.map(lineHtml).join('') +
        /* Dr Boulos, 14 October 2026: "Put the توصيات التغذية headline just
           after the last drug. Not at the bottom two lines." It used to sit
           under the blank writing rules, at the very foot of the page; on a
           short round that put it an inch below the last order with nothing
           between. It now follows the last drug directly, and the empty
           rules the sheet is padded out with come after it. */
        nutritionLines(nutrition).map(lineHtml).join('') +
        Array.from({ length: blanks },
          () => '<div class="line blank"><span class="dmark"></span><span class="txt">.</span></div>'
        ).join('');

      /* data-pt ties a continuation page back to the page it spilled from,
         so the two can be numbered "Page 1 of 2" together */
      return `
  <div class="sheet" data-pt="${sheetIndex}">
    <div class="lh">
      <div class="side qa">
        ${o.logos.qa ? `<img src="${o.logos.qa}" alt="">` : ''}
      </div>

      <div class="hdr">
        <div class="tag${o.blank ? ' blank' : ''}">
          <div class="id">
            <div class="nm">${o.blank ? '<b class="lb">Name</b><i class="fill"></i>' : esc(patient.name)}</div>
            <div class="mrn">${o.blank ? '<b class="lb">MRN</b><i class="fill"></i>' : esc(patient.mrn)}</div>
            ${o.blank ? '<div class="dx"><b class="lb">Diagnosis</b><i class="fill"></i></div>'
    : (patient.diagnosis ? `<div class="dx">${esc(patient.diagnosis)}</div>` : '')}
          </div>
          <div class="bio">
            <span><span class="k">Wt</span> ${o.blank ? '<i class="fill sm"></i>' : esc(patient.weight ? patient.weight + ' kg' : '—')}</span>
            <span><span class="k">Ht</span> ${o.blank ? '<i class="fill sm"></i>' : esc(patient.height ? patient.height + ' cm' : '—')}</span>
            <span><span class="k">BSA</span> ${o.blank ? '<i class="fill sm"></i>'
    : (b ? b.toFixed(2) + (bsaCapped(patient.weight, patient.height) ? ' max' : '') : '—')}</span>
            <span><span class="k">Age</span> ${o.blank ? '<i class="fill sm"></i>'
    : esc(ageText(patient, o.date) || patient.age || '—')}</span>
            <span><span class="k">Sex</span> ${o.blank ? '<i class="fill sm"></i>' : esc(sexText(patient) || '—')}</span>
          </div>
        </div>
      </div>

      <div class="side nci">
        ${o.logos.nci ? `<img src="${o.logos.nci}" alt="">` : ''}
        <div class="dept">قسم أورام الأطفال<br>و أمراض الدم السرطانية</div>
      </div>
    </div>

    <div class="demarcation"></div>
    <div class="dayline">
      <span class="date">${o.blank ? '___ / ___ / ______' : esc(formatDMY(date))}</span>
      <span class="day">${o.blank ? 'Day ____________________'
    : esc(dayLabel(patient, date))}</span>
      <span class="pg"></span>
    </div>

    <div class="orders">${orderHtml}</div>

    <div class="foot">
      <div class="sig">توقيع الطبيب</div>
      <div class="sig">توقيع الصيدلي</div>
    </div>
  </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>NCI Orders</title>
<style>${sheetCss(o.font)}</style>
</head><body>${pages}${o.inlineFit === false ? '' : SHEET_FIT}</body></html>`;
}

const Sheet = {
  toArabicNumerals, arabicBody, computeDose, perKgFor,
  TABLET_WATER_ML, fmtTabs, tabletPlan, tabletRefusal,
  PAGE_W_MM, PAGE_H_MM, PAGE_H_PX, fmtDose, round1, bsa, bsaRaw, bsaCapped, BSA_MAX,
  orderLine, doseBase, forAge,
  dayLabel, daysBetween, buildSheetsHtml, fitSheetPages, antibioticDay, anchorDateForDay, formatDMY,
  ageParts, ageMonths, ageText, sexText,
  sheetCss, DRUG_GROUPS, DRUG_GROUP_AR, DRUG_CLASSES, DRUG_CLASS_EN, adultSpecFlat,
  manualInfusion, manualInfusionLine, manualInfusionSpec, MANUAL_SYRINGE_ML,
  NUTRITION_AR, NUTRITION_RULES, nutritionLines,
  DILUENTS, FLUID_TYPES, infusionPlan, infusionLine, fluidPlan, fluidLine,
  maintenanceMlPerHour, maintenanceShare, fluidShare, INSENSIBLE_ML_M2,
  DEHYDRATION_STEPS, infusionDose,
  fmtCalc, fmtVol, round3, SYRINGE_24, syringe24Choice, infusionSpec, blankSheetHtml,
  adjustableSpec, everyHours,
  hoistDoseMark, DOSE_UNIT_EN,
  adultPlan, adultAdvice, adultCeiling, adultMakeUp, adultRateOptions, adultUnits, adultSpec,
  ADULT_SYRINGE_ML, ADULT_RATES, ADULT_RANGE_UNIT, ADULT_RANGE_TIME
};
if (typeof window !== 'undefined') window.Sheet = Sheet;
if (typeof module !== 'undefined') module.exports = Sheet;
