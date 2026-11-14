'use strict';
/* ══════════════════════════════════════════════════════════════════
 * ONE WARD'S DATA, KEPT ON NCI'S GOOGLE DRIVE
 *
 * Dr Boulos, 6 November 2026: "can we make all app data cloud based? …
 * a first screen, user and password, where if they match a previously
 * backed up data, it restores them." Then: "dont sync chemo / per ward
 * backup / no need for encryption at all, the hospital approved it, and
 * the google drive we will store on is purely NCI's / passwords are only a
 * mean of verification / users create not me / the app backs up every hour
 * and when opened and when closed, and overwrites local stored data, if
 * internet is inaccessible, it uses local stored data / we'll use the same
 * service account with the same key."
 *
 * ONE WARD, SEVERAL COMPUTERS. A ward's file is written by every computer
 * signed in to that ward, so "the newest file wins" would let a computer
 * that had been idle for an hour wipe out an hour of another's work. So
 * the data is kept as PIECES — each patient, each patient's order, each
 * patient's ward handover, each ICU sheet, each drug, and each of the
 * other top-level settings — and every piece carries the time it was last
 * changed on any computer. Two copies are combined piece by piece, the
 * later change winning; a piece deleted carries the time it was deleted,
 * so a deletion travels like any other change.
 *
 * Nothing about chemotherapy protocols is in here: they stay on each
 * computer ("dont sync chemo").
 * ══════════════════════════════════════════════════════════════════ */
/* 7 November 2026: the phone app loads this same file in its web view,
   where there is no Node `crypto`: random tokens come from the browser's,
   and the password check is the phone's own (scrypt in JavaScript). */
const crypto = (typeof require === 'function') ? require('crypto') : globalThis.crypto;
/* in the web view `crypto` IS the browser's (a top-level `const crypto =
   null` here would hide it from every other script on the page) */
const randomHex = (n) => (crypto && crypto.randomBytes ? crypto.randomBytes(n).toString('hex')
  : Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join(''));

const ARRAYS = ['patients', 'drugs'];          // arrays of { id, … }
const MAPS = ['orders', 'ward', 'icu'];         // objects keyed by patient / sheet
const META = '_sync';
const SEP = '\u001f';

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* every piece of the data, by its path */
/* 12 November 2026, Dr Boulos: "data keeps getting lost, i am sure i typed
   these fields before". A child's handover was ONE piece: a computer whose
   copy was an hour old filling the Lab box in its 30-minute round stamped
   the whole handover as new, and it went over the Clinically and To do
   typed on another computer. The handovers, the ICU sheets and the orders
   are now pieces field by field — a handover's summary, its echo's date,
   each day's Clinically, Lab, To do … each on its own (DEEP, three levels
   below the child). A stamp kept from before (the whole handover) still
   speaks for every field under it until a field gets its own. */
const DEEP = ['ward', 'icu', 'orders'];
const DEPTH = 3;
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function walk(out, path, v, depth) {
  if (isPlain(v) && depth < DEPTH && Object.keys(v).length) {
    Object.keys(v).forEach((k) => walk(out, `${path}${SEP}${k}`, v[k], depth + 1));
  } else out.set(path, v);
}
function pieces(db) {
  const out = new Map();
  const d = db || {};
  Object.keys(d).forEach((k) => {
    if (k === META) return;
    if (ARRAYS.indexOf(k) >= 0 && Array.isArray(d[k])) {
      d[k].forEach((x) => { if (x && x.id != null) out.set(`${k}${SEP}${x.id}`, x); });
    } else if (MAPS.indexOf(k) >= 0 && d[k] && typeof d[k] === 'object') {
      Object.keys(d[k]).forEach((id) => {
        if (DEEP.indexOf(k) >= 0 && isPlain(d[k][id]) && Object.keys(d[k][id]).length) {
          Object.keys(d[k][id]).forEach((f) => walk(out, `${k}${SEP}${id}${SEP}${f}`, d[k][id][f], 1));
        } else out.set(`${k}${SEP}${id}`, d[k][id]);
      });
    } else {
      out.set(`top${SEP}${k}`, d[k]);
    }
  });
  return out;
}

