'use strict';
/* ══════════════════════════════════════════════════════════════════
 * NUTRITION ORDERS
 *
 * Dr Boulos, 6 November 2026: "add a nutrition module to the homepage with
 * ability to write nutrition instructions for today or tomorrow, and the
 * instructions should be added to the doctor orders below توصيات التغذية
 * … orders should be in arabic, nutritionists define quantities in ml, show
 * them nutritional facts about chosen ingredients."
 *
 * THE MENU is the ward's own (Nutrition.pdf, the same day) and nothing
 * else: the oral supplements with their serving (scoops), the volume that
 * serving is made up to, and its kcal and protein; the IV products by name
 * and pack. A fact the menu does not give is not invented here — an IV
 * product shows its pack only, and a ready-to-drink oral product (no
 * dilution on the menu) shows its facts per pack, not per ml.
 *
 * A QUANTITY IS IN ml. For a powder the scoops are worked out from the
 * menu's own ratio, to the nearest half scoop (Pediasure: 5 scoops in
 * 200 ml, so 100 ml is 2.5 scoops and 150 ml, 3.75, is written 4).
 *
 * WHAT PRINTS: one Arabic line per product, then the free instructions, on
 * the daily order sheet directly under «توصيات التغذية» for that date —
 * Sheet.nutritionLines() — with a rule left to write on after them.
 *
 * Kept on the child as p.nutrition = { 'YYYY-MM-DD': { items, notes, at } },
 * so it travels with the child's record (and the ward's cloud copy); days
 * more than two weeks old are let go when a day is saved.
 *
 * Wrapped in an IIFE: the renderer's scripts share one global scope.
 * ══════════════════════════════════════════════════════════════════ */
