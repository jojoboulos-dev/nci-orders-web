'use strict';
/* ══════════════════════════════════════════════════════════════════
 * THE PHONE AND THE PC, THROUGH THE WARD FILE
 *
 * Dr Boulos, 7 November 2026: "if a PC is online with the same ward logged
 * in, it can order the PC to retrieve recent data from HIS". The phone and
 * the PC never talk directly: both reach the one ward file on NCI's Drive
 * (cloudsync.js), and they signal each other through that file's small
 * labels (Drive "properties"), which can be read every minute without
 * downloading the file:
 *
 *   pc_<w>   the PC's heartbeat: "<ms>|<computer>|<his ready 1/0>", every 2 min
 *   ch_<w>   the phone saved something: the PC syncs within a minute
 *   rq_<w>   the phone asked for something (a request id)
 *   dn_<w>   the PC answered that request (the same id)
 *
 * <w> is a short fingerprint of the ward's name, so every ward in the file
 * has its own labels. The request itself, and the PC's answer, live in the
 * ward's entry of the file — `requests` and `hisFetch` — beside its data,
 * where the ordinary sync leaves them alone.
 *
 * What the PC fetched is NOT written into the handover by the PC: "Review
 * on the phone" — the phone shows it child by child, ticked, and fills in
 * only what is kept, by the same rules as Prepare the ward.
 *
 * Loaded by main.js (Node) and by the phone's web view (no Node).
 * ══════════════════════════════════════════════════════════════════ */