/* put one piece in (value) or take it out (undefined) */
function setPiece(db, path, value) {
  const parts = path.split(SEP);
  const [kind, id] = parts;
  if (kind === 'top') {
    if (value === undefined) delete db[id]; else db[id] = value;
    return;
  }
  if (ARRAYS.indexOf(kind) >= 0) {
    if (!Array.isArray(db[kind])) db[kind] = [];
    const i = db[kind].findIndex((x) => x && String(x.id) === id);
    if (value === undefined) { if (i >= 0) db[kind].splice(i, 1); }
    else if (i >= 0) db[kind][i] = value;
    else db[kind].push(value);
    return;
  }
  if (!db[kind] || typeof db[kind] !== 'object') db[kind] = {};
  if (parts.length === 2) {
    if (value === undefined) delete db[kind][id]; else db[kind][id] = value;
    return;
  }
  /* a field inside a child's handover / ICU sheet / order */
  let o = db[kind];
  for (let i = 1; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!isPlain(o[k])) {
      if (value === undefined) return;
      o[k] = {};
    }
    o = o[k];
  }
  const last = parts[parts.length - 1];
  if (value !== undefined) { o[last] = value; return; }
  delete o[last];
  /* a field taken out leaves no empty shell behind it (a drug removed
     from the order is gone, not an empty {}) */
  for (let n = parts.length - 1; n >= 3; n--) {
    let q = db[kind];
    for (let i = 1; i < n - 1; i++) q = q && q[parts[i]];
    const k = parts[n - 1];
    if (q && isPlain(q[k]) && !Object.keys(q[k]).length) delete q[k]; else break;
  }
}

/* a piece's stamp: its own, or the nearest one above it (from before the
   pieces were fields) */
function stampAt(stamps, path) {
  if (stamps[path]) return stamps[path];
  const parts = path.split(SEP);
  for (let n = parts.length - 1; n >= 2; n--) {
    const up = parts.slice(0, n).join(SEP);
    if (stamps[up]) return stamps[up];
  }
  return null;
}
const under = (map, path) => { const pre = `${path}${SEP}`; for (const k of map.keys()) if (k.indexOf(pre) === 0) return true; return false; };

const stampsOf = (db) => ((db && db[META] && db[META].stamps) || {});

/* the pieces that differ between two versions of the data */
function changed(before, after) {
  const a = pieces(before);
  const b = pieces(after);
  const out = [];
  new Set([...a.keys(), ...b.keys()]).forEach((p) => { if (!same(a.get(p), b.get(p))) out.push(p); });
  return out;
}

/* A SAVE FROM THE SCREEN. The screen sends its whole copy of the data; only
   what it changed since it was last given the data (`base`) is applied to
   what is on disk now (`current`), stamped `now`. What the cloud brought in
   meanwhile, and the screen has not seen yet, is left as it is. */
/* 12 November 2026, Dr Boulos: "I typed data from my PC, exited clicked
   backup, and then it restored the older, emptier fields from my phone".
   Two devices' clocks disagree (this ward's PC once ran minutes wrong): an
   edit is stamped later than every stamp its own copy has already seen, so
   a phone whose clock runs ahead can never make its older copy "newer"
   than typing done after it. */
function stampNow(cur, now) {
  let top = 0;
  const st = stampsOf(cur);
  Object.keys(st).forEach((k) => { if (st[k] && st[k].t > top) top = st[k].t; });
  return Math.max(now, top + 1);
}
function applySave(current, base, next, now0) {
  const cur = clone(current) || {};
  const now = stampNow(cur, now0);
  const nextP = pieces(next);
  const stamps = Object.assign({}, stampsOf(cur));
  changed(base || current, next).forEach((p) => {
    const v = nextP.get(p);
    setPiece(cur, p, clone(v));
    stamps[p] = { t: now, del: v === undefined };
  });
  cur[META] = Object.assign({}, cur[META], { stamps });
  return cur;
}