(function () {

const txt = (v) => (v == null ? '' : String(v)).trim();
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };

/* ── the menu, as Nutrition.pdf gives it ───────────────────────────
 * scoops: the serving; ml: what that serving is made up to ("Dilution");
 * kcal, protein (g): per serving. null where the menu has a dash. */
const ORAL = [
  { key: 'pediasure', name: 'Pediasure', age: '1–10 y', scoops: 5, ml: 200, kcal: 225, protein: 6.7 },
  { key: 'gf', name: 'G.F', age: '1–12 y', scoops: 2, ml: 100, kcal: 118, protein: 6.2 },
  { key: 'ensure', name: 'Ensure', age: '>10 y', scoops: 6, ml: 230, kcal: 230, protein: 8.5 },
  { key: 'bioganers', name: 'Bioganers', age: '>3 y', scoops: 2, ml: 100, kcal: 120, protein: 7 },
  { key: 'blendra', name: 'Blendra', age: '>3 y', scoops: 6, ml: 160, kcal: 225, protein: 8.4 },
  { key: 'forticare', name: 'Forticare', age: '>3 y', scoops: null, ml: null, kcal: 203, protein: 11 },
  { key: 'fortisip', name: 'Fortisip', age: '>3 y', scoops: null, ml: null, kcal: 203, protein: 11 },
  { key: 'supportan', name: 'Supportan', age: '>3 y', scoops: null, ml: null, kcal: 300, protein: 20 },
  { key: 'ferrusbin', name: 'Ferrusbin', age: '>3 y', scoops: null, ml: null, kcal: 400, protein: 20 },
  { key: 'neomune', name: 'Neomune', age: '>3 y', scoops: 7, ml: 250, kcal: 254, protein: 15.6 },
  { key: 'aminoliban-oral', name: 'Aminoliban', age: '>3 y', scoops: 5, ml: 200, kcal: 210, protein: 13.5 },
  { key: 'peptamen-jr', name: 'Peptamin Jr.', age: '1–10 y', scoops: 7, ml: 210, kcal: 250, protein: 7 },
  { key: 'peptamen-ace', name: 'Peptamine ACE', age: '10–13 y', scoops: 6, ml: 210, kcal: 242, protein: 9 },
  { key: 'peptamen', name: 'Peptamine', age: '>13 y', scoops: 6, ml: 210, kcal: 250, protein: 10 },
  { key: 'ferrusbin-pd', name: 'Ferrusbin pd.', age: '>1 y', scoops: 2, ml: 100, kcal: 54, protein: 13.2 },
].map((o) => Object.assign({ route: 'oral' }, o));

/* the IV products: the name and the pack, all the menu says */
const IV = [
  ['amiparine-250', 'Amiparine', 250], ['aminoven-100', 'Aminoven', 100], ['aminoven-500', 'Aminoven', 500],
  ['kedmin-250', 'Kedmin', 250], ['aminoliban-500', 'Aminoliban', 500], ['pediment-250', 'Pediment', 250],
  ['vitalipid-10', 'Vitalipid', 10], ['addavin-10', 'Addavin', 10], ['soluvet-10', 'Soluvet', 10],
  ['dipeptivan-100', 'Dipeptivan', 100], ['glycophos-20', 'Glycophos', 20],
].map(([key, name, pack]) => ({ key, name, pack, route: 'iv' }))
  .concat([
    { key: 'smofkabiven-800', name: 'Smof kabiven 800 kcal', bagKcal: 800, route: 'iv' },
    { key: 'smofkabiven-1300', name: 'Smof kabiven 1300 kcal', bagKcal: 1300, route: 'iv' },
  ]);

/* 7 November 2026: "nutrition names in doctor orders should be in arabic".
   The sheet prints each product by its Arabic name; the window shows both.
   Spelled as the brands are said on the ward — correct any here. */
const AR = {
  pediasure: 'بدياشور', gf: 'جي إف', ensure: 'إنشور', bioganers: 'بيوجينرز', blendra: 'بلندرا',
  forticare: 'فورتيكير', fortisip: 'فورتيسيب', supportan: 'سبورتان', ferrusbin: 'فيروسبين',
  neomune: 'نيوميون', 'aminoliban-oral': 'أمينوليبان', 'peptamen-jr': 'ببتامين جونيور',
  'peptamen-ace': 'ببتامين إيس', peptamen: 'ببتامين', 'ferrusbin-pd': 'فيروسبين بي دي',
  'amiparine-250': 'أميبارين', 'aminoven-100': 'أمينوفين', 'aminoven-500': 'أمينوفين',
  'kedmin-250': 'كيدمين', 'aminoliban-500': 'أمينوليبان', 'pediment-250': 'بيديمنت',
  'vitalipid-10': 'فيتاليبيد', 'addavin-10': 'أدافين', 'soluvet-10': 'سولوفيت',
  'dipeptivan-100': 'ديببتيفان', 'glycophos-20': 'جليكوفوس',
  'smofkabiven-800': 'سموف كابيفين ٨٠٠ سعر', 'smofkabiven-1300': 'سموف كابيفين ١٣٠٠ سعر',
};
ORAL.concat(IV).forEach((m) => { m.ar = AR[m.key] || m.name; });

const MENU = ORAL.concat(IV);

/* ── FOR THIS CHILD'S AGE ─────────────────────────────────────────────
 * 7 November 2026: "only display products age-appropriate in nutrition drop
 * down menu". The menu's own ages: "1–10 y" is from the first birthday to
 * the end of the tenth year, ">3 y" from the third birthday on, ">10 y"
 * from the tenth. A product with no age (the IV ones) suits every child; a
 * child whose age is not on the record is offered everything. */
function ageRange(age) {
  const a = txt(age).replace(/\s+/g, '');
  let m = /^(\d+)[–-](\d+)y$/.exec(a);
  if (m) return { from: +m[1] * 12, to: (+m[2] + 1) * 12 - 1 };
  m = /^>(\d+)y$/.exec(a);
  if (m) return { from: +m[1] * 12, to: Infinity };
  return null;
}
function suitsAge(m, months) {
  const r = ageRange(m && m.age);
  if (!r || months == null || !Number.isFinite(months)) return true;
  return months >= r.from && months <= r.to;
}
const byKey = (k) => MENU.find((m) => m.key === k) || null;

/* the instructions written most, offered as one click each */
const PRESETS = [
  'غذاء عادي حسب التحمل',
  'غذاء لين',
  'سوائل صافية فقط',
  'غذاء مطهو جيدا (لمرضى نقص المناعة)',
  'صائم من منتصف الليل',
  'تشجيع الطفل على الأكل والشرب',
];

const round = (n, d) => { const f = Math.pow(10, d || 0); return Math.round(n * f) / f; };
/* 7 November 2026: "only use whole numbers in scoops of powder" — the
   nearest whole scoop, never fewer than one */
const wholeScoops = (n) => Math.max(1, Math.round(n));

function timesAr(n) {
  if (n === 1) return 'مرة واحدة يوميا';
  if (n === 2) return 'مرتين يوميا';
  return `${n} مرات يوميا`;
}

/* «مكيال واحد», «مكيالين», «٣ مكاييل»; a half scoop keeps the singular */
function scoopsAr(n) {
  /* 7 November 2026: "1 مكيال او 2 مكيال" — the number, then مكيال, always */
  return `${n} مكيال`;
}

/* ── the facts of one entry ─────────────────────────────────────────
 * { dose: {kcal, protein, scoops}, day: {kcal, protein}, perPack, note }
 * dose/day only where the menu gives what they are worked from. */
function facts(e) {
  const m = byKey(e && e.key);
  if (!m) return null;
  const ml = num(e.ml);
  const times = m.route === 'iv' ? 1 : Math.max(1, Math.round(num(e.times) || 1));
  if (m.route === 'oral' && m.ml) {
    if (!(ml > 0)) return { note: `${m.scoops} scoops in ${m.ml} ml = ${m.kcal} kcal · ${m.protein} g protein` };
    const f = ml / m.ml;
    const dose = { kcal: round(m.kcal * f), protein: round(m.protein * f, 1), scoops: wholeScoops(m.scoops * f) };
    return { dose, day: { kcal: round(m.kcal * f * times), protein: round(m.protein * f * times, 1) },
      note: `${m.kcal} kcal · ${m.protein} g protein per ${m.scoops} scoops in ${m.ml} ml (${round(m.kcal / m.ml, 2)} kcal/ml)` };
  }
  if (m.route === 'oral') {
    return { perPack: true, note: `${m.kcal} kcal · ${m.protein} g protein per pack — the menu gives no volume, so not per ml` };
  }
  if (m.bagKcal) return { perPack: true, note: `${m.bagKcal} kcal per bag` };
  return { note: `${m.pack} ml pack — the menu lists no nutritional facts for it` };
}

/* ── the Arabic line that prints ───────────────────────────────── */
function lineOf(e) {
  const m = byKey(e && e.key);
  const ml = num(e && e.ml);
  if (!m || !(ml > 0)) return '';
  if (m.route === 'iv') {
    const h = num(e.hours);
    return `${m.ar} ${round(ml, 1)} مل وريد${h > 0 ? ` على ${round(h, 1)} ساعة` : ''}`;
  }
  const times = Math.max(1, Math.round(num(e.times) || 1));
  const how = e.via === 'ngt' ? 'بالأنبوب الأنفي المعدي' : 'بالفم';
  const f = facts(e);
  const prep = f && f.dose && f.dose.scoops ? ` (تذاب ${scoopsAr(f.dose.scoops)} فى ${round(ml, 1)} مل ماء)` : '';
  return `${m.ar} ${round(ml, 1)} مل ${how} ${timesAr(times)}${prep}`;
}

/* the day's totals, from the entries whose facts are known */
function totals(day, weight) {
  let kcal = 0; let protein = 0; let known = 0; let unknown = 0;
  ((day && day.items) || []).forEach((e) => {
    if (!byKey(e.key) || !(num(e.ml) > 0)) return;
    const f = facts(e);
    if (f && f.day) { kcal += f.day.kcal; protein += f.day.protein; known++; } else unknown++;
  });
  const w = num(weight);
  return { kcal: round(kcal), protein: round(protein, 1), known, unknown,
    kcalPerKg: w > 0 && known ? round(kcal / w, 1) : null,
    proteinPerKg: w > 0 && known ? round(protein / w, 2) : null };
}

/* ── THE NUTRITION STANDS UNTIL IT IS CHANGED ─────────────────────
 * 16 November 2026, Dr Boulos: "nutrition data should stay the same unless
 * changed, if a nutritive is written today, it should automatically be
 * written tomorrow, including free text". A day with nothing of its own
 * takes the last day written before it in this admission — the feeds and
 * the free text — and prints it; opening it shows that same order to edit.
 * A day cleared on purpose is kept as cleared (`stopped`), so stopping the
 * nutrition stops it for the days after too. */
function dayFor(p, iso) {
  const all = (p && p.nutrition) || {};
  if (all[iso]) return all[iso];
  const from = txt(p && p.admissionDate);
  const d = Object.keys(all).filter((k) => k < iso && (!from || k >= from)).sort().pop();
  return d ? all[d] : null;
}
/* what prints under «توصيات التغذية» on this child's sheet for this date */
function linesFor(p, iso) {
  const day = dayFor(p, iso);
  if (!day) return [];
  return ((day.items || []).map(lineOf))
    .concat(txt(day.notes).split('\n').map(txt))
    .filter(Boolean);
}

/* save one day, and let go of days more than two weeks before it */
function setDay(p, iso, day) {
  const all = Object.assign({}, p.nutrition || {});
  const items = ((day && day.items) || []).filter((e) => byKey(e.key) && num(e.ml) > 0)
    .map((e) => ({ key: e.key, ml: num(e.ml), times: num(e.times) || null, hours: num(e.hours) || null, via: e.via || '' }));
  const notes = txt(day && day.notes);
  if (items.length || notes) all[iso] = { items, notes, at: Date.now() };
  /* emptied: kept as stopped while an earlier day would otherwise stand in for it */
  else { delete all[iso]; if (dayFor(Object.assign({}, p, { nutrition: all }), iso)) all[iso] = { items: [], notes: '', stopped: true, at: Date.now() }; }
  const cut = new Date(Date.parse(`${iso}T00:00:00Z`) - 14 * 86400000).toISOString().slice(0, 10);
  /* the days of long ago are let go — but never the last one written, which still stands */
  const newestOld = Object.keys(all).filter((d) => d < cut).sort().pop();
  Object.keys(all).forEach((d) => { if (d < cut && d !== newestOld) delete all[d]; });
  p.nutrition = all;
  return p;
}

const Nutrition = { ageRange, suitsAge, ORAL, IV, MENU, PRESETS, byKey, facts, lineOf, totals, linesFor, dayFor, setDay, timesAr, scoopsAr };
if (typeof window !== 'undefined') window.Nutrition = Nutrition;
if (typeof module !== 'undefined') module.exports = Nutrition;

})();