(function () {

const txt = (v) => (v == null ? '' : String(v)).trim();
const normWard = (w) => txt(w).replace(/\s+/g, ' ').toLowerCase();

/* FNV-1a, 32 bits: the same 8 characters on the phone and the PC */
function fingerprint(s) {
  let h = 0x811c9dc5;
  const str = unescape(encodeURIComponent(String(s)));
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
function keys(ward) {
  const w = fingerprint(normWard(ward));
  return { pc: `pc_${w}`, ch: `ch_${w}`, rq: `rq_${w}`, dn: `dn_${w}`, al: `al_${w}`, pm: `pm_${w}` };
}

/* ── IS A PC ON? ───────────────────────────────────────────────── */
const ONLINE_MS = 5 * 60 * 1000;      /* a heartbeat every 2 min; 5 allows a late one */
const beat = (now, host, hisReady) => `${now}|${txt(host).slice(0, 40)}|${hisReady ? 1 : 0}`;
function pcStatus(props, ward, now) {
  const v = txt((props || {})[keys(ward).pc]);
  const [at, host, his] = v.split('|');
  const t = Number(at) || 0;
  return { online: !!t && now - t < ONLINE_MS, at: t, host: host || '', hisReady: his === '1' };
}

/* 13 November 2026, Dr Boulos: "add a green/yellow dot on the phone app that
   switched green when the main PC is online" — the main PC beats on its own
   label too (pm_), so another PC being on is not taken for the main one */
function mainStatus(props, ward, now) {
  const v = txt((props || {})[keys(ward).pm]);
  const [at, host, his] = v.split('|');
  const t = Number(at) || 0;
  return { online: !!t && now - t < ONLINE_MS, at: t, host: host || '', hisReady: his === '1' };
}

/* ── A REQUEST ─────────────────────────────────────────────────── */
const STALE_MS = 15 * 60 * 1000;      /* a request no PC took up in 15 min is dropped */
function newRequest(kind, now, by) {
  return { id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind, at: now, by: txt(by) || 'phone', status: 'pending' };
}
function addRequest(entry, req) {
  const list = ((entry && entry.requests) || []).filter(Boolean).slice(-9);   /* the last ten are kept */
  return Object.assign({}, entry, { requests: list.concat([req]) });
}
/* the requests a PC should take up now: pending, not stale, newest first */
function pending(entry, now) {
  return ((entry && entry.requests) || []).filter((r) => r && r.status === 'pending' && now - r.at < STALE_MS)
    .sort((a, b) => b.at - a.at);
}
function settle(entry, id, status, extra, now) {
  const requests = ((entry && entry.requests) || []).map((r) => {
    if (r.id === id) return Object.assign({}, r, { status, doneAt: now }, extra || {});
    if (r.status === 'pending' && now - r.at >= STALE_MS) return Object.assign({}, r, { status: 'expired', doneAt: now });
    return r;
  });
  return Object.assign({}, entry, { requests });
}

/* ── WHAT THE PC SENDS BACK ────────────────────────────────────────
 * Prepare the ward's results, as plain values: today's lab text, the fever
 * line, the 24-hour balance as its line, the HIS's weight and height, and
 * the cultures finalised in the last 2 weeks (their names and dates only —
 * never a result). */
function packResults(results, iso, fluidLine) {
  return (results || []).map((x) => ({
    pid: x.p.id, name: x.p.name, mrn: x.p.mrn, room: x.p.room || '',
    ok: !!x.ok, reason: txt(x.reason),
    text: txt(x.text),
    cultures: (x.cultures || []).map((c) => ({ name: c.name, date: c.date })),
    cultAll: (x.cultAll || []).map((c) => ({ name: c.name, iso: c.iso })),
    cultPend: (x.cultPend || []).map((c) => ({ name: c.name, iso: c.iso })),
    fever: x.fever ? { ok: !!x.fever.ok, line: txt(x.fever.line), max: x.fever.max == null ? null : x.fever.max, reason: txt(x.fever.reason),
      week: Array.isArray(x.fever.week) ? x.fever.week : [] } : null,
    fluidLine: x.fluid && fluidLine ? txt(fluidLine(x.fluid, iso)) : '',
    wt: x.wt ? { weight: x.wt.weight == null ? null : x.wt.weight, height: x.wt.height == null ? null : x.wt.height } : null,
    pageReason: txt(x.pageReason),
  }));
}

/* ── THE PHONE FILLS IN WHAT WAS KEPT ──────────────────────────────
 * `keep` is { "<pid>": { labs, fever, fluid, wt } }. The same as Prepare
 * the ward: the Lab box is replaced; a fever or balance line replaces the
 * one of its kind in CLINICALLY; the weight only when ticked. Returns the
 * number of children changed. */
function applyFetch(data, rows, keep, iso) {
  let n = 0;
  (rows || []).forEach((r) => {
    const k = (keep || {})[r.pid] || {};
    const p = (data.patients || []).find((x) => String(x.id) === String(r.pid));
    if (!p) return;
    data.ward = data.ward || {};
    const st = data.ward[r.pid] = Object.assign({ days: {} }, data.ward[r.pid] || {});
    st.days = Object.assign({}, st.days);
    const day = Object.assign({ clinically: '', labs: '', meds: '', todo: '', medsTouched: false, medsAuto: '' }, st.days[iso] || {});
    let cl = String(day.clinically || '');
    const swap = (re, line) => { const kept = cl.split('\n').filter((l) => !re.test(l)).join('\n').trim(); cl = kept ? `${kept}\n${line}` : line; };
    let touched = false;
    if (k.labs && r.text) { day.labs = r.text; touched = true; }
    if (k.fever && r.fever && r.fever.line) { swap(/^\s*Spikes?\s+\d/, r.fever.line); touched = true; }
    if (k.fluid && r.fluidLine) { swap(/^\s*24h balance\b/i, r.fluidLine); touched = true; }
    day.clinically = cl;
    st.days[iso] = day;
    /* the week's temperatures, for the chart — kept whatever is ticked */
    if (r.fever && Array.isArray(r.fever.week) && r.fever.week.length) {
      const W = (typeof window !== 'undefined' && window.Ward) || (typeof require === 'function' ? require('./renderer/ward.js') : null);
      if (W && W.addTemps) { W.addTemps(st, r.fever.week); touched = true; }
    }
    /* 12 November 2026: cultures into the Cultures section, never the Lab box */
    if ((r.cultAll || []).length) {
      const W2 = (typeof window !== 'undefined' && window.Ward) || (typeof require === 'function' ? require('./renderer/ward.js') : null);
      if (W2 && W2.applyCultures) { W2.applyCultures(st, r.cultAll || []); touched = true; }
    }
    if (k.wt && r.wt) {
      if (r.wt.weight != null) p.weight = r.wt.weight;
      if (r.wt.height != null) p.height = r.wt.height;
      touched = true;
    }
    if (touched) n++;
  });
  return n;
}

/* ── WHAT IS NEW SINCE THE LAST ROUND ─────────────────────────────
 * 7 November 2026: "notify if new labs are out, dont notify for the same
 * lab values twice, you can see time of labs from the website / notify if
 * any cultures are out / notify if an afebrile patient spikes fever, or if
 * a febrile patient has passed 24 hours without fever".
 *
 * After every round the PC compares what the HIS gave with what it had
 * already told (`seen`, kept in the ward's data so every PC of the ward
 * shares it). rows: [{ pid, name, room, labs: [{ k: "WBC|1.25", ms }],
 * labText, cultures: [{ name, date }], temps: [[ms, t]] }] — ms in the
 * HIS's own wall clock, like `now`. A child seen for the first time is
 * only learnt, never announced (the first round would otherwise announce
 * everything). Returns { alerts: [{ pid, kind, text, ms }], seen }.
 *   labs     a result value not told before today: "new labs (09:08): …"
 *   culture  a finalised culture not told before: name and date only
 *   fever    an afebrile child above 38.3: "spiked 38.9 at 14:00"
 *   afebrile a febrile child 24 h without a reading above 38.3 */
const HOUR = 3600000;
const hm = (ms) => { const d = new Date(ms); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const dm = (ms) => { const d = new Date(ms); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
function alertsFrom(seen0, rows, now, feverC) {
  const lim = feverC == null ? 38 : feverC;
  const seen = JSON.parse(JSON.stringify(seen0 || {}));
  const alerts = [];
  const iso = new Date(now).toISOString().slice(0, 10);
  (rows || []).forEach((r) => {
    const pid = txt(r.pid);
    if (!pid) return;
    const who = `${r.room ? `Room ${txt(r.room)} · ` : ''}${txt(r.name)}`;
    const first = !seen[pid];
    const s = seen[pid] = Object.assign({ labs: {}, cult: [], febrile: false, lastFever: 0 }, seen[pid] || {});
    /* 12 November 2026, Dr Boulos: "phone notifications are messy, only
       notify [once] about the same lab value (you can check time of the
       final result)" — a result is told once, ever: its test and the time
       of its result ("WBC@1731400000000"); the message names only the
       results that are new, never the whole Lab box again */
    const told = new Set(s.told || []);
    const keyOf = (l) => `${String(l.k).split('|')[0].toLowerCase()}@${l.ms || String(l.k)}`;
    const fresh = (r.labs || []).filter((l) => l && l.k && !told.has(keyOf(l)));
    if (fresh.length && !first) {
      const t = Math.max(...fresh.map((l) => l.ms || 0));
      alerts.push({ pid, kind: 'labs', ms: now, text: `${who}: new labs${t ? ` (${hm(t)})` : ''} — ${fresh.map((l) => String(l.k).replace('|', ' ')).join(' · ')}` });
    }
    fresh.forEach((l) => told.add(keyOf(l)));
    s.told = Array.from(told).slice(-600);
    delete s.labs;
    /* cultures finalised: the name and the date, never what grew */
    const cultKeys = (r.cultures || []).map((c) => `${txt(c.name)}|${txt(c.date)}`);
    cultKeys.forEach((k, i) => {
      if (s.cult.indexOf(k) >= 0) return;
      if (!first) alerts.push({ pid, kind: 'culture', ms: now, text: `${who}: culture finalised — ${txt(r.cultures[i].name)} (${txt(r.cultures[i].date)}). See the HIS.` });
      s.cult.push(k);
    });
    s.cult = s.cult.slice(-40);
    /* fever: above the cut-off is fever; febrile until 24 h pass without */
    const temps = (r.temps || []).filter((x) => Array.isArray(x) && Number.isFinite(x[0]) && Number.isFinite(x[1]));
    if (temps.length) {
      const spikes = temps.filter((x) => x[1] >= lim).sort((a, b) => a[0] - b[0]);
      const last = spikes.length ? spikes[spikes.length - 1] : null;
      if (first) {
        s.febrile = !!(last && now - last[0] < 24 * HOUR);
        s.lastFever = last ? last[0] : 0;
      } else {
        const newer = spikes.filter((x) => x[0] > (s.lastFever || 0));
        if (!s.febrile && newer.length) {
          const top = newer.reduce((a, b) => (b[1] > a[1] ? b : a));
          alerts.push({ pid, kind: 'fever', ms: now, text: `${who}: fever ${top[1]} °C at ${hm(top[0])}${dm(top[0]) !== dm(now) ? ` (${dm(top[0])})` : ''}` });
          s.febrile = true;
        }
        if (last) s.lastFever = Math.max(s.lastFever || 0, last[0]);
        if (s.febrile && s.lastFever && now - s.lastFever >= 24 * HOUR) {
          alerts.push({ pid, kind: 'afebrile', ms: now, text: `${who}: 24 hours without fever (last ${lastT(spikes, s.lastFever)} °C at ${dm(s.lastFever)} ${hm(s.lastFever)})` });
          s.febrile = false;
        }
      }
    }
  });
  return { alerts, seen };
}
const lastT = (spikes, ms) => { const x = (spikes || []).find((y) => y[0] === ms); return x ? x[1] : '≥38'; };
/* the ward's list of alerts: newest last, three days, at most 100; each
   with an id the phone remembers having shown */
function addAlerts(list, fresh, now) {
  const all = (list || []).concat((fresh || []).map((a, i) => Object.assign({ id: `${now.toString(36)}-${i}` }, a)));
  return all.filter((a) => now - (a.ms || 0) < 3 * 24 * HOUR).slice(-100);
}

const PhoneLink = { mainStatus, alertsFrom, addAlerts, fingerprint, keys, beat, pcStatus, ONLINE_MS, STALE_MS, newRequest, addRequest, pending, settle, packResults, applyFetch };
if (typeof module !== 'undefined') module.exports = PhoneLink;
if (typeof window !== 'undefined') window.PhoneLink = PhoneLink;
})();