/* A SAVE FROM THE PHONE, ADDED IN — NEVER A WHOLE PIECE OVER ANOTHER.
   11 November 2026, Dr Boulos: "phone logs in, backs up data, the data on
   my phone is deficient, it replaces the data from my PC uploaded 30 mins
   earlier. Sync phone app on opening, and when prompted to upload a
   backup, upload additively, dont overwrite or delete items. this will
   require that the phone only writes over the "echo" part of the file, not
   en bloc, the patient can not be uploaded as one package."
   What the phone changed since it was given the data (`base`) is laid into
   what is on the Drive now (`current`), field by field, all the way down —
   a patient's handover is its summary, its echo's date, its echo's finding,
   each day's Clinically… each on its own:
     - a field only the phone changed takes the phone's value;
     - a field the Drive changed meanwhile keeps the Drive's — and when both
       are text and the phone's words are not already in it, the phone's
       words are added on a new line;
     - a list (the other scans, the other cultures, the temperatures) keeps
       every item the Drive has, takes the items the phone edited in their
       place, and adds the ones it added; nothing is taken out;
     - nothing the phone deleted is deleted, and nothing the Drive deleted
       comes back.
   Each piece it touched is stamped `now`, so a computer takes the result
   whole, and the result holds everything the computer had uploaded. */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function addList(base, cur, next) {
  const out = clone(cur) || [];
  const b = Array.isArray(base) ? base : [];
  (next || []).forEach((x, i) => {
    if (i < b.length && same(b[i], x)) return;                       /* the phone left it as it was */
    if (out.some((y) => same(y, x))) return;                          /* the Drive has it already */
    const j = i < b.length ? out.findIndex((y) => same(y, b[i])) : -1;
    if (j >= 0) out[j] = clone(x);                                    /* the phone edited it */
    else out.push(clone(x));                                          /* the phone added it */
  });
  return out;
}
function addInto(base, cur, next) {
  if (next === undefined) return clone(cur);                          /* never a deletion */
  if ((next === '' || next === null) && cur !== undefined && cur !== '' && cur !== null) return clone(cur);   /* nor an emptying */
  if (cur === undefined) return clone(next);                          /* new from the phone */
  if (same(next, base)) return clone(cur);                            /* not the phone's change */
  if (same(cur, base) && !(isObj(cur) && isObj(next)) && !(Array.isArray(cur) && Array.isArray(next))) return clone(next);
  if (isObj(cur) && isObj(next)) {
    const out = clone(cur);
    const b = isObj(base) ? base : {};
    Object.keys(next).forEach((k) => {
      const v = addInto(b[k], cur[k], next[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  if (Array.isArray(cur) && Array.isArray(next)) return addList(base, cur, next);
  if (same(cur, next)) return clone(cur);
  if (same(cur, base)) return clone(next);
  /* both changed it */
  if (typeof cur === 'string' && typeof next === 'string') {
    const c = cur.trim();
    const n = next.trim();
    if (!n || c.indexOf(n) >= 0) return cur;
    if (!c || n.indexOf(c) >= 0) return next;
    return `${cur}\n${next}`;
  }
  return clone(cur);
}
function applyAdditive(current, base, next, now0) {
  const cur = clone(current) || {};
  const now = stampNow(cur, now0);
  const curP = pieces(cur);
  const baseP = pieces(base || current);
  const nextP = pieces(next);
  const stamps = Object.assign({}, stampsOf(cur));
  changed(base || current, next).forEach((p) => {
    const v = nextP.get(p);
    if (v === undefined) return;                                      /* the phone never deletes */
    const was = curP.get(p);
    if (was === undefined && stamps[p] && stamps[p].del) return;      /* nor brings back what a computer deleted */
    const out = was === undefined ? clone(v) : addInto(baseP.get(p), was, v);
    if (same(out, was)) return;
    setPiece(cur, p, out);
    stamps[p] = { t: now, del: false };
  });
  cur[META] = Object.assign({}, cur[META], { stamps });
  return cur;
}

/* 12 November 2026, Dr Boulos: "dont replace any text without prompting,
   in both apps". The fields where merging `remote` into `local` would put
   different text over text `local` has — to ask about, one by one, before
   merge(local, remote, { keep }) is run with the answers. */
function textConflicts(local, remote) {
  const lp = pieces(local || {});
  const after = pieces(merge(local || {}, remote || {}));
  const out = [];
  lp.forEach((mine, p) => {
    if (blankV(mine) || !after.has(p)) return;
    const theirs = after.get(p);
    if (blankV(theirs) || same(theirs, mine)) return;
    out.push({ path: p, mine, theirs });
  });
  return out;
}

/* 12 November 2026, Dr Boulos: "make sure data is secure, and confirm the
   sync". After a backup or a restore, the copy read back is checked: every
   field `mine` has (not blank, and not one the user chose to keep apart) is
   in `theirs` with the same value. The fields that are not — none, when the
   sync is confirmed. */
function missingIn(mine, theirs, skip) {
  const mp = pieces(mine || {});
  const tp = pieces(theirs || {});
  const out = [];
  mp.forEach((v, p) => {
    if (blankV(v) || (skip && skip.has(p))) return;
    if (!tp.has(p) || !same(tp.get(p), v)) out.push(p);
  });
  return { checked: mp.size, missing: out };
}

/* 12 November 2026: the text an empty box went over, brought back. From an
   earlier copy (a backup on the PC, a day's copy on Drive), every field
   that is empty or missing now and has text there is filled in — for a
   child still in the data; nothing with text is ever changed. Returns
   { data, filled: [paths] }. */
function fillBlanks(current, older, now0) {
  const cur = clone(current) || {};
  const now = stampNow(cur, now0 || Date.now());
  const cp = pieces(cur);
  const op = pieces(older || {});
  const stamps = Object.assign({}, stampsOf(cur));
  const ids = new Set(((cur.patients) || []).map((x) => String(x && x.id)));
  const filled = [];
  op.forEach((v, p) => {
    const parts = p.split(SEP);
    if (DEEP.indexOf(parts[0]) < 0 || parts.length < 3) return;
    if (!ids.has(String(parts[1]))) return;
    if (blankV(v) || (isPlain(v) && !Object.keys(v).length)) return;
    const c = cp.get(p);
    if (cp.has(p) && !(blankV(c) || (isPlain(c) && !Object.keys(c).length))) return;
    setPiece(cur, p, clone(v));
    stamps[p] = { t: now, del: false };
    filled.push(p);
  });
  cur[META] = Object.assign({}, cur[META], { stamps });
  return { data: cur, filled };
}

/* ── THE PHONE ASKS ─────────────────────────────────────────────────
 * 12 November 2026, Dr Boulos: "phone: restore data from cloud on opening,
 * and upload data to cloud only after it's typed, if there's a discrepancy,
 * ask the user is it should be replaced". What the phone typed since it
 * was given the data (`base`) is compared with the cloud now (`current`),
 * field by field. A field the cloud has changed meanwhile to something
 * else is a discrepancy: phoneConflicts lists them, for the phone to ask;
 * applyPhone writes the phone's typing, and for each discrepancy the
 * phone's only when the user said replace (`replace`: the paths). */
const blankV = (v) => v === '' || v == null || (Array.isArray(v) && !v.length);
function phoneConflicts(current, base, next) {
  const curP = pieces(current || {});
  const baseP = pieces(base || current || {});
  const nextP = pieces(next || {});
  const out = [];
  changed(base || current, next).forEach((p) => {
    const mine = nextP.get(p);
    if (mine === undefined || blankV(mine)) return;          /* the phone deletes and empties nothing */
    const was = baseP.get(p);
    const now = curP.get(p);
    if (now === undefined || blankV(now) || same(now, was) || same(now, mine)) return;
    out.push({ path: p, cloud: now, phone: mine, was });
  });
  return out;
}
function applyPhone(current, base, next, now0, replace) {
  const cur = clone(current) || {};
  const now = stampNow(cur, now0);
  const curP = pieces(cur);
  const baseP = pieces(base || current || {});
  const nextP = pieces(next || {});
  const stamps = Object.assign({}, stampsOf(cur));
  const yes = new Set(replace || []);
  changed(base || current, next).forEach((p) => {
    const mine = nextP.get(p);
    if (mine === undefined || blankV(mine)) return;
    const was = baseP.get(p);
    const cloudNow = curP.get(p);
    const conflict = cloudNow !== undefined && !blankV(cloudNow) && !same(cloudNow, was) && !same(cloudNow, mine);
    if (conflict && !yes.has(p)) return;                      /* the cloud's stays, as answered */
    if (same(cloudNow, mine)) return;
    setPiece(cur, p, clone(mine));
    stamps[p] = { t: now, del: false };
  });
  cur[META] = Object.assign({}, cur[META], { stamps });
  return cur;
}
/* a field's path, in words: "Omar — Clinically 12/11" */
function pathLabel(path, data) {
  const parts = String(path).split(SEP);
  const pts = (data && data.patients) || [];
  const who = (id) => { const p = pts.find((x) => String(x.id) === String(id)); return p ? p.name : 'a child'; };
  const NAMES = { clinically: 'Clinically', labs: 'Lab', meds: 'Medications', todo: 'To do', summary: 'Case summary', supportive: 'Supportive',
    finding: 'finding', date: 'date', result: 'result', ct: 'Last CT chest', echo: 'Last echo', rectal: 'Rectal swab', blood: 'Blood culture',
    moreImaging: 'Other imaging', moreCultures: 'Other cultures', extra: 'Other orders' };
  const nm = (k) => NAMES[k] || k;
  if (parts[0] === 'ward' && parts[2] === 'days' && parts[3]) {
    const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(parts[3]);
    return `${who(parts[1])} — ${nm(parts[4] || '')} ${m ? `${+m[2]}/${+m[1]}` : parts[3]}`.trim();
  }
  if (parts[0] === 'ward') return `${who(parts[1])} — ${parts.slice(2).map(nm).join(' ')}`;
  if (parts[0] === 'orders') return `${who(parts[1])} — the orders`;
  if (parts[0] === 'icu') return `${who(parts[1])} — the ICU sheet`;
  if (parts[0] === 'patients') return `${who(parts[1])} — the patient's details`;
  return parts.slice(1).join(' ');
}

/* ══ ONE MAIN PC, AND NOTES FROM THE OTHERS ═══════════════════════════
 * 12 November 2026, Dr Boulos: "I want to make sure this mess never happens
 * again, and I want matters to be simpler" — one main PC; and "notes from
 * other devices should be added to the text in a line below, not
 * overwritten, the process should be additive".
 *
 * The main PC's copy is the ward's data; only the main PC writes it to the
 * cloud. Every other device (the phone, the other PCs) never writes the
 * data: each box typed there becomes a NOTE — the box, its new value, the
 * value it had when typed (was), which device, when — sent to the ward's
 * inbox. The main PC adds each note in (addValue):
 *   - text: into an empty box as it is; under text already there, ON A
 *     LINE BELOW — only what the other device added, when it added to the
 *     text it saw; never twice, never over anything;
 *   - lists (cultures, scans, labs asked for): the items added;
 *   - a date, a tick, a number: filled in when empty, or changed only if
 *     the main PC still has what the other device saw;
 *   - nothing is ever deleted from another device.
 * The other devices show the main PC's copy with the notes added the same
 * way (overlay), so what they typed never disappears from their screen. */
/* the same line with a slip put right — most of it unchanged from its start
   and its end — not other words in its place ("clear" → "bilateral
   infiltrates" is a different finding, and both are kept) */
function alike(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 4) return false;
  let p = 0;
  while (p < n && a[p] === b[p]) p++;
  let q = 0;
  while (q < n - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  return (p + q) / n >= 0.6;
}
const isDateText = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(v.trim());
function addValue(cur, was, val) {
  if (val === undefined) return cur;
  if (cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && !cur.length)) return clone(val);
  if (same(cur, val)) return cur;
  if (typeof cur === 'string' && typeof val === 'string') {
    if (isDateText(cur) || isDateText(val)) return same(cur, was) ? val : cur;
    const c = cur.trim();
    const v = val.trim();
    if (!v || c.indexOf(v) >= 0) return cur;
    if (v.indexOf(c) === 0) return val;                       /* the other device added to this very text */
    /* 14 November 2026, Dr Boulos (a phone's note, typed while it synced,
       came out as «i / n / k / g», one letter a line, under a second copy of
       the text): what the other device has is added a LINE at a time. A line
       the main PC already has is left; a line that continues one of the main
       PC's replaces it; any other line is added underneath. Never a part of
       a line, and nothing of the main PC's is removed. */
    const lines = cur.replace(/\s+$/, '').split('\n');
    const has = (t) => lines.some((l) => l.trim() === t);
    const vLines = val.split('\n');
    const wLines = typeof was === 'string' ? was.split('\n').map((l) => l.trim()) : [];
    let grew = false;
    vLines.forEach((raw, k) => {
      const t = raw.trim();
      if (!t || has(t) || lines.some((l) => l.trim().indexOf(t) === 0)) return;
      /* this line continues one of the main PC's */
      let i = lines.findIndex((l) => l.trim() && t.indexOf(l.trim()) === 0);
      /* or it is the device's own line put right (a typo): the line it saw
         in that place is gone from its text, and the main PC still has
         exactly that line */
      if (i < 0 && wLines[k] && wLines[k] !== t && !vLines.some((x) => x.trim() === wLines[k]) && alike(wLines[k], t)) i = lines.findIndex((l) => l.trim() === wLines[k]);
      if (i >= 0) lines[i] = raw.replace(/\s+$/, ''); else lines.push(raw.replace(/\s+$/, ''));
      grew = true;
    });
    return grew ? lines.join('\n') : cur;
  }
  if (Array.isArray(cur) && Array.isArray(val)) return addList(Array.isArray(was) ? was : [], cur, val);
  if (isPlain(cur) && isPlain(val)) {
    const out = clone(cur);
    Object.keys(val).forEach((k) => { out[k] = addValue(cur[k], isPlain(was) ? was[k] : undefined, val[k]); if (out[k] === undefined) delete out[k]; });
    return out;
  }
  return same(cur, was) ? clone(val) : cur;
}
/** the notes a device's typing makes: what changed from `base` to `next` */
function notesFrom(base, next, from, now) {
  const bp = pieces(base || {});
  const np = pieces(next || {});
  const t = now == null ? Date.now() : now;
  return changed(base || {}, next || {}).map((p, i) => {
    const v = np.get(p);
    if (v === undefined) return null;                         /* deletions stay on the device */
    if (blankV(v) || (isPlain(v) && !Object.keys(v).length)) return null;   /* an empty box adds nothing */
    return { id: `${t.toString(36)}${i.toString(36)}${randomHex(4)}`, from: String(from || ''), at: t, path: p, value: clone(v), was: clone(bp.get(p)) };
  }).filter(Boolean);
}
/** the notes added into `data`, oldest first: { data, applied: [ids] } */
function applyNotes(data, notes) {
  const out = clone(data) || {};
  const applied = [];
  (notes || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((n) => {
    if (!n || !n.path) return;
    const cur = pieces(out).get(n.path);
    const nv = addValue(cur, n.was, n.value);
    if (!same(nv, cur)) setPiece(out, n.path, clone(nv));
    applied.push(n.id);
  });
  return { data: out, applied };
}
/** what another device shows: the main PC's copy with the notes added */
function overlay(data, notes) { return applyNotes(data, notes).data; }

/* TWO COPIES, ONE RESULT: every piece from whichever copy changed it last.
   A piece neither copy ever stamped (data from before the cloud) is kept
   from the local copy, or taken from the cloud when only the cloud has it. */
function merge(local, remote, opts) {
  const keep = (opts && opts.keep) || null;
  const out = clone(local) || {};
  const lp = pieces(local);
  const rp = pieces(remote);
  const ls = stampsOf(local);
  const rs = stampsOf(remote);
  const stamps = Object.assign({}, ls);
  new Set([...lp.keys(), ...rp.keys(), ...Object.keys(ls), ...Object.keys(rs)]).forEach((p) => {
    /* a stamp from before the fields, on a whole handover that now has
       fields: it speaks for them (stampAt), not for itself — unless it is
       a deletion of the whole, newer than anything under it */
    if (!lp.has(p) && !rp.has(p) && (under(lp, p) || under(rp, p))) {
      const r0 = rs[p];
      const l0 = ls[p];
      if (r0 && r0.del && r0.t > ((l0 && l0.t) || 0)) {
        let newest = 0;
        [ls, rs].forEach((st) => Object.keys(st).forEach((k) => { if (k.indexOf(`${p}${SEP}`) === 0) newest = Math.max(newest, st[k].t || 0); }));
        if (r0.t > newest) { setPiece(out, p, undefined); stamps[p] = r0; }
      }
      return;
    }
    if (keep && keep.has(p)) return;                         /* asked: this side's text stays */
    const lst = stampAt(ls, p);
    const rst = stampAt(rs, p);
    const lt = (lst && lst.t) || 0;
    const rt = (rst && rst.t) || 0;
    /* an empty value whose stamp is only the whole handover's (a copy
       from before the fields, or from an app not yet updated) never goes
       over text */
    /* 12 November 2026: "Now the phone app does not retrieve any text.
       All the cultures and imaging are not mentioned on the phone." A PC
       opening a child it had no handover for filled the boxes in empty, and
       those empty boxes, stamped new, went over the cultures and scans typed
       elsewhere. An empty value never goes over text, whatever its stamp —
       only a deletion does; and text comes in over an empty value, so a
       device that still has it puts it back. */
    const blank = (v) => v === '' || v == null || (Array.isArray(v) && !v.length) || (isPlain(v) && !Object.keys(v).length);
    /* a day put back on purpose ("Earlier copies") is the exception: its
       empty boxes are meant (put) */
    if (rp.has(p) && blank(rp.get(p)) && lp.has(p) && !blank(lp.get(p)) && !(rs[p] && rs[p].put && rs[p].t > lt)) return;
    if ((!lp.has(p) || blank(lp.get(p))) && rp.has(p) && !blank(rp.get(p))
      && !(ls[p] && ls[p].del && ls[p].t >= rt) && !(ls[p] && ls[p].put && ls[p].t >= rt)) {
      setPiece(out, p, clone(rp.get(p)));
      stamps[p] = { t: Math.max(rt, lt), del: false };
      return;
    }
    if (rt > lt) {
      /* the newer side's value; a field it merely lacks (its copy older
         than the field) is kept — only a field it deleted is deleted */
      if (rp.has(p)) { setPiece(out, p, clone(rp.get(p))); stamps[p] = { t: rt, del: false }; }
      else if (rs[p] && rs[p].del) { setPiece(out, p, undefined); stamps[p] = rs[p]; }
    } else if (!lp.has(p) && rp.has(p) && !(ls[p] && ls[p].del)) {
      setPiece(out, p, clone(rp.get(p)));
      if (rst) stamps[p] = { t: rt, del: false };
    }
  });
  out[META] = Object.assign({}, out[META], { stamps });
  return out;
}

/* ── THE WARD'S ACCOUNT ──────────────────────────────────────────
 * "passwords are only a mean of verification": the file keeps a salted
 * hash of the ward's password, never the password, and the data itself is
 * plain JSON, as asked. */
const normWard = (w) => String(w || '').trim().replace(/\s+/g, ' ');
const wardFileName = (w) => `NCI ward - ${normWard(w).toLowerCase()}.json`;
function passHash(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(password || ''), s, 32).toString('hex');
  return { salt: s, hash: h };
}
function passOk(password, account) {
  if (!account || !account.salt || !account.hash) return false;
  const h = passHash(password, account.salt).hash;
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(String(account.hash), 'hex'));
}

/* ── ONE FILE, EVERY WARD ─────────────────────────────────────────
 * 6 November 2026: NCI's Google account is an ordinary one — no shared
 * drives — and Google lets a service account EDIT a file the account owns
 * and has shared with it, but not CREATE one (a service account has no
 * storage of its own). So every ward lives in ONE file, made once by NCI
 * (the starter file, uploaded to the NCI ORDERS folder): { kind, wards:
 * { "<ward>": { ward, account, savedAt, by, app, data, token } } }.
 * Creating a ward from the app adds an entry to it.
 *
 * Several computers and several wards write the same file. A write reads
 * the file, changes ONLY its own ward's entry, writes it, and reads it back:
 * if its entry is not the one it wrote (another computer wrote in the
 * second between), it does it again — its read now includes the other's
 * write, so nothing of either is lost. */
const STORE_NAME = 'NCI Orders ward data.json';
const wardKey = (w) => normWard(w).toLowerCase();
function store(drive, folder) {
  let id = null;
  const locate = async () => {
    if (id) return id;
    const f = await drive.find(folder, STORE_NAME);
    if (!f) { const e = new Error('no-store'); e.code = 'no-store'; throw e; }
    id = f.id;
    return id;
  };
  const read = async () => {
    /* a network failure is thrown on, never taken for an empty file — an
       empty file would read as "this ward does not exist" and sign the
       computer out (found in testing) */
    const text = await drive.read(await locate());
    let j = {};
    try { j = JSON.parse(text || '{}') || {}; } catch (e) { j = {}; }
    if (!j.wards || typeof j.wards !== 'object') j.wards = {};
    return j;
  };
  /* fn(entry) → { entry } to write, or { error } to stop */
  async function update(key, fn, tries) {
    for (let i = 0; i < (tries || 5); i++) {
      const s = await read();
      const r = fn(s.wards[key]);
      if (!r || r.error) return r || { error: 'nothing' };
      const token = randomHex(8);
      s.kind = 'nci-orders-wards';
      s.wards[key] = Object.assign({}, r.entry, { token });
      await drive.write(await locate(), JSON.stringify(s));
      const back = await read();
      if (back.wards[key] && back.wards[key].token === token) return Object.assign({ ok: true, fileId: id }, r);
    }
    return { error: 'busy' };
  }
  /* 7 November 2026: the physicians' HIS logins (sealed) belong to no
     ward — "credentials and pins are physician specific, not machine or
     ward specific". They sit beside the wards, in the same file; a ward's
     write carries them through unchanged, and a write of them is read
     back like a ward's. fn(physicians) → the new physicians, or { error } */
  async function updatePhysicians(fn, tries) {
    for (let i = 0; i < (tries || 5); i++) {
      const s = await read();
      const cur = s.physicians && typeof s.physicians === 'object' ? s.physicians : {};
      const next = fn(JSON.parse(JSON.stringify(cur)));
      if (!next || next.error) return next || { error: 'nothing' };
      s.kind = 'nci-orders-wards';
      s.physicians = next;
      await drive.write(await locate(), JSON.stringify(s));
      const back = await read();
      if (JSON.stringify(back.physicians || {}) === JSON.stringify(next)) return { ok: true };
    }
    return { error: 'busy' };
  }
  return { locate, read, update, updatePhysicians, get id() { return id; } };
}

/* ── DAILY SNAPSHOTS ─────────────────────────────────────────────
 * 6 November 2026 (suggestion 8): Google Drive already keeps the ward
 * file's earlier versions, for a while. Once a day the version of that
 * moment is marked "keep forever", and those older than 30 days are let go
 * again — thirty daily copies of every ward, with no file of their own. */
const DAY = 86400000;
async function pinDaily(drive, fileId, nowMs, days) {
  const keepDays = days || 30;
  const revs = await drive.revisions(fileId);
  if (!revs.length) return { pinned: false };
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const kept = revs.filter((r) => r.keepForever);
  let pinned = false;
  if (!kept.some((r) => String(r.modifiedTime).slice(0, 10) === today)) {
    await drive.keep(fileId, revs[revs.length - 1].id, true);
    pinned = true;
  }
  let released = 0;
  for (const r of kept) {
    if (nowMs - Date.parse(r.modifiedTime) > keepDays * DAY) { await drive.keep(fileId, r.id, false); released++; }
  }
  return { pinned, released };
}
/* the daily copies, newest first: { id, day } */
async function snapshots(drive, fileId) {
  return (await drive.revisions(fileId)).filter((r) => r.keepForever)
    .map((r) => ({ id: r.id, at: r.modifiedTime, day: String(r.modifiedTime).slice(0, 10) }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}
/* RESTORING A DAY: that day's ward data becomes a fresh change, stamped
   now, so every computer of the ward takes it on its next sync */
function restoreAs(current, old, now) {
  const next = JSON.parse(JSON.stringify(old || {}));
  delete next[META];
  const out = applySave(current, current, Object.assign({}, next, { [META]: (current || {})[META] }), now);
  /* every field this put-back wrote is marked put: its empty boxes are
     meant, and go over text on the other computers too */
  const before = stampsOf(current);
  const st = stampsOf(out);
  Object.keys(st).forEach((k) => { if (st[k] !== before[k] && st[k] && st[k].t >= now) st[k] = Object.assign({}, st[k], { put: true }); });
  return out;
}

/* a Drive folder's id out of its address, or the id itself */
function folderId(s) {
  const t = String(s || '').trim();
  const m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(t) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(t);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : '';
}

const CloudSync = { addValue, notesFrom, applyNotes, overlay, fillBlanks, missingIn, textConflicts, phoneConflicts, applyPhone, pathLabel, stampAt, applyAdditive, addInto, pinDaily, snapshots, restoreAs, store, wardKey, STORE_NAME, pieces, setPiece, changed, applySave, merge, normWard, wardFileName,
  passHash, passOk, folderId, META, ARRAYS, MAPS };
if (typeof module !== 'undefined') module.exports = CloudSync;
if (typeof window !== 'undefined') window.CloudSync = CloudSync;
