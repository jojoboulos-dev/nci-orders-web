'use strict';
/* ══════════════════════════════════════════════════════════════════
 * NCI ORDERS — THE PHONE
 *
 * Dr Boulos, 7 November 2026: "a very simple app, the first screen is login
 * screen, then the ward patient cards, if i choose a patient, i see the
 * ward handover, the app lets me enter clinical data for today, it doesnt
 * access HIS, but it lets me see the last labs retrieved, the handover is
 * formatted in a phone friendly layout, it lets me add to-do, imaging,
 * cultures, and add drugs to orders, if a PC is online with the same ward
 * logged in, it can order the PC to retrieve recent data from HIS, and can
 * order the PC to book procedures."
 *
 * His answers the same day: the phone books procedures itself (the sheet
 * is Google's, and the key is the same), and what a PC fetches from the
 * HIS is reviewed on the phone before anything is filled in.
 *
 * The data is the ward's own, in the one ward file the computers sync
 * (cloudsync.js): the phone signs in with the ward's name and password,
 * keeps a copy, and every change it makes is written back as a change of
 * its own — stamped, merged piece by piece, exactly as a computer's save
 * is. The HIS is never reached from the phone.
 * ══════════════════════════════════════════════════════════════════ */
(function () {

const FOLDER = '1xqlUCNs22-Ml1xYtgjqJy21ixCkJjo0G';             /* NCI ORDERS */
const PROC_LINK = { id: '1K3fw7vPjwOqfB2p-oLddqm3iCnLev2edfzZsm2Ata9E', gid: '368703704' };
const LS = 'nci-phone-v1';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const txt = (v) => (v == null ? '' : String(v)).trim();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clone = (v) => JSON.parse(JSON.stringify(v));
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => isoOf(new Date());

/* 16 November 2026: this phone's name in the change history and the ward's
   devices — "Phone <model> · <4 letters>", kept */
const DEVICE = (() => {
  try {
    let d = JSON.parse(localStorage.getItem('nci.phone.device') || 'null');
    if (!d || !d.id) {
      const id = Math.random().toString(36).slice(2, 10);
      const m = /Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/|\))/.exec(navigator.userAgent || '');
      const model = m ? m[1].trim().slice(0, 24) : (/iPhone/.test(navigator.userAgent || '') ? 'iPhone' : '');
      d = { id, name: `Phone${model ? ` ${model}` : ''} · ${id.slice(0, 4)}` };
      localStorage.setItem('nci.phone.device', JSON.stringify(d));
    }
    return d;
  } catch (e) { return { id: 'phone', name: 'phone' }; }
})();
let FIELD_LOG = {};
/* ── what the phone keeps ─────────────────────────────────────── */
let S = { login: null, base: null, data: null, dirty: false, outbox: [], fetch: null, requests: [], applied: '', pc: null, modified: '', pulledAt: 0 };
function keep() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { toast('The phone is out of space for the ward\'s copy'); } }
/* 19 November 2026, Dr Boulos: "typing in the round mode is very laggy". Every key saved the phone's whole copy
   of the ward (and, in the handover, worked out the notes over all of it). Now a box shows each key at once and
   is kept half a second after the typing pauses — and at once before the screen changes, a send, or the app
   going to the background, so nothing typed is lost. */
let keepT = null;
let changedT = null;
function keepSoon() { clearTimeout(keepT); keepT = setTimeout(() => { keepT = null; keep(); }, 600); }
function changedSoon() { clearTimeout(changedT); changedT = setTimeout(() => { changedT = null; changed(); }, 600); }
function flushTyping() {
  if (changedT) { clearTimeout(changedT); changedT = null; changed(); }
  if (keepT) { clearTimeout(keepT); keepT = null; keep(); }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushTyping(); });
  window.addEventListener('pagehide', flushTyping);
}
function restore() {
  try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j && j.login) S = Object.assign(S, j); } catch (e) { /* a fresh start */ }
  /* typing left unsent by the version before the notes: made notes, not lost */
  try {
    if (S.login && S.dirty && !(S.outbox || []).length && S.base && S.data && window.CloudSync) {
      S.outbox = CloudSync.notesFrom(S.base, S.data, DEVICE.name, Date.now());
      S.base = JSON.parse(JSON.stringify(S.data));
    }
  } catch (e) { /* sent as it is */ }
}

/* ── Google ───────────────────────────────────────────────────── */
const WEB = !!(window.NCI_WEB && window.NciWebLogin);
let G = null;
const google = () => {
  if (G) return G;
  /* 8 November 2026, the web copy (iPhone): each doctor's own Google
     sign-in instead of a key (weblogin.js) */
  if (WEB) { G = GClient.client({ getToken: () => window.NciWebLogin.token() }); return G; }
  if (!window.NCI_KEY || !window.NCI_KEY.private_key) throw new Error('This copy of the app was built without its Google key.');
  G = GClient.client(window.NCI_KEY);
  return G;
};
const driveStore = () => CloudSync.store(google().drive, FOLDER);
/* 25 November 2026, Dr Boulos: "1 yes" — once the ward's entry is on the new server, the phone reads and writes it
   there (Drive is not asked, the build gate still is). Staff mode reads the wards' names and password checks, which
   stay on Drive. */
const store = () => {
  const d = driveStore();
  const conn = async () => {
    if (!window.Supa || !S.login || staffMode()) return null;
    const m = Supa.mine();
    if (!m || m.ward !== Supa.wardId(wardKey())) return null;
    const known = Supa.entryKnown();
    try { return await Supa.connect(m); } catch (e) { if (known) throw e; return null; }
  };
  const entryOf = async (c) => { const e = await Supa.getEntry(c); if (e && !Supa.entryKnown()) Supa.entryMark(c.ward); return e; };
  return {
    locate: d.locate,
    drive: d,
    async read() {
      await CloudSync.gateNow();
      const c = await conn();
      const e = c ? await entryOf(c) : null;
      if (!e) return d.read();
      const ph = await Supa.getShared(c, 'physicians').catch(() => null);
      return { kind: 'nci-orders-wards', server: true, wards: { [wardKey()]: e.entry }, physicians: ph ? ph.body : {} };
    },
    async update(key, fn, tries) {
      await CloudSync.gateNow();
      const c = S.login && key === wardKey() ? await conn() : null;
      if (!c || !(await entryOf(c))) return d.update(key, fn, tries);
      return Supa.updateEntry(c, fn, tries);
    },
    async updatePhysicians(fn, tries) {
      const c = await conn();
      if (!c || !(await entryOf(c))) return d.updatePhysicians(fn, tries);
      return Supa.updateShared(c, 'physicians', fn, tries);
    },
    updateStaff: d.updateStaff,
  };
};
/* 15 November 2026: "only the last 2 builds should have access to the
   database" (cloudsync.js, buildGate). The newest Android build is on the
   phone app's file on Drive; the newest web copy is the page's own
   version.json. Shut out, an Android phone looks for its update at once. */
const MINE = Number(window.NCI_PHONE_BUILD) || 0;
let gateTold = 0;
CloudSync.setGate(CloudSync.buildGate(MINE, async () => {
  if (WEB) {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? Number((await r.json()).build) || 0 : 0;
  }
  const f = await google().drive.find(FOLDER, PHONE_APK);
  if (!f) return 0;
  const m = await google().drive.meta(f.id);
  return { build: Number((m.properties || {}).build) || 0, at: m.modifiedTime };
}, { onBlocked: () => { if (!WEB && Date.now() - gateTold > 10 * 60 * 1000) { gateTold = Date.now(); setTimeout(() => checkPhoneUpdate(true), 0); } } }));
const wardKey = () => CloudSync.wardKey(S.login.ward);
const K = () => PhoneLink.keys(S.login.ward);
const offline = (e) => /fetch|network|Failed|timeout|offline/i.test(String((e && e.message) || e));

async function scryptHex(password, salt) {
  const enc = new TextEncoder();
  const out = await window.scrypt.scrypt(enc.encode(String(password)), enc.encode(String(salt)), 16384, 8, 1, 32);
  return Array.from(out, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ── signing in: the ward's name and its password, as on a computer ── */
async function signIn(ward, password) {
  /* 25 November 2026, Dr Boulos: "1 yes" — a ward on the new server: its entry and its data from there */
  const key = CloudSync.wardKey(ward);
  let onServer = null;
  if (window.Supa) { try { onServer = await Supa.wardExists(key); } catch (e) { onServer = null; } }
  if (onServer) {
    await CloudSync.gateNow();
    const sec = await Supa.secrets(key, password);
    let c = null;
    try { c = await Supa.connect(sec); } catch (e) { if (e.reask) throw new Error('Wrong password for this ward.'); c = null; }
    const got = c ? await Supa.getEntry(c) : null;
    if (got && got.entry && got.entry.account) {
      const entry = got.entry;
      const h = await scryptHex(password, entry.account.salt);
      if (h !== entry.account.hash) throw new Error('Wrong password for this ward.');
      Supa.keepMine(sec);
      Supa.entryMark(sec.ward);
      const pulled = await Supa.pull(c).catch(() => null);
      const data = (pulled && pulled.data) || {};
      S = { login: { ward: entry.ward || ward, hash: h }, base: clone(data), data: clone(data),
        resetSeen: (entry.reset && entry.reset.id) || '',
        dirty: false, fetch: entry.hisFetch || null, requests: entry.requests || [], applied: (entry.hisFetch && entry.hisFetch.id) || '',
        pc: null, modified: '', pulledAt: Date.now(), sbLive: !!pulled };
      keep();
      return;
    }
  }
  const all = await driveStore().read();
  const entry = all.wards[key];
  if (!entry || !entry.account) throw new Error('There is no ward by that name. Create it on a computer first.');
  if (entry.server && onServer === null) throw new Error('No internet — the ward is on the new server.');
  const h = await scryptHex(password, entry.account.salt);
  if (h !== entry.account.hash) throw new Error('Wrong password for this ward.');
  /* 25 November 2026: the new server — the two secrets the password gives, kept on this phone */
  try { if (window.Supa) Supa.keepMine(await Supa.secrets(CloudSync.wardKey(ward), password)); } catch (e) { /* asked again later */ }
  S = { login: { ward: entry.ward || ward, hash: h }, base: clone(entry.data || {}), data: clone(entry.data || {}),
    resetSeen: (entry.reset && entry.reset.id) || '',
    dirty: false, fetch: entry.hisFetch || null, requests: entry.requests || [], applied: (entry.hisFetch && entry.hisFetch.id) || '',
    pc: null, modified: '', pulledAt: Date.now() };
  keep();
}
/* 25 November 2026: a phone already signed in moves once — the ward's password, the two secrets kept */
let moveAsked = false;
function moveAsk(reason) {
  if (!S.login || staffMode() || !window.Supa || Supa.mine() || document.getElementById('sbMove')) return;
  if (moveAsked && !reason) return;
  moveAsked = true;
  const d = document.createElement('div');
  d.id = 'sbMove';
  d.className = 'sbmove';
  d.innerHTML = `<div class="sbbox"><h3>Move to the new server</h3>
    <p>${reason ? `<b>${esc(reason)}</b><br>` : ''}NCI Orders is moving the ward to a new, encrypted server. Type the ward's password once.</p>
    <input id="sbPw" type="password" autocomplete="current-password" placeholder="The ward's password">
    <p class="err" id="sbErr"></p>
    <div class="row"><button id="sbLater">Later</button><button class="primary" id="sbGo">Move now</button></div></div>`;
  document.body.appendChild(d);
  const close = () => { d.remove(); };
  d.querySelector('#sbLater').onclick = close;
  d.querySelector('#sbGo').onclick = async () => {
    const pw = d.querySelector('#sbPw').value;
    if (!pw) return;
    d.querySelector('#sbGo').disabled = true;
    try {
      const all = await driveStore().read();
      const e = all.wards[wardKey()];
      if (!e || !e.account || (await scryptHex(pw, e.account.salt)) !== e.account.hash) throw new Error('Wrong password for this ward.');
      const sec = await Supa.secrets(wardKey(), pw);
      await Supa.connect(sec);
      Supa.keepMine(sec);
      close();
      toast('Moved — this phone uses the new server');
      pull(true).then(render).catch(() => {});
    } catch (err) { d.querySelector('#sbErr').textContent = err.message; d.querySelector('#sbGo').disabled = false; }
  };
}
function signOut() {
  if (S.dirty && !confirm('Some changes have not reached the ward yet. Sign out and lose them?')) return;
  S = { login: null }; keep();
  try { if (window.Supa) Supa.keepMine(null); } catch (e) { /* fine */ }
  route('login');
}

/* ── the ward file: bringing it in, sending ours out ────────────── */
let busy = null;
/* 12 November 2026, one main PC: the phone never writes the ward's data.
   What is typed here becomes notes (S.outbox, CloudSync.notesFrom), sent to
   the ward's inbox; the main PC adds them in — on a line below, never over
   anything ("notes from other devices should be added to the text in a
   line below, not overwritten, the process should be additive"). What the
   phone shows is the main PC's data with every note still waiting added
   (CloudSync.overlay), so nothing typed here disappears from it. */
/* 13 November 2026: "add a loading animation to the android" — a moving
   bar under the header (and a spinner on the first open) whenever the phone
   is reading or sending */
let loadingN = 0;
/* 17 November 2026, Dr Boulos: "the bottom bar still keeps appearing and
   disappearing very quickly when the app is retrieving data from the cloud".
   The loading mark was a class on <body>: each read or send restyled the
   whole page, and Android's WebView redrew the fixed bar with it. The mark
   is now a thin strip of its own at the top; nothing else is touched. */
function loading(on) {
  loadingN = Math.max(0, loadingN + (on ? 1 : -1));
  if (typeof document === 'undefined' || !document.body) return;
  let el = document.getElementById('loadStrip');
  if (!el) { el = document.createElement('div'); el.id = 'loadStrip'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
  const want = loadingN > 0;
  if (el.classList.contains('on') !== want) el.classList.toggle('on', want);
}
async function withLoading(p) { loading(true); try { return await p; } finally { loading(false); } }
/* `quiet`: a look in the background — no loading bar for it */
async function pull(quiet) {
  if (busy) return busy;
  busy = (quiet ? (x) => x : withLoading)((async () => {
    /* notes that will not go do not stop the reading (they are sent again) */
    if ((S.outbox || []).length) { try { await push(); } catch (e) { /* upload() tries again */ } }
    const all = await store().read();
    const entry = all.wards[wardKey()];
    if (staffMode() && !staffMayOpen(all, wardKey())) {
      S = { login: null }; keep(); route('swards');
      throw new Error('The staff password was changed — type the new one.');
    }
    if (!entry || !entry.account || entry.account.hash !== S.login.hash) {
      S = { login: null }; keep(); route('login');
      throw new Error('The ward\'s password was changed, or the ward is gone — sign in again.');
    }
    /* 15 November 2026: the ward was reset from a computer — this phone's
       own copy and unsent notes go; the main PC's copy is taken as it is */
    if (entry.reset && entry.reset.id && entry.reset.id !== S.resetSeen) {
      S.resetSeen = entry.reset.id;
      S.outbox = []; S.dirty = false; S.good = null; sending = new Set();
      S.data = null;
      toast(`The ward was reset from ${entry.reset.by || 'a computer'} — this phone now shows the main PC's copy`);
    }
    /* something was typed while the ward's file was being read: it is not
       laid over what is on the screen; the next look takes it in */
    if (typing() && S.data) { heldBack = true; return; }
    /* 15 November 2026 ("android app isnt retrieving data right now"): a
       copy written over the ward's by a computer that is not the main PC —
       one still on an old build — is not taken: the phone keeps the main
       PC's copy it last had, and says so (staleNote) */
    const mc = CloudSync.mainCopy(entry, S.good ? { data: S.good, at: S.goodAt } : null);
    if (!mc.foreign) { S.good = clone(entry.data || {}); S.goodAt = entry.mainSavedAt || entry.savedAt || ''; }
    S.foreign = mc.foreign ? { host: mc.foreign, at: entry.savedAt, kept: mc.kept, goodAt: mc.kept ? S.goodAt : '' } : null;
    /* 25 November 2026 ("do everything now"): the new server's copy, when this phone has moved and the ward's main PC
       writes there (in the last 2 days) — with the notes waiting there and on Drive (devices not moved yet) */
    let base0 = mc.data;
    /* 25 November 2026: the ward moved to the new server — Drive no longer has its data; never shown empty */
    if (!base0 && entry.moved) base0 = S.data || {};
    let waitSb = [];
    S.sbLive = false;
    const sec = !staffMode() && window.Supa ? Supa.mine() : null;
    const ssec = staffMode() && window.Supa ? Supa.staffMine() : null;
    if (ssec) {
      try {
        const got = await Supa.staffWard(ssec, wardKey());
        if (got && got.at && Date.now() - Date.parse(got.at) < 2 * 86400000) base0 = got.data;
      } catch (e) { if (e.reask) Supa.keepStaff(null); }
    }
    if (sec && sec.ward === Supa.wardId(wardKey())) {
      try {
        const c = await Supa.connect(sec);
        const got = await Supa.pull(c);
        if (got && got.at && Date.now() - Date.parse(got.at) < 2 * 86400000) {
          base0 = got.data; S.sbLive = true;
          waitSb = await Supa.waiting(c);
          /* 25 November 2026: the phone link's results from the ward's box */
          if (entry.hisFetch && entry.hisFetch.boxed) { const bx = await Supa.getBox(c, 'hisFetch').catch(() => null); if (bx) entry.hisFetch = Object.assign({}, entry.hisFetch, bx); }
          for (const r of (entry.requests || [])) {
            if (r && r.boxed && r.status === 'done') { const bx = await Supa.getBox(c, `req-${r.id}`).catch(() => null); if (bx) Object.assign(r, bx); }
          }
          const wIds = new Set(waitSb.map((n) => n.id));
          (S.sentLog || []).forEach((x) => { if (x.sb && x.state === 'inbox' && !wIds.has(x.id)) { x.state = 'main'; x.tookAt = got.at; } });
        }
      } catch (e) { if (e.reask) { Supa.keepMine(null); setTimeout(() => moveAsk(e.message), 0); } }
    }
    if (entry.moved && !S.sbLive && !staffMode()) setTimeout(() => moveAsk('The ward is on the new server now — type the ward\'s password to keep this phone up to date.'), 0);
    const shown = CloudSync.overlay(base0, (entry.inbox || []).concat(waitSb, S.outbox || []));
    S.base = clone(shown); S.data = clone(shown);
    /* "find the to-do list already copied from yesterday and editable" */
    let carried = 0;
    patients().forEach((p) => { if (S.data.ward && S.data.ward[p.id] && Ward.carryTodo && Ward.carryTodo(S.data.ward[p.id], today())) carried++; });
    /* what the main PC took in, of what this phone sent (sentState) */
    const inboxIds = new Set((entry.inbox || []).map((n) => n.id));
    const doneIds = new Set(entry.done || []);
    (S.sentLog || []).forEach((x) => {
      if (doneIds.has(x.id)) { if (x.state !== 'main') { x.state = 'main'; x.tookAt = entry.mainSavedAt || entry.savedAt || ''; } }
      else if (inboxIds.has(x.id)) x.state = 'inbox';
    });
    S.mainHost = entry.main ? entry.main.host : '';
    S.waiting = (entry.inbox || []).length;
    S.fetch = entry.hisFetch || null;
    S.requests = entry.requests || [];
    /* the main PC's key for a PIN, and the names whose logins are saved */
    S.pinKey = entry.pinKey ? entry.pinKey.key : '';
    S.physicians = Object.keys(all.physicians || {}).map((k) => all.physicians[k].name).filter(Boolean).sort();
    S.pulledAt = Date.now();
    FIELD_LOG = entry.log || {};
    keep();
    if (carried && !staffMode()) setTimeout(changed, 0);
    /* this phone's line in the ward's devices, once a day when it sent nothing */
    const mine = (entry.devices || {})[DEVICE.id];
    if (staffMode()) return;
    if (!mine || new Date(mine.at).toDateString() !== new Date().toDateString() || mine.build !== (Number(window.NCI_PHONE_BUILD) || 0)) {
      store().update(wardKey(), (e) => (e && e.account && e.account.hash === S.login.hash ? { entry: CloudSync.deviceSeen(e, DEVICE.id,
        { name: DEVICE.name, kind: WEB ? 'web' : 'phone', build: Number(window.NCI_PHONE_BUILD) || 0, role: 'phone', sb: !!(window.Supa && Supa.mine()), entry: !!(window.Supa && Supa.entryKnown()) }) } : { error: 'skip' })).catch(() => {});
    }
  })());
  try { return await busy; } finally { busy = null; }
}
let pushing = null;
async function push() {
  if (pushing) return pushing;
  pushing = withLoading((async () => {
    const st = store();
    const now = Date.now();
    const out = (S.outbox || []).map((n) => clone(n));
    if (!out.length) { S.dirty = false; keep(); return; }
    sending = new Set(out.map((n) => n.id));
    /* 25 November 2026: moved, and the ward's main PC writes to the new server — the notes go there */
    const sec = S.sbLive && !staffMode() && window.Supa ? Supa.mine() : null;
    if (sec) {
      try {
        const c = await Supa.connect(sec);
        const there = new Set(await Supa.sendNotes(c, out));
        const sentSb = new Set(out.filter((n) => there.has(String(n.id).slice(0, 64))).map((n) => n.id));
        S.outbox = (S.outbox || []).filter((n) => !sentSb.has(n.id));
        S.sentLog = (S.sentLog || []).concat(out.filter((n) => sentSb.has(n.id)).map((n) => ({ id: n.id, pid: notePid(n), at: n.at, state: 'inbox', sb: true }))).slice(-400);
        S.dirty = S.outbox.length > 0;
        keep();
        if (sentSb.size < out.length) throw new Error(`Not confirmed — ${out.length - sentSb.size} note(s) did not reach the ward. They are sent again.`);
        S.confirmedAt = Date.now();
        return;
      } catch (e) { if (/Not confirmed/.test(e.message)) throw e; /* the new server cannot be reached: Drive, as before */ }
    }
    const r = await st.update(wardKey(), (entry) => {
      if (!entry || !entry.account || entry.account.hash !== S.login.hash) return { error: 'signed-out' };
      /* the ward was reset: what this phone had not sent is dropped, not sent */
      if (entry.reset && entry.reset.id && entry.reset.id !== S.resetSeen) return { error: 'reset' };
      const have = new Set((entry.inbox || []).map((n) => n.id).concat(entry.done || []));
      return { entry: CloudSync.deviceSeen(Object.assign({}, entry, { inbox: (entry.inbox || []).concat(out.filter((n) => !have.has(n.id))) }), DEVICE.id,
        { name: DEVICE.name, kind: WEB ? 'web' : 'phone', build: Number(window.NCI_PHONE_BUILD) || 0, role: 'phone', sb: !!(window.Supa && Supa.mine()), entry: !!(window.Supa && Supa.entryKnown()) }) };
    });
    if (r && r.error === 'reset') { S.outbox = []; S.dirty = false; keep(); return; }   /* pull() takes the reset */
    if (!r || r.error) throw new Error(r && r.error === 'signed-out' ? 'The ward\'s password was changed — sign in again.' : 'The ward file was busy — try again.');
    /* "confirm the sync": read back a moment later; every note must be in
       the ward's inbox (or already taken in by the main PC) */
    await new Promise((res) => setTimeout(res, 2000));
    const back = (await st.read()).wards[wardKey()] || {};
    const there = new Set((back.inbox || []).map((n) => n.id).concat(back.done || []));
    const sent = new Set(out.filter((n) => there.has(n.id)).map((n) => n.id));
    S.outbox = (S.outbox || []).filter((n) => !sent.has(n.id));
    /* 15 November 2026: "when I add data to a certain somebody, I'm not sure
       it will reach the PC" — each note sent is followed until the main PC
       has taken it in (pull: sentState) */
    S.sentLog = (S.sentLog || []).concat(out.filter((n) => sent.has(n.id)).map((n) => ({ id: n.id, pid: notePid(n), at: n.at, state: 'inbox' }))).slice(-400);
    S.dirty = S.outbox.length > 0;
    S.requests = r.entry.requests || S.requests;
    keep();
    if (sent.size < out.length) throw new Error(`Not confirmed — ${out.length - sent.size} note(s) did not reach the ward. They are sent again.`);
    S.confirmedAt = Date.now();
    /* "a phone saved something": the main PC takes it in within a minute */
    try { await google().drive.setProps(await st.locate(), { [K().ch]: String(now) }); } catch (e) { /* its next backup takes it */ }
  })());
  try { return await pushing; } finally { pushing = null; sending = new Set(); }
}
/* 9 November 2026: "save edits on phone and pc momentarily, and upload at
   the earliest opportunity, dont save directly to the cloud" — an edit is
   kept on the phone at once (keep); the upload follows in the background,
   and one that fails is tried again every minute, and the moment the phone
   is back online, until it goes */
let pushTimer = null;
let pushRetry = null;
function upload() {
  if (changedT || keepT) flushTyping();
  clearTimeout(pushRetry);
  push().then(syncBadge).catch((e) => {
    syncBadge();
    if (!offline(e)) toast(e.message);
    if (S.dirty) pushRetry = setTimeout(upload, 60 * 1000);
  });
}
/* 14 November 2026, Dr Boulos: "android app has these bugs, and keeps
   updating while im typing … and it keeps exiting the patient and going
   back to main menu". Every key had made a note of its own and sent it; the
   ward's copy came back mid-word and the screen was drawn again under the
   thumbs. Now:
   - a box being typed in has ONE note, which grows with the typing (a note
     already on its way is left alone, and the next one follows it);
   - it is sent when the typing stops — six seconds after the last key, or
     at once on leaving the box — not while a word is being written;
   - while a box is in use the ward's copy is not read in and the screen is
     not redrawn (typing()); it is done as soon as the box is left;
   - the screen the user was on is remembered (keepView), so a restart of
     the app's page comes back to the same patient, not to the list. */
let lastKey = 0;
let sending = new Set();
const inBox = () => { const a = typeof document !== 'undefined' && document.activeElement; return !!(a && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'button'); };
const typing = () => inBox() || Date.now() - lastKey < 8000;
function changed() {
  /* what was typed since the last time: notes for the main PC */
  const notes = CloudSync.notesFrom(S.base || {}, S.data || {}, DEVICE.name, Date.now());
  /* a box being typed in keeps ONE note, which grows with the typing */
  const fresh = notes.filter((n) => {
    const mine = (S.outbox || []).find((o) => o.path === n.path && !sending.has(o.id) && typeof o.value === 'string' && typeof n.value === 'string');
    if (mine) { mine.value = n.value; mine.at = n.at; }
    return !mine;
  });
  if (fresh.length) S.outbox = (S.outbox || []).concat(fresh);
  S.base = clone(S.data);
  S.dirty = (S.outbox || []).length > 0; keep(); syncBadge();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(upload, inBox() ? 6000 : 1500);
}
if (typeof document !== 'undefined') {
  document.addEventListener('input', () => { lastKey = Date.now(); }, true);
  /* leaving a box: send what was typed, and take in what was held back */
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (inBox()) return;
      if (S.dirty) { clearTimeout(pushTimer); pushTimer = setTimeout(upload, 300); }
      if (heldBack) { heldBack = false; setTimeout(() => { if (!typing()) look(); }, 2500); }
    }, 200);
  }, true);
}
let heldBack = false;
if (typeof window !== 'undefined') window.addEventListener('online', () => { if (S.dirty) upload(); });

/* every minute while open: the file's labels — is a PC on, did anything change */
async function look() {
  if (!S.login) return;
  try {
    const st = store();
    const m = await google().drive.meta(await st.locate());
    S.pc = PhoneLink.pcStatus(m.properties || {}, S.login.ward, Date.now());
    S.main = PhoneLink.mainStatus ? PhoneLink.mainStatus(m.properties || {}, S.login.ward, Date.now()) : S.pc;
    /* 16 November 2026 ("the app is always loading and twitching"): the
       ward's file is read again only when THIS ward's data changed (the main
       PC's mark, wv_), when this ward's phones or PCs sent something (ch_),
       or ten minutes have gone by — not at every heartbeat or another
       ward's save. With a main PC from before the mark, as before. */
    const pr = m.properties || {};
    const mark = pr[K().wv] ? `wv:${pr[K().wv]}|${pr[K().ch] || ''}` : `mt:${m.modifiedTime}`;
    const due = mark !== S.modified || Date.now() - (S.pulledAt || 0) > 10 * 60 * 1000;
    if (due) {
      /* a finger on the screen: taken in once it is still */
      if (!typing() && scrolling()) { setTimeout(look, 3000); syncBadge(); return; }
      if (typing()) heldBack = true;                 /* taken in when the box is left */
      else { S.modified = mark; await pull(true); if (typing()) heldBack = true; else render(); }
    }
    tellRunner(await st.locate());
    syncBadge();
  } catch (e) { if (e && e.googleSignIn && !$('.reconnect')) render(); syncBadge(e); }
}

/* ── the screens ───────────────────────────────────────────────── */
let view = { name: 'login', pid: null };
const VIEW_KEY = 'nci.phone.view';
function keepView() { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ name: view.name, pid: view.pid, at: Date.now() })); } catch (e) { /* opens on the list */ } }
/* the screen to open on: where the user was, if that was within the hour */
function lastView() {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null');
    if (v && Date.now() - v.at < 60 * 60 * 1000 && ['patient', 'todo', 'labs', 'alerts'].indexOf(v.name) >= 0
      && (v.name !== 'patient' || ((S.data || {}).patients || []).some((p) => String(p.id) === String(v.pid)))) return v;
  } catch (e) { /* the list */ }
  return null;
}
function route(name, pid) { flushTyping(); view = { name, pid: pid || null }; keepView(); drawnView = ''; render(); window.scrollTo(0, 0); }
/* 15 November 2026, Dr Boulos: "Keeps refreshing in the main menu UI and
   scrolling downwards by mistake." The ward's copy is looked at every
   minute and the screen was rebuilt each time, from the top. Now a screen
   is rebuilt only when what it shows has changed; when it is, it stays
   where it was scrolled, with the same sections open; and while a finger
   is on the screen, or a moment after scrolling, nothing is redrawn. */
let lastScroll = 0;
let drawnView = '';
if (typeof window !== 'undefined') {
  ['scroll', 'touchstart', 'touchmove'].forEach((t) => window.addEventListener(t, () => { lastScroll = Date.now(); }, { passive: true, capture: true }));
}
const scrolling = () => Date.now() - lastScroll < 2500;
function render() {
  const app = $('#app');
  if (!appMode() && !S.login) view.name = 'mode';
  else if (staffMode() && (!S.login || !/^(ward|patient)$/.test(view.name))) view.name = 'swards';
  else if (!S.login) view.name = 'login';
  const key = `${view.name}|${view.pid || ''}`;
  const html = ({ mode: modeHtml, swards: swardsHtml, login: loginHtml, ward: wardHtml, patient: patientHtml, fetch: fetchHtml, book: bookHtml, todo: todoHtml, chemo: chemoHtml, round: roundHtml, admit: admitHtml, alerts: alertsHtml, labs: labsHtml, pin: pinHtml }[view.name] || wardHtml)();
  const same = key === drawnView;
  if (same && app.dataset.sig === html) { syncBadge(); return; }      /* nothing new to show */
  const y = same ? window.scrollY : 0;
  const open = same ? $$('details', app).map((d) => d.open) : [];
  drawnView = key;
  app.dataset.sig = html;
  /* 16 November 2026 ("It still jumps suddenly between names in the main
     menu"; "always loading and twitching"): the same screen is not rebuilt —
     only the pieces whose content changed are swapped (a card, a note), the
     rest stay as they are, scrolled where they were */
  if (same && morph(app, html)) { render2(app); return; }
  if (same) app.style.minHeight = `${app.offsetHeight}px`;
  app.innerHTML = html;
  stamp(app);
  if (same) {
    $$('details', app).forEach((d, i) => { if (open[i] != null) d.open = open[i]; });
    window.scrollTo(0, y);
    requestAnimationFrame(() => { app.style.minHeight = ''; });
  } else app.style.minHeight = '';
  render2(app);
}
/* each piece remembers the HTML it was made from (what the screen does to it
   afterwards — a status line filled, a section opened — is not a change) */
const LISTS = /(^| )(cards|list)( |$)/;
function stamp(root) {
  Array.from(root.children).forEach((n) => { n.__src = n.outerHTML; if (LISTS.test(n.className)) Array.from(n.children).forEach((c) => { c.__src = c.outerHTML; }); });
}
function morph(app, html) {
  const t = document.createElement('div');
  t.innerHTML = html;
  const old = Array.from(app.children).filter((n) => !/(^| )(buildtag|reconnect)( |$)/.test(n.className));
  const neu = Array.from(t.children);
  if (old.length !== neu.length || old.some((n) => n.__src == null)) return false;
  for (let i = 0; i < old.length; i++) {
    const a = old[i], b = neu[i];
    const src = b.outerHTML;
    if (a.__src === src) continue;
    if (LISTS.test(a.className) && a.className === b.className && a.children.length === b.children.length && Array.from(a.children).every((c) => c.__src != null)) {
      const bc = Array.from(b.children);
      Array.from(a.children).forEach((c, k) => {
        const s2 = bc[k].outerHTML;
        if (c.__src === s2) return;
        const hid = c.hidden;
        bc[k].__src = s2;
        if (hid) bc[k].hidden = true;
        c.replaceWith(bc[k]);
      });
      a.__src = src;
      continue;
    }
    const open = a.tagName === 'DETAILS' ? [a.open] : $$('details', a).map((d) => d.open);
    b.__src = src;
    if (LISTS.test(b.className)) Array.from(b.children).forEach((c) => { c.__src = c.outerHTML; });
    a.replaceWith(b);
    (b.tagName === 'DETAILS' ? [b] : $$('details', b)).forEach((d, k) => { if (open[k] != null) d.open = open[k]; });
  }
  return true;
}
function render2(app) {
  ({ mode: modeWire, swards: swardsWire, login: loginWire, ward: wardWire, patient: patientWire, fetch: fetchWire, book: bookWire, todo: todoWire, chemo: chemoWire, round: roundWire, admit: admitWire, alerts: alertsWire, labs: labsWire, pin: pinWire }[view.name] || wardWire)();
  /* 14 November 2026: "add build versions at the bottom of both apps" */
  const tag = document.createElement('div');
  tag.className = 'buildtag';
  tag.textContent = Number(window.NCI_PHONE_BUILD) ? `${WEB ? 'Web build' : 'Build'} ${window.NCI_PHONE_BUILD}` : (WEB ? 'Web copy' : 'Build —');
  /* 15 November 2026: "add a button beside build number to check for updates" */
  const chk = document.createElement('button');
  chk.type = 'button';
  chk.className = 'buildchk';
  chk.textContent = 'Check for updates';
  chk.onclick = () => manualUpdate(chk);
  tag.appendChild(chk);
  if (!$('.buildtag', app)) app.appendChild(tag);
  navBar();
  /* the web copy: Google's hour is up — one tap renews it (Safari opens
     Google's window only from a tap) */
  if (WEB && S.login && !window.NciWebLogin.signedIn()) {
    const bar = document.createElement('div');
    bar.className = 'reconnect';
    bar.innerHTML = '<span>Google sign-in has expired — the ward cannot sync.</span> <button class="primary" id="reGoogle">Reconnect Google</button>';
    app.prepend(bar);
    $('#reGoogle').onclick = async () => {
      try { await window.NciWebLogin.ask(); render(); look(); } catch (e) { toast(e.message); }
    };
  }
  syncBadge();
}
function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3500);
}
/* the child a note is about: ward|orders|patients <SEP> id … */
const notePid = (n) => String((n && n.path) || '').split('\u001f')[1] || '';
const hhmm = (t) => { const d = new Date(t); return isNaN(d) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/* where what was typed for one child is: { here, waiting, took, last } */
function childSync(pid) {
  const id = String(pid);
  const here = (S.outbox || []).filter((n) => notePid(n) === id).length;
  const mine = (S.sentLog || []).filter((x) => x.pid === id);
  const waiting = mine.filter((x) => x.state !== 'main').length;
  const took = mine.filter((x) => x.state === 'main');
  const last = took.length ? took.map((x) => x.tookAt || '').sort().pop() : '';
  return { here, waiting, took: took.length, last };
}
function childSyncHtml(pid) {
  const c = childSync(pid);
  if (c.here) return `<div class="csync warn">⏳ ${c.here} change${c.here > 1 ? 's' : ''} for this child saved on this phone, not sent yet — sent when the connection allows</div>`;
  if (c.waiting) return `<div class="csync wait">↑ ${c.waiting} change${c.waiting > 1 ? 's' : ''} sent — waiting for the main PC to take ${c.waiting > 1 ? 'them' : 'it'} in</div>`;
  if (c.took) return `<div class="csync ok">✓ Everything you entered for this child is in the main PC's copy${c.last ? ` (${esc(hhmm(c.last))})` : ''}</div>`;
  return '';
}
function syncBadge(err) {
  const b = $('#syncBadge');
  if (!b || !S.login) return;
  const pc = S.main && S.main.online ? `Main PC on (${esc(S.main.host)})` : S.pc && S.pc.online ? `Main PC off · ${esc(S.pc.host)} on` : 'Main PC off';
  const dot = $('#pcDot');
  if (dot) {
    dot.className = `pcdot ${S.main && S.main.online ? 'on' : 'off'}`;
    dot.title = S.main && S.main.online ? `The main PC (${S.main.host}) is on` : 'The main PC is not on — what you type waits for it';
  }
  const at = S.confirmedAt ? new Date(S.confirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const n = (S.outbox || []).length;
  if (err && err.code === 'too-old') { b.innerHTML = `<b>${esc(err.message)}</b>`; b.dataset.t = ''; b.className = 'syncbadge warn tall'; return; }
  /* 16 November 2026, Dr Boulos: "the phone still keeps glitching … when it
     finishes the search for new data/updating" — this line changed its
     words, and from one line to two, each time a look ended, and everything
     under it jumped. It is ONE line of fixed height now (the rest is cut
     with …; a tap shows it whole), and rewritten only when its words change. */
  const text = `${n ? `${n} to send…` : err ? 'Offline — saved here' : `✓ Sent${at ? ` ${at}` : ''}`} · ${pc}`;
  const cls = `syncbadge${S.dirty || err || S.foreign ? ' warn' : ''}${view.name === 'round' ? ' hidden' : ''}`;
  const html = `<span class="sbline">${esc(text)}</span>`;
  if (b.dataset.t !== html) { b.innerHTML = html; b.dataset.t = html; }
  if (b.className !== cls) b.className = cls;
  b.onclick = () => toast(text);
  const sn = $('#staleNote');
  const stale = staleNote();
  if (sn && sn.dataset.t !== stale) { sn.innerHTML = stale; sn.dataset.t = stale; sn.hidden = !stale; }
}
/* the ward's copy on Drive is not the main PC's: said in plain words */
const hm = (t) => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
function staleNote() {
  const f = S.foreign;
  if (!f) return '';
  return `<b>${esc(f.host)} runs an old version of the app and wrote over the ward's copy${hm(f.at) ? ` (${esc(hm(f.at))})` : ''}.</b> `
    + (f.kept ? `Showing the main PC's copy of ${esc(hm(f.goodAt))}.` : 'Orders, imaging and cultures may be missing here.')
    + ' Open the app on the main PC to put it right, and update the app on that computer.';
}
const patients = () => ((S.data && S.data.patients) || []).filter((p) => !p.discharged)
  .sort((a, b) => (Number(a.room) || 99) - (Number(b.room) || 99) || txt(a.name).localeCompare(txt(b.name)));
/* READING a child's handover never changes the phone's copy: a copy
   filled out for display only. Only a child actually edited is written
   back (editWard), so a look at one child never sends that child's whole
   record over a newer one from a PC. */
const readWard = (pid) => Ward.normalise(clone(((S.data && S.data.ward) || {})[pid] || {}));
const editWard = (pid) => {
  S.data.ward = S.data.ward || {};
  S.data.ward[pid] = Ward.normalise(S.data.ward[pid]);
  return S.data.ward[pid];
};

/* ── 1. sign in ── */
function loginHtml() {
  /* the web copy: first the doctor's own Google account, then the ward */
  if (WEB && !window.NciWebLogin.signedIn()) {
    const was = window.NciWebLogin.email();
    return `<div class="login">
    <h1>NCI Orders</h1><p class="dim">Pediatric Oncology · the ward on your phone</p>
    <button class="primary big" id="lgGoogle">Sign in with Google</button>
    <p class="err" id="lgErr"></p>
    <p class="dim small">${was ? `Last signed in as ${esc(was)}. ` : ''}Use the Google account the NCI ORDERS folder is shared with. Then the ward's name and password.</p></div>`;
  }
  return `<div class="login">
    <h1>NCI Orders</h1><p class="dim">Pediatric Oncology · the ward on your phone</p>${WEB ? `
    <p class="dim small">Google: ${esc(window.NciWebLogin.email())} · <a href="#" id="lgSwitch">another account</a></p>` : ''}
    <label>Ward<input id="lgWard" autocomplete="username" placeholder="e.g. 4th South"></label>
    <label>Password<input id="lgPass" type="password" autocomplete="current-password"></label>
    <!-- 22 November 2026, Dr Boulos: "When the user enters username and password, there should be a check below it that
         says staff mode … If it's ticked and the user enters a staff username and password … he should enter strictly
         into staff mode" -->
    <label class="chk lgstaff"><input type="checkbox" id="lgStaff"> Staff mode</label>
    <button class="primary big" id="lgGo">Sign in</button>
    <p class="err" id="lgErr"></p>
    <p class="dim small">The same ward name and password as on the ward's computers.</p></div>`;
}
/* the staff login: the staff user name and password set on a ward's PC (Troubleshooting → Staff password…). Strictly
   staff mode: every ward, read only; never a ward's own login */
async function staffSignIn(user, pass) {
  const all = await driveStore().read();
  const st = all.staff;
  if (!st || !st.hash) throw new Error('No staff login yet — set it on a ward\'s PC: Troubleshooting → Staff password…');
  const hs = await scryptHex(pass, st.salt);
  if (String(user).trim().toLowerCase() !== String(st.user || 'staff').toLowerCase() || hs !== st.hash) throw new Error('Wrong staff user name or password.');
  try { localStorage.setItem(STAFF_ONE, hs); } catch (x) { /* asked again next time */ }
  staffServer(pass);
  setMode('staff');
  quietRunner();
  S = { login: null }; keep();
  staffWards = null;
  toast('Staff mode: every ward, read only');
  route('swards');
}
function loginWire() {
  if ($('#lgGoogle')) {
    $('#lgGoogle').onclick = async () => {
      $('#lgGoogle').disabled = true;
      try { await window.NciWebLogin.ask(); render(); }
      catch (e) { $('#lgErr').textContent = e.message; $('#lgGoogle').disabled = false; }
    };
    return;
  }
  if ($('#lgSwitch')) $('#lgSwitch').onclick = (ev) => { ev.preventDefault(); window.NciWebLogin.signOut(); try { localStorage.removeItem('nci-web-email'); } catch (e) { /* none */ } render(); };
  $('#lgStaff').onchange = () => { const on = $('#lgStaff').checked; $('#lgWard').placeholder = on ? 'staff' : 'e.g. 4th South'; $('#lgWard').previousSibling.textContent = on ? 'User name' : 'Ward'; };
  $('#lgGo').onclick = async () => {
    const w = txt($('#lgWard').value); const p = $('#lgPass').value;
    const asStaff = $('#lgStaff').checked;
    if (!w || !p) { $('#lgErr').textContent = asStaff ? 'Type the staff user name and password.' : 'Type the ward name and the password.'; return; }
    $('#lgGo').disabled = true; $('#lgGo').textContent = 'Signing in…';
    try {
      if (asStaff) { await staffSignIn(w, p); return; }
      if (/^staff$/i.test(w)) throw new Error('For the staff login, tick Staff mode.');
      await signIn(w, p); route('ward'); look();
    }
    catch (e) { $('#lgErr').textContent = offline(e) ? 'No internet — the first sign-in needs it.' : e.message; }
    finally { const b = $('#lgGo'); if (b) { b.disabled = false; b.textContent = 'Sign in'; } }
  };
}

/* ── 2. the ward's cards ── */
function badges(p) {
  /* 22 November 2026, Dr Boulos: "make sure tags on windows and mobile are the same" — the PC's own list (Ward.boardTags) */
  const day = today();
  const newLabs = todaysAlerts().filter((a) => String(a.pid) === String(p.id) && a.kind === 'labs');
  const t = newLabs.length ? new Date(Math.max(...newLabs.map((a) => a.ms || 0))) : null;
  return Ward.boardTags(p, { day, today: day, ward: readWard(p.id), order: ((S.data.orders || {})[String(p.id)]) || {},
    drugs: S.data.drugs || [], newLabsAt: t ? `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : '' });
}
function header(title, back) {
  return `<header class="bar">${back ? `<button class="back" id="goBack">‹</button>` : ''}<span class="pcdot ${S.main && S.main.online ? 'on' : 'off'}" id="pcDot"></span><h2>${title}</h2>
    ${back ? '' : '<button class="ghost" id="signOut">Sign out</button>'}</header><div class="syncbadge" id="syncBadge"></div><div class="note warn" id="staleNote" hidden></div>`;
}
function wardHtml() {
  if (staffMode()) {
    const kids = patients();
    return `<header class="bar"><button class="back" id="goWards">‹</button><h2><bdi>${esc(S.login.ward)}</bdi> · ${kids.length} children</h2></header>
      <div class="wsearch"><input id="wardQ" type="search" placeholder="Search name, MRN or room" autocomplete="off" value="${esc(wardQ)}"></div>
      <div class="cards" id="wardCards">${kids.map((p) => `<button class="card" data-pid="${esc(p.id)}" data-find="${esc(`${p.name} ${p.mrn || ''} room ${p.room || ''}`.toLowerCase())}">
        <div class="top"><span class="room">${p.room ? esc(p.room) : '—'}</span><bdi class="nm">${esc(p.name)}</bdi></div>
        <div class="meta">${esc(p.mrn || '')} · ${esc(Sheet.dayLabel(p, today()) || p.diagnosis || '')}</div></button>`).join('') || '<p class="dim">No children on the ward.</p>'}</div>`;
  }
  const list = patients();
  const fresh = S.fetch && S.fetch.id !== S.applied;
  const pending = (S.requests || []).filter((r) => r.status === 'pending' && Date.now() - r.at < PhoneLink.STALE_MS);
  const last = (S.requests || []).slice(-1)[0];
  return `${header(`<bdi>${esc(S.login.ward)}</bdi> · ${list.length} children`)}
    ${/* 16 November 2026, Dr Boulos: "android UI needs to be better" — the nine
         buttons were a screen of their own; they are small tiles now, and the
         children start on the first screen */''}
    ${/* 16 November 2026, Dr Boulos: "get me a better android UI … reconsider
         android" — the daily four are a bar at the foot of the screen, under
         the thumb; the rest, and admitting a child, are under More; the
         children are the screen */''}
    <div class="wsearch"><input id="wardQ" type="search" placeholder="Search name, MRN or room" autocomplete="off" value="${esc(wardQ)}"></div>
    <div class="morepanel" id="morePanel"${moreOpen ? '' : ' hidden'}>
      <button id="toAdmit" class="mrow"><span class="ti">🛏</span><span><b>Admit a patient</b><small>New on the ward — from the HIS list, or typed</small></span></button>
      <button id="toChemo" class="mrow"><span class="ti">💉</span><span><b>Chemo recap</b><small>Who gets what today and tomorrow</small></span></button>
      <button id="askHis" class="mrow"><span class="ti">⟳</span><span><b>Fetch from HIS</b><small>${S.pc && S.pc.online ? 'A PC is on and can answer' : 'Waits for a PC to be on'}</small></span></button>
      <button id="toLabs" class="mrow" title="Request labs"><span class="ti">🧪</span><span><b>Request labs</b><small>Suggestions ticked; ordered in the HIS through the main PC</small></span></button>
      <button id="toBook" class="mrow"><span class="ti">＋</span><span><b>Book a procedure</b><small>Marrow, intrathecal, CSF</small></span></button>
      <button id="askPdfs" class="mrow"><span class="ti">📄</span><span><b>Handover + next day's orders and labs</b><small>PDFs made by a PC, downloaded here</small></span></button>
      <button id="toPin" class="mrow"><span class="ti">🔑</span><span><b>Sign the main PC in to the HIS</b><small>With your PIN</small></span></button>
      <button id="toStaff" class="mrow"><span class="ti">👁</span><span><b>Staff mode</b><small>Every ward, read only — no alerts, nothing to type</small></span></button>
    </div>
    ${pending.length ? `<div class="note">Asked a PC for the HIS at ${new Date(pending[0].at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — waiting for it.</div>` : ''}
    ${last && last.status === 'failed' ? `<div class="note warn">The PC could not ${last.kind === 'pdfs' ? 'make the PDFs' : last.kind === 'signin' ? 'sign in' : 'fetch from the HIS'}: ${esc(last.reason)}</div>` : ''}
    ${fresh ? `<button class="note ok wide" id="toFetch">HIS results from ${esc(S.fetch.host)} are ready to review →</button>` : ''}
    ${/* 22 November 2026: "remove the repeated patient list fom below the more screen" */''}
    <div class="cards" id="wardCards"${moreOpen ? ' hidden' : ''}>${list.map((p) => `<button class="card${badges(p).some(([k]) => k === 'alarm') ? ' hot' : ''}" data-pid="${esc(p.id)}" data-find="${esc(`${p.name} ${p.mrn || ''} room ${p.room || ''}`.toLowerCase())}"${wardQ && `${p.name} ${p.mrn || ''} room ${p.room || ''}`.toLowerCase().indexOf(wardQ.toLowerCase()) < 0 ? ' hidden' : ''}>
      <div class="top"><span class="room">${p.room ? esc(p.room) : '—'}</span><bdi class="nm">${esc(p.name)}</bdi></div>
      <div class="meta">${esc(p.mrn || '')} · ${esc(Sheet.dayLabel(p, today()) || p.diagnosis || '')}${(() => { const c = childSync(p.id); return c.here || c.waiting ? ` · <span class="csmall">⏳ ${c.here + c.waiting} not yet on the PC</span>` : ''; })()}</div>
      <div class="bdg">${badges(p).map(([k, t]) => `<span class="b b-${k}" dir="auto">${esc(t)}</span>`).join('')}</div>
    </button>`).join('') || '<p class="dim">No children on the ward.</p>'}</div>`;
}
let wardQ = '';
let moreOpen = false;
/* 16 November 2026, Dr Boulos: "have the bottom bar be always there, add
   another icon called home, right now 'round' is toggle". The bar is made
   once and stays — on every screen — and only its marks change: the screen
   you are on is lit; a round in progress shows a dot, not a pressed button. */
function navBar() {
  let nav = document.getElementById('tabbar');
  if (staffMode()) { if (nav) nav.hidden = true; staffBar(); return; }
  { const sb = document.getElementById('staffbar'); if (sb) sb.hidden = true; }
  if (!S.login) { if (nav) nav.hidden = true; document.body.classList.remove('hasbar'); return; }
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'tabbar';
    nav.className = 'tabbar';
    nav.innerHTML = `<button id="toHome" class="tab"><span class="ti">🏠</span><span class="tl">Home</span></button>
      <button id="toRound" class="tab"><span class="ti">🩺</span><span class="tl">Round</span><span class="tdot" hidden></span></button>
      <button id="toTodo" class="tab"><span class="ti">☑</span><span class="tl">To do</span></button>
      <button id="toAlerts" class="tab"><span class="ti">🔔</span><span class="tl">Alerts</span><span class="tn" hidden></span></button>
      <button id="toMore" class="tab"><span class="ti">⋯</span><span class="tl">More</span></button>`;
    document.body.appendChild(nav);
    $('#toHome').onclick = () => { moreOpen = false; route('ward'); };
    $('#toTodo').onclick = () => route('todo');
    $('#toRound').onclick = () => { if (!S.round) { S.round = { at: Date.now(), idx: 0, e: {} }; keep(); } route('round'); };
    $('#toAlerts').onclick = () => route('alerts');
    $('#toMore').onclick = () => {
      if (view.name !== 'ward') { moreOpen = true; route('ward'); return; }
      moreOpen = !moreOpen; $('#morePanel').hidden = !moreOpen; if ($('#wardCards')) $('#wardCards').hidden = moreOpen; navBar();
      if (moreOpen) $('#morePanel').scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
  }
  { const r = document.getElementById('toRound'); if (r) r.hidden = staffMode(); }
  const cur = view.name === 'ward' ? (moreOpen ? 'toMore' : 'toHome') : { round: 'toRound', todo: 'toTodo', alerts: 'toAlerts' }[view.name] || (view.name === 'patient' ? 'toHome' : 'toMore');
  const n = todaysAlerts().length;
  const sig = `${cur}|${n}|${S.round ? 1 : 0}`;
  if (nav.dataset.sig === sig && !nav.hidden) return;          /* nothing on the bar changed: it is not touched */
  nav.dataset.sig = sig;
  if (nav.hidden) nav.hidden = false;
  if (!document.body.classList.contains('hasbar')) document.body.classList.add('hasbar');
  $$('.tab', nav).forEach((b) => { if (b.classList.contains('on') !== (b.id === cur)) b.classList.toggle('on', b.id === cur); });
  const tn = $('.tn', nav); tn.hidden = !n; tn.textContent = n || '';
  $('.tdot', nav).hidden = !S.round;
}
function wardWire() {
  if (staffMode()) {
    $('#goWards').onclick = () => { S = { login: null }; keep(); staffWards = null; route('swards'); };
    $('#wardQ').oninput = (e) => { wardQ = e.target.value; const q = txt(wardQ).toLowerCase(); $$('#wardCards .card').forEach((c) => { c.hidden = !!q && c.dataset.find.indexOf(q) < 0; }); };
    $$('[data-pid]').forEach((b) => { b.onclick = () => route('patient', b.dataset.pid); });
    return;
  }
  $('#signOut').onclick = signOut;
  $('#toAdmit').onclick = () => { moreOpen = false; route('admit'); };
  $('#toStaff').onclick = () => {
    if (S.dirty && !confirm('Some changes have not reached the ward yet. Switch to staff mode and lose them?')) return;
    setMode('staff');
    quietRunner();
    S = { login: null }; keep(); staffWards = null; moreOpen = false;
    toast('Staff mode: read only');
    route('swards');
  };
  /* the search hides the cards that do not match — no redraw, the box keeps its place */
  $('#wardQ').oninput = (e) => { wardQ = e.target.value; const q = txt(wardQ).toLowerCase(); $$('#wardCards .card').forEach((c) => { c.hidden = !!q && c.dataset.find.indexOf(q) < 0; }); };
  $$('[data-pid]').forEach((b) => { b.onclick = () => route('patient', b.dataset.pid); });
  $('#toBook').onclick = () => route('book');
  $('#toChemo').onclick = () => route('chemo');
  $('#toLabs').onclick = () => route('labs');
  $('#toPin').onclick = () => route('pin');
  if ($('#toFetch')) $('#toFetch').onclick = () => route('fetch');
  $('#askHis').onclick = askHis;
  $('#askPdfs').onclick = askPdfs;
}
/* ── TO DO, FOR EVERYONE ────────────────────────────────────────
 * 7 November 2026: "add a to do mode that shows to do list for all
 * patients on the phone app". Today's To do of every child, room by room —
 * what was typed and the chemotherapy due today or tomorrow (Ward.todoText,
 * the PC's own rule). A tap opens the child, to edit it there. */
/* 22 November 2026, Dr Boulos: "have the to do window add the option to add a to do, and check one as done, if so,
   the to do should have a tick to its right" — every child, each line tickable, and a box to add one */
function todoHtml() {
  const rows = patients().map((p) => { const d = Ward.dayOf(readWard(p.id), today()); return { p, d, t: Ward.todoText(p, d, today(), readWard(p.id)) }; });
  /* "remove the X" … staff mode: the list to read */
  const has = rows.filter((r) => txt(r.t)).length;
  return `${header('To do — everyone', true)}
    <div class="note">${has} of ${rows.length} children have something to do today. Tap a line to tick it done.</div>
    <div class="cards">${rows.map(({ p, d }) => `<div class="card todocard">
      <button class="top linkish" data-pid="${esc(p.id)}"><span class="room">${p.room ? esc(p.room) : '—'}</span><bdi class="nm">${esc(p.name)}</bdi></button>
      ${todoItemsHtml(p, d, today(), staffMode())}
    </div>`).join('') || '<p class="dim pad">No children on the ward.</p>'}</div>`;
}
function todoWire() {
  $('#goBack').onclick = () => route('ward');
  $$('[data-pid]').forEach((b) => { b.onclick = () => route('patient', b.dataset.pid); });
  if (!staffMode()) wireTodoItems();
}

/* ── SWIPING BETWEEN CHILDREN ─────────────────────────────────────
 * 17 November 2026, Dr Boulos: "add the side scroll thing to the main patient
 * data window too". One pager for the round and the child's page: what stays
 * still stays still (header, arrows, dots, the bar), and only the child's
 * page (`slide`) moves, with the next child's page beside it. Snap-carousel
 * motion from the Screenrove motion library (interior.dev, MIT): 1:1 with the
 * finger, the flick projected × 0.14 s, one child at a time, the ends resist,
 * a 300 ms strong ease-out. A swipe that starts in a box being typed in, a
 * list, or the sideways-scrolling lab trend is left to that box.
 * o: { view, slide, count, index, page(k) → HTML, light(k), settled(k) } */
function attachPager(o) {
  const { view: view0, slide, count, index: i } = o;
  if (!view0 || !slide) return () => {};
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const W = () => view0.clientWidth || window.innerWidth || 360;
  let ghost = null;
  let ghostFor = -1;
  let busyGo = false;
  const dropGhost = () => { if (ghost) { ghost.remove(); ghost = null; ghostFor = -1; } };
  const makeGhost = (k) => {
    if (ghostFor === k && ghost) return;
    dropGhost();
    ghost = document.createElement('div');
    ghost.className = 'rslide rghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.innerHTML = o.page(k);
    ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));     /* a picture of the page: no second box with the same id */
    view0.appendChild(ghost);
    ghostFor = k;
  };
  const place = (dx, ms) => {
    const t = ms ? `transform ${ms}ms ${EASE}` : 'none';
    slide.style.transition = t;
    slide.style.transform = dx ? `translate3d(${dx}px,0,0)` : '';
    if (ghost) { ghost.style.transition = t; ghost.style.transform = `translate3d(${dx + (ghostFor > i ? W() : -W())}px,0,0)`; }
  };
  const settle = (k) => {
    if (busyGo) return;
    busyGo = true;
    const a = document.activeElement;
    if (a && /^(TEXTAREA|INPUT)$/.test(a.tagName)) a.blur();
    if (o.light) o.light(k);
    place(k > i ? -W() : W(), 300);
    setTimeout(() => {
      slide.style.transition = 'none'; slide.style.transform = '';
      dropGhost();
      o.settled(k);
    }, 300);
  };
  const back = () => { place(0, 300); setTimeout(() => { dropGhost(); slide.style.transition = ''; }, 300); };
  const go = (k) => {
    if (k < 0 || k >= count || k === i) return;
    makeGhost(k);
    place(0, 0);
    requestAnimationFrame(() => requestAnimationFrame(() => settle(k)));
  };
  let sx = 0, sy = 0, lock = '', lastX = 0, lastT = 0, vx = 0;
  view0.ontouchstart = (ev) => {
    const tg = ev.target;
    if (ev.touches.length !== 1 || busyGo || (tg && tg.closest && tg.closest('textarea, input, select, .trendwrap, .hits, details.add'))) { lock = 'no'; return; }
    lock = '';
    const t = ev.touches[0]; sx = lastX = t.clientX; sy = t.clientY; lastT = Date.now(); vx = 0;
  };
  view0.ontouchmove = (ev) => {
    if (lock === 'no') return;
    const t = ev.touches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (!lock) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'no';
      if (lock === 'no') return;
    }
    if (ev.cancelable) ev.preventDefault();
    const now = Date.now();
    if (now > lastT) { vx = 0.7 * vx + 0.3 * ((t.clientX - lastX) / (now - lastT)); lastX = t.clientX; lastT = now; }
    const k = dx < 0 ? i + 1 : i - 1;
    if (k < 0 || k >= count) { dropGhost(); place(dx / 3, 0); return; }          /* the end of the ward: it resists */
    makeGhost(k);
    place(dx, 0);
  };
  view0.ontouchend = view0.ontouchcancel = (ev) => {
    if (lock !== 'x') { lock = ''; return; }
    lock = '';
    const dx = ev.changedTouches[0].clientX - sx;
    const projected = dx + vx * 140;                         /* where the flick would carry it */
    const k = dx < 0 ? i + 1 : i - 1;
    if (ghost && k >= 0 && k < count && Math.abs(projected) > W() / 2) settle(k);
    else back();
  };
  return go;
}

/* ── ROUNDING MODE ────────────────────────────────────────────────
 * 15 November 2026, Dr Boulos: "Let's add rounding mode to the phone. Where
 * I will add the clinical data and examination for the patients in the
 * early morning, and it will upload it to every patient at the end of the
 * round. Also, in the rounding mode, allow entries to the to-do list — if I
 * find a patient has productive cough and high-grade fever, I can add to the
 * to-do list: CT chest."
 * One child at a time, room by room. What is written is kept on the phone
 * (S.round, kept at every key, so a closed app loses nothing) and sent to no
 * one until "Finish the round": then each child's examination goes under
 * today's Clinically and the To do items under today's To do — added, never
 * over what is there — and everything is sent at once. */
const ROUND_TODO = ['CT chest', 'Chest X-ray', 'Blood culture', 'Urine culture', 'CBC', 'CRP', 'Echo', 'Abdominal US', 'Swab', 'Consult'];
const roundEntry = (pid) => { S.round.e[pid] = S.round.e[pid] || { clin: '', todo: [] }; return S.round.e[pid]; };
const roundHas = (e) => !!(e && (txt(e.clin) || (e.todo || []).length));
function roundCount() { return S.round ? Object.keys(S.round.e || {}).filter((k) => roundHas(S.round.e[k])).length : 0; }
/* 17 November 2026, Dr Boulos: "the dots in the ward/round mode that refer
   to which patient i am viewing should change without moving, and the name
   above and data below should slide from side to side smoothly". The screen
   is two parts: what stays still — the header, the arrows, the dots, the
   buttons — and the child's page, which slides. The motion follows the
   Screenrove motion library's snap carousel and pagination (interior.dev,
   MIT): the page follows the finger one to one, the flick's speed is
   projected (× 0.14 s) to decide, never more than one child at a time, the
   ends resist, and the snap is a strong ease-out of 300 ms. The dots never
   move; only which one is lit changes. */
function roundSlide(i) {
  const list = patients();
  const p = list[i];
  const e = roundEntry(p.id);
  const st = readWard(p.id);
  const d = Ward.dayOf(st, today());
  const lab = txt(d.labs);
  return `<div class="pt rpt">
      <div class="rhead"><bdi class="nm" id="rName">${esc(p.name)}</bdi><span class="room">${p.room ? esc(p.room) : '—'}</span></div>
      <div class="meta rmeta">${esc(Sheet.dayLabel(p, today()) || p.diagnosis || '')}</div>
      ${txt(st.summary) ? `<div class="sum" dir="auto">${esc(st.summary)}</div>` : ''}
      ${lab ? `<div class="labs">${Ward.redFlags(esc(Ward.tightCbc(lab))).replace(/\n/g, '<br>')}</div>` : '<div class="dim small">No labs today yet.</div>'}
      ${txt(d.clinically) ? `<details><summary class="dim small">Today's Clinically so far</summary><div class="pre" dir="auto">${esc(d.clinically)}</div></details>` : ''}
    </div>
    <section><h3>Examination &amp; clinical</h3>
      <textarea id="rClin" dir="auto" rows="5" placeholder="Afebrile, chest clear, abdomen soft…">${esc(e.clin)}</textarea></section>
    <section><h3>Add to To do</h3>
      ${txt(d.todo) ? `<div class="dim small">Already: ${esc(txt(d.todo).split('\n').join(' · '))}</div>` : ''}
      <ul class="list rtodo">${(e.todo || []).map((t, k) => `<li><span dir="auto">☐ ${esc(t)}</span> <button class="x" data-rdel="${k}" title="Remove">✕</button></li>`).join('')}</ul>
      <div class="raddrow"><input id="rTodo" dir="auto" placeholder="e.g. CT chest" autocomplete="off"><button id="rAdd" class="primary">Add</button></div>
      <div class="bdg rquick">${ROUND_TODO.map((t) => `<button class="b b-soon" data-rquick="${esc(t)}">${esc(t)}</button>`).join('')}</div></section>`;
}
function roundHtml() {
  if (!S.round) return `${header('Rounding mode', true)}<p class="dim pad">No round in progress.</p>`;
  const list = patients();
  if (!list.length) return `${header('Rounding mode', true)}<p class="dim pad">No children on the ward.</p>`;
  const i = Math.min(Math.max(0, S.round.idx || 0), list.length - 1);
  return `${header(`Round · <span id="rCount">${i + 1}</span> of ${list.length}`, true)}
    <div class="rbar">
      <button class="rarrow" id="rPrevTop" ${i === 0 ? 'disabled' : ''} aria-label="Previous child">‹</button>
      <div class="rdots" id="rDots" role="tablist">${list.map((x, k) => `<i class="${k === i ? 'cur' : ''}${roundHas(S.round.e[x.id]) ? ' done' : ''}"></i>`).join('')}</div>
      <button class="rarrow" id="rNextTop" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Next child">›</button>
    </div>
    <select id="rJump" class="rjump" aria-label="Go to a child">${list.map((x, k) => `<option value="${k}"${k === i ? ' selected' : ''}>${roundHas(S.round.e[x.id]) ? '✓ ' : ''}${esc(x.room || '—')} · ${esc(x.name)}</option>`).join('')}</select>
    <div class="rview" id="rView"><div class="rslide" id="rSlide">${roundSlide(i)}</div></div>
    <div class="actions rbtns">
      <button id="rPrev" ${i === 0 ? 'disabled' : ''}>‹ Previous</button>
      <button id="rNext" ${i === list.length - 1 ? 'disabled' : ''}>Next ›</button>
    </div>
    <div class="actions"><button id="rFinish" class="primary wide">✓ Finish the round — send ${roundCount()} child(ren)</button>
      <button id="rDrop" class="wide">Discard this round</button></div>`;
}
function roundWire() {
  $('#goBack').onclick = () => route('ward');
  if (!S.round) return;
  const list = patients();
  if (!list.length) return;
  const i = Math.min(Math.max(0, S.round.idx || 0), list.length - 1);
  const p = list[i];
  const e = roundEntry(p.id);
  /* the dots stay where they are; only the lit one changes */
  const lightDot = (k) => {
    $$('#rDots i').forEach((d, n) => d.classList.toggle('cur', n === k));
    if ($('#rCount')) $('#rCount').textContent = String(k + 1);
    $('#rPrevTop').disabled = k === 0;
    $('#rNextTop').disabled = k === list.length - 1;
  };
  const go = attachPager({ view: $('#rView'), slide: $('#rSlide'), count: list.length, index: i, page: roundSlide, light: lightDot,
    settled: (k) => {
      S.round.idx = k; keep();
      render();                                              /* only what changed is swapped: the dots stay */
      const top = $('#rView');
      if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' });
    } });
  $('#rJump').onchange = (ev) => go(+ev.target.value);
  $('#rPrev').onclick = () => go(i - 1);
  $('#rNext').onclick = () => go(i + 1);
  $('#rPrevTop').onclick = () => go(i - 1);
  $('#rNextTop').onclick = () => go(i + 1);
  $('#rName').onclick = () => { const j = $('#rJump'); j.classList.toggle('open'); if (j.classList.contains('open')) j.focus(); };
  $('#rClin').oninput = (ev) => { e.clin = ev.target.value; keepSoon(); };
  const addTodo = (t) => {
    const v = txt(t);
    if (!v) return;
    if ((e.todo || []).indexOf(v) < 0) e.todo = (e.todo || []).concat([v]);
    keep(); drawnView = ''; render(); toast(`${v} — added for ${p.name}`);
  };
  $('#rAdd').onclick = () => addTodo($('#rTodo').value);
  $('#rTodo').onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addTodo($('#rTodo').value); } };
  $$('[data-rquick]').forEach((b) => { b.onclick = () => addTodo(b.dataset.rquick); });
  $$('[data-rdel]').forEach((b) => { b.onclick = () => { e.todo.splice(+b.dataset.rdel, 1); keep(); drawnView = ''; render(); }; });
  $('#rDrop').onclick = () => {
    if (!confirm(`Discard this round? What you wrote for ${roundCount()} child(ren) is not sent.`)) return;
    S.round = null; keep(); route('ward');
  };
  $('#rFinish').onclick = () => finishRound();
}
/* the round, added to every child: the examination under today's
   Clinically, each To do item under today's To do (one already there is
   not written twice) — then sent at once */
function finishRound() {
  flushTyping();
  if (!S.round) return;
  const iso = today();
  const done = [];
  Object.keys(S.round.e || {}).forEach((pid) => {
    const e = S.round.e[pid];
    if (!roundHas(e)) return;
    if (!patients().some((p) => String(p.id) === String(pid))) return;
    const st = editWard(pid);
    if (Ward.carryTodo) Ward.carryTodo(st, iso);          /* yesterday's To do first, then the round's */
    const d = Ward.dayOf(st, iso);
    const clin = txt(e.clin);
    if (clin) d.clinically = txt(d.clinically) ? `${String(d.clinically).replace(/\s+$/, '')}\n${clin}` : clin;
    const have = txt(d.todo).split('\n').map((l) => txt(l).toLowerCase());
    const add = (e.todo || []).filter((t) => have.indexOf(txt(t).toLowerCase()) < 0);
    if (add.length) d.todo = txt(d.todo) ? `${String(d.todo).replace(/\s+$/, '')}\n${add.join('\n')}` : add.join('\n');
    st.days[iso] = d;
    done.push(pid);
  });
  if (!done.length) { toast('Nothing written in this round'); return; }
  S.round = null;
  changed();
  clearTimeout(pushTimer);
  upload();
  toast(`Round sent — ${done.length} child(ren). Each child's page shows when the main PC has it.`);
  route('ward');
}

/* ── ADMITTING A CHILD FROM THE PHONE ──────────────────────────────
 * 16 November 2026, Dr Boulos: "add patient admission functionality to the
 * android app, from the ward". The children the last HIS fetch found on the
 * ward and not on the handover are offered first — a tap fills the form
 * (name, MRN, sex, date of birth, as the PC read them); or the form is typed.
 * Name and MRN are needed; the rest can follow on the PC. The new child goes
 * to the main PC as a note, like everything else, and is on the phone at
 * once. A child discharged before, with the same MRN, is admitted again
 * (the same record); one already on the ward is not admitted twice. */
let admitDraft = null;
const sameMrnP = (a, b) => txt(a).replace(/\D/g, '') !== '' && txt(a).replace(/\D/g, '') === txt(b).replace(/\D/g, '');
function admitHtml() {
  const d = admitDraft = admitDraft || { name: '', mrn: '', room: '', diagnosis: '', sex: '', dobDay: '', dobMonth: '', dobYear: '', weight: '', height: '' };
  const fresh = ((S.fetch && S.fetch.moves && S.fetch.moves.fresh) || []).filter((f) => !patients().some((p) => sameMrnP(p.mrn, f.mrn)));
  const yr = new Date().getFullYear();
  const opt = (v, cur, label) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${label == null ? v : label}</option>`;
  return `${header('Admit a patient', true)}
    ${fresh.length ? `<section><h3>New on the ward in the HIS</h3>
      <div class="dim small">From ${esc((S.fetch && S.fetch.host) || 'a PC')}'s last fetch. Tap one to fill the form.</div>
      <ul class="list">${fresh.map((f, k) => `<li><button class="mrow" data-fresh="${k}"><span class="ti">＋</span><span><b><bdi>${esc(f.name)}</bdi></b><small>MRN ${esc(f.mrn)}</small></span></button></li>`).join('')}</ul></section>`
    : `<div class="note">No new children from the HIS yet — More → Fetch from HIS lists them here; or type the child below.</div>`}
    <section class="form"><h3>The child</h3>
      <label>Full name (Arabic) *<input id="aName" dir="auto" value="${esc(d.name)}" autocomplete="off"></label>
      <label>MRN *<input id="aMrn" inputmode="numeric" value="${esc(d.mrn)}" autocomplete="off"></label>
      <div class="two"><label>Room<select id="aRoom">${opt('', d.room, '—')}${Array.from({ length: 12 }, (_, n) => opt(n + 1, d.room)).join('')}</select></label>
        <label>Sex<select id="aSex">${opt('', d.sex, '—')}${opt('M', d.sex, 'Male')}${opt('F', d.sex, 'Female')}</select></label></div>
      <label>Diagnosis<input id="aDx" dir="auto" value="${esc(d.diagnosis)}" autocomplete="off"></label>
      <div class="three"><label>Born — day<input id="aDobD" inputmode="numeric" value="${esc(d.dobDay)}" placeholder="optional"></label>
        <label>month<select id="aDobM">${opt('', d.dobMonth, '—')}${Array.from({ length: 12 }, (_, n) => opt(n + 1, d.dobMonth)).join('')}</select></label>
        <label>year<select id="aDobY">${opt('', d.dobYear, '—')}${Array.from({ length: 31 }, (_, n) => opt(yr - n, d.dobYear)).join('')}</select></label></div>
      <div class="two"><label>Weight (kg)<input id="aWt" inputmode="decimal" value="${esc(d.weight)}"></label>
        <label>Height (cm)<input id="aHt" inputmode="decimal" value="${esc(d.height)}"></label></div>
      <p class="dim small">Admitted today. The cycle, the orders and anything missing are completed on the PC.</p>
      <p class="err" id="aErr"></p>
      <button class="primary big" id="aSave">Admit to ${esc(S.login.ward)}</button>
    </section>`;
}
function admitWire() {
  $('#goBack').onclick = () => { admitDraft = null; route('ward'); };
  const d = admitDraft;
  const bind = (id, key) => { const el = $(id); el.oninput = el.onchange = () => { d[key] = el.value; }; };
  [['#aName', 'name'], ['#aMrn', 'mrn'], ['#aRoom', 'room'], ['#aSex', 'sex'], ['#aDx', 'diagnosis'], ['#aDobD', 'dobDay'], ['#aDobM', 'dobMonth'], ['#aDobY', 'dobYear'], ['#aWt', 'weight'], ['#aHt', 'height']]
    .forEach(([id, key]) => bind(id, key));
  const fresh = ((S.fetch && S.fetch.moves && S.fetch.moves.fresh) || []).filter((f) => !patients().some((p) => sameMrnP(p.mrn, f.mrn)));
  $$('[data-fresh]').forEach((b) => { b.onclick = () => {
    const f = fresh[+b.dataset.fresh];
    if (!f) return;
    Object.assign(d, { name: f.name || '', mrn: f.mrn || '', sex: f.sex || d.sex, dobDay: f.dobDay || '', dobMonth: f.dobMonth || '', dobYear: f.dobYear || '' });
    drawnView = ''; render(); $('#aName').scrollIntoView({ block: 'center' }); toast('Filled from the HIS — check, add the room, then Admit');
  }; });
  $('#aSave').onclick = () => {
    const r = admitChild(d);
    if (!r.ok) { $('#aErr').textContent = r.reason; return; }
    admitDraft = null;
    toast(r.again ? `${r.p.name} admitted again` : `${r.p.name} admitted — sent to the main PC`);
    route('patient', r.p.id);
  };
}
/* the new child into the phone's copy (and so, as a note, to the main PC) */
function admitChild(d) {
  const name = txt(d.name), mrn = txt(d.mrn);
  if (!name) return { ok: false, reason: 'The name is needed.' };
  if (!mrn) return { ok: false, reason: 'The MRN is needed.' };
  const all = S.data.patients = S.data.patients || [];
  if (all.some((p) => !p.discharged && sameMrnP(p.mrn, mrn))) return { ok: false, reason: 'A child with this MRN is already on the ward.' };
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
  const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
  const fields = { name, mrn, diagnosis: txt(d.diagnosis), sex: txt(d.sex), dobMonth: int(d.dobMonth), dobYear: int(d.dobYear), dobDay: int(d.dobDay),
    weight: num(d.weight), height: num(d.height), room: txt(d.room), admissionDate: today(), discharged: false };
  const old = all.find((p) => p.discharged && sameMrnP(p.mrn, mrn));
  let p;
  if (old) {
    /* the same child back: the record kept, what was typed now over what it had */
    Object.keys(fields).forEach((k) => { if (fields[k] !== '' && fields[k] != null) old[k] = fields[k]; });
    old.discharged = false;
    p = old;
  } else {
    p = Object.assign({ id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, cycleDay: 1, cycleName: '', cycleStartDate: today() }, fields);
    all.push(p);
  }
  changed();
  clearTimeout(pushTimer);
  upload();
  return { ok: true, p, again: !!old };
}

/* ── CHEMO, THE WHOLE WARD ────────────────────────────────────────
 * 15 November 2026, Dr Boulos: "today's chemo across the ward" — who gets
 * what today and tomorrow, room by room, from each child's schedule (the
 * same lines as the ward board: Schedule.boardLines, in English, no doses).
 * A tap opens the child. */
function wardChemo(iso) {
  const strip = (t) => t.replace(/\s+today$/i, '');
  return patients().map((p) => ({ p, items: Schedule.boardLines(p, iso).filter((l) => l.kind === 'today').map((l) => strip(l.text)) }))
    .filter((r) => r.items.length);
}
function chemoHtml() {
  const d0 = today();
  const d1 = Ward.addDays(d0, 1);
  const block = (title, rows, day) => `<h3 class="sec">${title} <span class="dim">(${rows.length})</span></h3>
    <div class="cards">${rows.map(({ p, items }) => `<button class="card" data-pid="${esc(p.id)}">
      <div class="top"><span class="room">${p.room ? esc(p.room) : '—'}</span><bdi class="nm">${esc(p.name)}</bdi></div>
      <div class="meta">${esc(Sheet.dayLabel(p, day) || p.cycleName || p.diagnosis || '')}</div>
      <div class="bdg">${items.map((t) => `<span class="b b-today" dir="auto">${esc(t)}</span>`).join('')}</div>
    </button>`).join('') || '<p class="dim pad">Nothing scheduled.</p>'}</div>`;
  return `${header('Chemo recap', true)}
    <div class="note">From each child's schedule, as on the ward board — no doses here; they are on the doctor's order.</div>
    ${block(`Today · ${esc(Ward.fullDate(d0))}`, wardChemo(d0), d0)}
    ${block(`Tomorrow · ${esc(Ward.fullDate(d1))}`, wardChemo(d1), d1)}`;
}
function chemoWire() {
  $('#goBack').onclick = () => route('ward');
  $$('[data-pid]').forEach((b) => { b.onclick = () => route('patient', b.dataset.pid); });
}

/* ── REQUEST LABS ──────────────────────────────────────────────────
 * 11 November 2026, Dr Boulos: "replace suggested labs, with request labs,
 * and show suggestions as already ticked, and allow me to tick what i
 * want". Every child, the whole lab menu (Ward.LAB_MENU, the PC's own);
 * what the rules suggest today (Ward.labSuggestions) is ticked already,
 * with its reason; the rest is there to tick. What is approved waits for
 * the PC to order it, as before. */
/* 12 November 2026: "give him a choice whether to request labs now or
   tomorrow" — tomorrow at any hour; ordered from a PC (Order labs → Order
   in HIS), at once, with that day as the HIS Schedule Date (13 November 2026) */
let labsDay = 'today';
/* 12 November 2026: "every once in a while it collapses automatically and
   the labs are not registered. Make all the drop-down menus always open and
   allow me to check everything I need before clicking request labs." The
   screen is redrawn whenever the ward's file changes (look, every minute):
   every child's list is always open now, and each tick is kept here as it
   is made, so a redraw shows it still ticked; the button takes them all. */
const labsDraft = {};
const labsIso = () => (labsDay === 'tomorrow' ? Ward.nextWorkDay(today()) : today());
function labsHtml() {
  const iso = labsIso();
  const tmr = iso !== today();
  const rows = patients().map((p) => {
    const sug = Ward.labSuggestions(p, readWard(p.id), iso);
    const ok = Ward.toBook(S.data, iso)[p.id] || [];
    return { p, sug, ok };
  });
  const item = (p, m, sug, ok) => {
    const o1 = ok.find((o) => o.key === m.key);
    if (o1 && o1.ordered) return `<div class="meta labdone">✓ ordered in the HIS: <b>${esc(m.label)}</b></div>`;
    if (o1) return `<div class="meta${o1.failed ? ' labfail' : ''}">${o1.failed ? `✗ not ordered (${esc(o1.failed)})` : '⏳ requested, not ordered yet'}: <b>${esc(m.label)}</b> <button class="x" data-sgun="${esc(p.id)}|${esc(m.key)}">✕</button></div>`;
    const s = sug.find((x) => x.key === m.key);
    const k = `${iso}|${p.id}|${m.key}`;
    const on = k in labsDraft ? labsDraft[k] : !!s;
    return `<label class="chk"><input type="checkbox" data-sg="${esc(p.id)}|${esc(m.key)}"${on ? ' checked' : ''}>
      <span>${esc(m.label)}${s ? ` <span class="dim small">— suggested: ${esc(s.why)}</span>` : ''}</span></label>`;
  };
  return `${header('Request labs', true)}
    <div class="actions seg">
      <button id="lbToday" class="${tmr ? '' : 'primary'}">Now — today</button>
      <button id="lbTomorrow" class="${tmr ? 'primary' : ''}">${esc(Ward.nextWorkLabel(today()))}</button>
    </div>
    ${tmr ? '<div class="note ok">Requesting for <b>tomorrow</b> — ordered from a ward PC (Order labs → next working day → Order in HIS), which sets that day as the HIS Schedule Date; the nurses\' paper is printed from there too (Print for nursing).</div>' : ''}
    ${labsStatusHtml(iso, rows)}
    <div class="lbtools"><button id="lbNone" class="sm">Untick all</button><button id="lbSug" class="sm">Tick the suggested</button>
      <span class="dim small" id="lbCount"></span></div>
    <div class="cards">${rows.map(({ p, sug, ok }) => `<div class="card">
      <div class="top"><span class="room">${p.room ? esc(p.room) : '—'}</span><bdi class="nm">${esc(p.name)}</bdi>
        ${sug.length ? `<span class="b b-warn">${sug.length} suggested</span>` : ''}${ok.length ? `<span class="b b-ok">${ok.length} requested</span>` : ''}</div>
      ${Ward.LAB_MENU.map((m) => item(p, m, sug, ok)).join('')}
    </div>`).join('') || '<p class="dim pad">No children on the ward.</p>'}</div>
    <div class="labs-pad"></div><div class="labsgo"><button class="primary big" id="sgGo">Order the ticked labs in the HIS</button></div>`;
}
/* 16 November 2026, Dr Boulos: "i want the phone to order labs … MAKE SURE THE
   LABS ARE ORDERED FROM THE PHONE TO HIS". What the last order from this
   phone came to, child by child, and what is still waiting. */
function labsStatusHtml(iso, rows) {
  const waiting = rows.reduce((n, r) => n + r.ok.filter((x) => !x.ordered).length, 0);
  const last = (S.requests || []).filter((r) => r.kind === 'labs' && (!r.iso || r.iso === iso)).slice(-1)[0];
  const name = (pid) => { const p = (S.data.patients || []).find((x) => String(x.id) === String(pid)); return p ? p.name : 'a child'; };
  let out = '';
  if (last && last.status === 'pending' && Date.now() - last.at < 30 * 60 * 1000) out += `<div class="note">⏳ ${esc(last.host || 'The PC')} is ordering in the HIS — this takes a minute or two per child. The result appears here.</div>`;
  else if (last && last.status === 'done' && (last.results || []).length) {
    const good = last.results.filter((r) => r.status === 'ordered');
    const bad = last.results.filter((r) => r.status !== 'ordered');
    out += `<div class="note ${bad.length ? 'warn' : 'ok'}">${good.length ? `✓ Ordered in the HIS for ${good.length} child(ren)${last.host ? ` by ${esc(last.host)}` : ''}.` : ''}
      ${bad.map((r) => `<br>✗ <bdi>${esc(name(r.pid))}</bdi>: ${esc(r.reason || 'not ordered')}`).join('')}</div>`;
  } else if (last && (last.status === 'failed' || last.status === 'expired')) out += `<div class="note warn">✗ The labs were NOT ordered: ${esc(last.reason || 'no PC of the ward answered — open the app on the main PC, signed in to the HIS, then press Order again')}</div>`;
  if (waiting && !(last && last.status === 'pending')) out += `<div class="note warn">${waiting} requested lab(s) are not ordered in the HIS yet — press <b>Order</b> below to send them.</div>`;
  return out;
}
/* the request to a PC of the ward: order what is requested for this day */
async function askLabs(iso) {
  const req = Object.assign(PhoneLink.newRequest('labs', Date.now(), DEVICE.name), { iso });
  const st = store();
  const r = await st.update(wardKey(), (entry) => (entry && entry.account && entry.account.hash === S.login.hash
    ? { entry: PhoneLink.addRequest(entry, req) } : { error: 'signed-out' }));
  if (!r || r.error) throw new Error('Could not reach the ward file — try again.');
  S.requests = r.entry.requests; keep();
  await google().drive.setProps(await st.locate(), { [K().rq]: req.id });
  const done = (x) => {
    const res = (x && x.results) || [];
    const good = res.filter((y) => y.status === 'ordered').length;
    if (x && x.status === 'done') sheet(`<div class="sheeticon ${good === res.length ? 'ok' : 'warn'}">${good === res.length ? '✓' : '!'}</div><h3>${good} of ${res.length} child(ren) ordered in the HIS</h3>
      <p>${good === res.length ? 'The HIS lab page shows every order.' : 'Open Request labs to see which were not ordered, and why.'}</p>`);
    else sheet(`<div class="sheeticon warn">!</div><h3>The labs were NOT ordered</h3><p>${esc((x && x.reason) || 'No PC of the ward answered. Open the app on the main PC, signed in to the HIS, then order again.')}</p>`);
    if (view.name === 'labs') { drawnView = ''; render(); }
  };
  waitFor(req.id, done, done, 110);
  return req;
}
function labsWire() {
  const iso = labsIso();
  $('#goBack').onclick = () => route('ward');
  $$('[data-sg]').forEach((c) => { c.onchange = () => { labsDraft[`${iso}|${c.dataset.sg}`] = c.checked; }; });
  /* 16 November 2026: "add untick all in labs in mobile app" */
  const count = () => { const n = $$('[data-sg]').filter((c) => c.checked).length; $('#lbCount').textContent = `${n} ticked`; };
  $$('[data-sg]').forEach((c) => { const f0 = c.onchange; c.onchange = () => { if (f0) f0(); count(); }; });
  count();
  $('#lbNone').onclick = () => { $$('[data-sg]').forEach((c) => { c.checked = false; labsDraft[`${iso}|${c.dataset.sg}`] = false; }); count(); };
  $('#lbSug').onclick = () => { Object.keys(labsDraft).forEach((k) => { if (k.indexOf(`${iso}|`) === 0) delete labsDraft[k]; }); drawnView = ''; render(); };
  $('#lbToday').onclick = () => { labsDay = 'today'; render(); };
  $('#lbTomorrow').onclick = () => { labsDay = 'tomorrow'; render(); };
  $('#sgGo').onclick = () => {
    let n = 0;
    patients().forEach((p) => {
      const sug = Ward.labSuggestions(p, readWard(p.id), iso);
      const picked = Ward.LAB_MENU.filter((m) => {
        const c = $(`[data-sg="${p.id}|${m.key}"]`);
        const k = `${iso}|${p.id}|${m.key}`;
        return c ? c.checked : !!labsDraft[k];
      })
        .map((m) => { const s = sug.find((x) => x.key === m.key); return { key: m.key, label: m.label, why: s ? s.why : 'requested' }; });
      if (picked.length) n += Ward.approveLabs(S.data, iso, p.id, picked);
    });
    Object.keys(labsDraft).forEach((k) => { if (k.indexOf(`${iso}|`) === 0) delete labsDraft[k]; });
    /* requested before and still not ordered: Order sends those too */
    const stillWaiting = patients().reduce((k, p) => k + (Ward.toBook(S.data, iso)[p.id] || []).filter((x) => !x.ordered).length, 0);
    if (!n && !stillWaiting) { toast('Nothing ticked'); return; }
    if (!(S.pc && S.pc.online) && !confirm('No computer of the ward is on right now, so nothing can be ordered in the HIS yet. Keep the request? It is ordered when you press Order again with a PC on.')) return;
    /* 13 November 2026: "a confirmation message for booking labs" — said once
       the ward file has them, read back */
    const when = iso === today() ? 'today' : 'tomorrow';
    changed();
    clearTimeout(pushTimer);
    render();
    sheet(`<div class="sheeticon">⏳</div><h3>Sending the lab order for ${when}…</h3>`, false);
    push().then(() => askLabs(iso)).then(() => {
      syncBadge();
      const pc = S.main && S.main.online ? S.main.host : S.pc && S.pc.online ? S.pc.host : '';
      sheet(pc ? `<div class="sheeticon ok">✓</div><h3>Sent — ${esc(pc)} is ordering in the HIS</h3>
        <p>It orders each child and checks the HIS lab page shows the order. This takes a minute or two per child; the result appears here and on Request labs.</p>`
        : `<div class="sheeticon warn">!</div><h3>Saved — not ordered yet</h3><p>No computer of the ward is on. Open the app on the main PC (signed in to the HIS) and press Order again.</p>`);
      if (view.name === 'labs') { drawnView = ''; render(); }
    }).catch((e) => {
      syncBadge(e);
      sheet(`<div class="sheeticon warn">!</div><h3>Saved on the phone, not sent yet</h3><p>${esc(offline(e) ? 'No internet — it is sent by itself when the phone is back online.' : e.message)}</p>`);
      upload();
    });
  };
  $$('[data-sgun]').forEach((b) => { b.onclick = () => {
    const [pid, key] = b.dataset.sgun.split('|');
    Ward.unapproveLab(S.data, iso, pid, key);
    changed(); render();
  }; });
}

/* ── SIGN THE MAIN PC IN ─────────────────────────────────────────
 * 13 November 2026, Dr Boulos: "allow phone to enter the pin for the
 * credentials and log the PC app in". The PIN is encrypted here with the
 * main PC's public key (RSA-OAEP, the browser's own crypto) — only that PC
 * can read it — and sent as a request; the PC unlocks the saved HIS login
 * with it and answers. */
function b64(buf) { let s = ''; new Uint8Array(buf).forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); }
function unb64(t) { const bin = atob(t); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
async function sealPin(name, pin) {
  if (!S.pinKey) throw new Error('The main PC has not published its key yet — open the app on the main PC and try again in two minutes.');
  const key = await crypto.subtle.importKey('spki', unb64(S.pinKey), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const data = new TextEncoder().encode(JSON.stringify({ name, pin, at: Date.now() }));
  return b64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, data));
}
function pinHtml() {
  const names = S.physicians || [];
  return `${header('Sign the main PC in', true)}
    <div class="form pad">
      <div class="note">Your saved HIS login is opened on the main PC${S.main && S.main.host ? ` (${esc(S.main.host)})` : ''} with your PIN.
        The PIN is locked here so that only the main PC can read it, and it is deleted from the ward file once used.</div>
      ${S.main && S.main.online ? '' : '<div class="note warn">The main PC is not on right now — it answers when it is.</div>'}
      <label>Physician
        <select id="pnName">${names.length ? names.map((n) => `<option>${esc(n)}</option>`).join('') : '<option value="">— no saved logins —</option>'}</select></label>
      <label>PIN <input id="pnPin" type="password" inputmode="numeric" autocomplete="off" maxlength="12"></label>
      <div class="err" id="pnErr"></div>
      <button class="primary big" id="pnGo">Sign in</button>
    </div>`;
}
function pinWire() {
  $('#goBack').onclick = () => route('ward');
  $('#pnGo').onclick = async () => {
    const name = $('#pnName').value;
    const pin = $('#pnPin').value;
    if (!name) { $('#pnErr').textContent = 'No physician has saved an HIS login yet (on a PC: Calibrate → HIS login).'; return; }
    if (pin.length < 4) { $('#pnErr').textContent = 'Type your PIN.'; return; }
    $('#pnGo').disabled = true;
    try {
      const ct = await sealPin(name, pin);
      $('#pnPin').value = '';
      const req = Object.assign(PhoneLink.newRequest('signin', Date.now(), 'phone'), { ct });
      const st = store();
      const r = await withLoading(st.update(wardKey(), (entry) => (entry && entry.account && entry.account.hash === S.login.hash
        ? { entry: PhoneLink.addRequest(entry, req) } : { error: 'signed-out' })));
      if (!r || r.error) throw new Error('Could not reach the ward file — try again.');
      S.requests = r.entry.requests; keep();
      await google().drive.setProps(await st.locate(), { [K().rq]: req.id });
      sheet(`<div class="sheeticon">⏳</div><h3>Sent to the main PC</h3><p>Waiting for it to sign in…</p>`, false);
      waitFor(req.id, async (x) => { sheet(`<div class="sheeticon ok">✓</div><h3>${esc(x.reason || 'Signed in')}</h3><p>The main PC uses your HIS login until someone signs it out there.</p>`); route('ward'); },
        (x) => sheet(`<div class="sheeticon warn">!</div><h3>Not signed in</h3><p>${esc((x && x.reason) || 'No answer from the main PC.')}</p>`));
    } catch (e) { $('#pnErr').textContent = offline(e) ? 'No internet' : e.message; }
    if ($('#pnGo')) $('#pnGo').disabled = false;
  };
}
/* a message that sits over the screen until it is closed */
function sheet(html, closable) {
  let el = document.getElementById('sheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sheet';
    el.className = 'sheetback';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="sheet">${html}${closable === 'none' ? '' : closable === false ? '<div class="spin"></div>' : '<button class="primary big" id="sheetOk">OK</button>'}</div>`;
  el.hidden = false;
  const ok = document.getElementById('sheetOk');
  if (ok) ok.onclick = () => { el.hidden = true; };
}

/* ── THE PHONE UPDATES ITSELF ───────────────────────────────────────
 * 13 November 2026, Dr Boulos: "I want to add auto updates to the Android
 * app." Each build puts its APK in NCI ORDERS ("NCI Orders phone.apk") with
 * its number and SHA-256 on the file. On opening and every six hours the
 * phone looks; a newer build is downloaded and its fingerprint checked; then,
 * as on the PC, two minutes to cancel, and Android's installer opens on it
 * (Android asks for the one tap, "Update", itself — and the very first time,
 * to allow installing apps from NCI Orders). Cancelled, it asks again at the
 * next look. */
const PHONE_APK = 'NCI Orders phone.apk';
const UPDATE_WAIT_S = 120;
let updLooking = false;
function apkInstaller() {
  const C = window.Capacitor;
  if (!(C && C.isNativePlatform && C.isNativePlatform())) return null;
  return C.registerPlugin ? C.registerPlugin('ApkInstaller') : (C.Plugins && C.Plugins.ApkInstaller);
}
async function sha256Hex(u8) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
  return Array.from(h).map((x) => x.toString(16).padStart(2, '0')).join('');
}
/* what the look found: { state: 'ready' | 'newest' | 'uploading' | 'busy' | 'none' | 'error', latest, why } */
async function checkPhoneUpdate(now) {
  const mine = Number(window.NCI_PHONE_BUILD) || 0;
  const AI = apkInstaller();
  if (!AI || !mine) return { state: 'none' };
  if (updLooking) return { state: 'busy' };
  updLooking = true;
  try {
    const f = await google().drive.find(FOLDER, PHONE_APK);
    if (!f) return { state: 'uploading' };
    const meta = await google().drive.meta(f.id);
    const props = meta.properties || {};
    const latest = Number(props.build) || 0;
    if (!(latest > mine)) return { state: 'newest', latest: mine };
    /* by itself, only a build that has been the newest for three hours: a
       run of builds is one update (CloudSync.settled) */
    if (now !== true && !CloudSync.settled(meta.modifiedTime)) return { state: 'waiting', latest };
    if (!props.sha256) return { state: 'uploading', latest };
    const b64s = await withLoading(google().drive.bytes(f.id));
    const u8 = unb64(b64s);
    if ((await sha256Hex(u8)) !== props.sha256) return { state: 'uploading', latest };   /* still uploading, or damaged: next look */
    const C = window.Capacitor;
    const FS = C.registerPlugin ? C.registerPlugin('Filesystem') : C.Plugins.Filesystem;
    const w = await FS.writeFile({ path: 'nci-orders-update.apk', data: b64s, directory: 'CACHE' });
    updateCountdown(latest, w.uri);
    return { state: 'ready', latest };
  } catch (e) { return { state: 'error', why: e.message || String(e) }; } finally { updLooking = false; }
}
/* the button beside the build: Android looks for its newer app; the web
   copy loads its newest page */
async function manualUpdate(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  const done = () => { if (btn) { btn.disabled = false; btn.textContent = 'Check for updates'; } };
  try {
    if (WEB) {
      const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      const latest = r.ok ? Number((await r.json()).build) || 0 : 0;
      if (latest && latest > MINE) { toast(`Loading web build ${latest}…`); location.reload(); return; }
      toast(latest ? `Up to date — web build ${MINE || latest} is the newest` : 'Could not reach the web copy\'s server — try again');
      return;
    }
    const r = await checkPhoneUpdate(true);
    toast({ ready: `Build ${r.latest} is ready — it installs in two minutes unless you cancel`,
      newest: `Up to date — build ${r.latest} is the newest`,
      uploading: 'The newest build is still being uploaded — try again in a few minutes',
      busy: 'Already checking…',
      none: 'This copy has no build number, so it does not update itself',
      error: `Could not check for updates: ${r.why || ''}` }[r.state] || 'Could not check for updates');
  } catch (e) { toast(`Could not check for updates: ${e.message || e}`); } finally { done(); }
}
function updateCountdown(build, uri) {
  let left = UPDATE_WAIT_S;
  let timer = null;
  const mmss = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  const install = async () => {
    clearInterval(timer);
    const AI = apkInstaller();
    try {
      const can = await AI.canInstall();
      if (!can.allowed) {
        sheet(`<div class="sheeticon warn">!</div><h3>Allow updates from NCI Orders</h3>
          <p>Once only: Android asks to allow NCI Orders to install apps. Turn it on, come back, and press Install.</p>
          <button class="big" id="upSet">Open the setting</button><button class="primary big" id="upGo" style="margin-top:8px">Install</button>`, 'none');
        document.getElementById('upSet').onclick = () => AI.openSettings();
        document.getElementById('upGo').onclick = install;
        return;
      }
      document.getElementById('sheet').hidden = true;
      await AI.install({ path: uri });
    } catch (e) { sheet(`<div class="sheeticon warn">!</div><h3>The update could not start</h3><p>${esc(e.message || String(e))}</p>`); }
  };
  sheet(`<div class="sheeticon">⬆</div><h3>A new version (build ${build}) is ready</h3>
    <p>It installs in <b id="upLeft">${mmss(left)}</b> — Android then asks you to tap Update.</p>
    <button class="primary big" id="upNow">Install now</button><button class="big" id="upLater" style="margin-top:8px">Cancel</button>`, 'none');
  document.getElementById('upNow').onclick = install;
  document.getElementById('upLater').onclick = () => { clearInterval(timer); document.getElementById('sheet').hidden = true; toast('Update cancelled — asked again at the next check'); };
  timer = setInterval(() => {
    left -= 1;
    const el = document.getElementById('upLeft');
    if (el) el.textContent = mmss(left);
    if (left <= 0) install();
  }, 1000);
}

/* ── ALERTS ─────────────────────────────────────────────────────
 * 7 November 2026: "add notifications to the android app". The ward's
 * list of what was new (the PC's round, PhoneLink.alertsFrom), newest
 * first; each also arrives as an Android notification — handed to the
 * background runner (mobile/runner/alerts.src.js), which shows each once,
 * whether the app saw it first or the runner did with the app closed. */
/* the same alert twice in the ward's list (two computers' rounds) is shown once */
/* 21 November 2026, Dr Boulos: "there should be a button to clear alerts in the app" — cleared on this phone (the
   ward's own list stays for the others): everything up to that moment is hidden */
const ALERT_CLEARED = 'nci-phone-alerts-cleared';
const clearedAt = () => { try { return Number(localStorage.getItem(ALERT_CLEARED)) || 0; } catch (e) { return 0; } };
const alertsList = () => { const seen = new Set(); const cut = clearedAt(); return ((S.data && S.data.alerts) || []).filter((a) => {
  if (cut && (a.ms || 0) <= cut) return false; const k = PhoneLink.alertKey ? PhoneLink.alertKey(a) : a.id; if (seen.has(k)) return false; seen.add(k); return true; }).reverse(); };
const todaysAlerts = () => alertsList().filter((a) => new Date(a.ms || 0).toISOString().slice(0, 10) === today());
const ICON = { labs: '🧪', culture: '🧫', fever: '🌡', afebrile: '✓' };
/* 27 November 2026, Dr Boulos: "add subgrouping to alarms: i want to see all recent labs, categorized by patient, and
   another subgroup for fever". Labs (new labs and finalised cultures) under each child, by room; then Fever (a spike,
   24 hours without fever); each newest first. */
const LAB_KINDS = ['labs', 'culture'];
function alertGroups(list) {
  const kids = new Map();
  const fever = [];
  list.forEach((a, i) => {
    if (LAB_KINDS.indexOf(a.kind) >= 0) {
      const k = String(a.pid || txt(a.text).split(':')[0]);
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(i);
    } else fever.push(i);
  });
  const pts = (S.data && S.data.patients) || [];
  const head = (k, a) => {
    const p = pts.find((x) => String(x.id) === k);
    if (p) return `${p.room ? `Room ${txt(p.room)} · ` : ''}${txt(p.name)}`;
    return txt(a.text).split(':')[0];
  };
  const room = (k) => { const p = pts.find((x) => String(x.id) === k); return Number(p && p.room) || 99; };
  const labs = Array.from(kids.entries()).map(([k, idx]) => ({ k, idx, title: head(k, list[idx[0]]) }))
    .sort((x, y) => room(x.k) - room(y.k) || x.title.localeCompare(y.title));
  return { labs, fever };
}
function alertsHtml() {
  const list = alertsList();
  const when = (a) => { const d = new Date(a.ms || 0); return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
  /* under a child's name, the line without the name again */
  const short = (a) => txt(a.text).replace(/^Room [^·]*·\s*/, '').replace(/^[^:]*:\s*/, '');
  const li = (i, words) => `<li dir="auto" data-al="${i}" role="button" style="cursor:pointer"><span class="dim small">${esc(when(list[i]))}</span> ${ICON[list[i].kind] || '•'} ${esc(words)}</li>`;
  const g = alertGroups(list);
  const labs = g.labs.map((c) => `<div class="algroup-kid" dir="auto">${esc(c.title)} <span class="dim small">(${c.idx.length})</span></div>
      <ul class="list alerts">${c.idx.map((i) => li(i, short(list[i]))).join('')}</ul>`).join('');
  return `${header('Alerts', true)}
    <div class="note">What the ward PC's round found new, the last three days. Tap one to read it whole.</div>
    <div class="pad">
      <h3 class="algroup" id="alLabs">🧪 Labs <span class="dim small">by patient</span></h3>
      ${labs || '<ul class="list alerts"><li class="dim">No new labs.</li></ul>'}
      <h3 class="algroup" id="alFever">🌡 Fever</h3>
      <ul class="list alerts">${g.fever.map((i) => li(i, txt(list[i].text).replace(/^Room [^·]*·\s*/, ''))).join('') || '<li class="dim">No fever alerts.</li>'}</ul>
    ${list.length ? '<div class="actions"><button id="alClear">Clear alerts</button></div>' : ''}</div>`;
}
function alertsWire() {
  $('#goBack').onclick = () => route('ward');
  const list = alertsList();
  $$('[data-al]').forEach((li) => { li.onclick = () => { const a = list[+li.dataset.al]; if (a) alertBox([a]); }; });
  if ($('#alClear')) $('#alClear').onclick = () => {
    if (!confirm('Clear the alerts on this phone? New ones will still come.')) return;
    try { localStorage.setItem(ALERT_CLEARED, String(Math.max(Date.now(), ...list.map((a) => a.ms || 0)))); } catch (e) { /* stays */ }
    markSeen(list.map((a) => a.id));
    render();
  };
}

/* ── AN ALERT, IN FULL ─────────────────────────────────────────────
 * 11 November 2026, Dr Boulos: "Notifications only show a couple of lines,
 * not all of the data on the android app, when user clicks notification,
 * open the app, show an alert box with the whole message, and the option
 * to add them to the handover". Android's notification is opened by the
 * app being opened; the app then shows every alert of the last day it has
 * not shown yet, whole, each with "Add to handover" — its words added on a
 * new line of that child's Clinically for today (labs to the Lab box). */
const ALERT_SEEN = 'nci-phone-alerts-seen';
const seenAlerts = () => { try { return JSON.parse(localStorage.getItem(ALERT_SEEN) || '[]'); } catch (e) { return []; } };
function markSeen(ids) { try { localStorage.setItem(ALERT_SEEN, JSON.stringify(seenAlerts().concat(ids).slice(-800))); } catch (e) { /* shown again next time */ } }
function addAlertToHandover(a) {
  const p = ((S.data && S.data.patients) || []).find((x) => String(x.id) === String(a.pid));
  if (!p) return false;
  const st = editWard(p.id);
  const iso = today();
  const d = Ward.dayOf(st, iso);
  const field = a.kind === 'labs' ? 'labs' : 'clinically';
  let line = txt(a.text).replace(/^Room [^·]*·\s*/, '');
  if (line.indexOf(`${txt(p.name)}:`) === 0) line = txt(line.slice(txt(p.name).length + 1));
  if (txt(d[field]).indexOf(txt(line)) >= 0) return 'already';
  /* 27 November 2026, Dr Boulos: "when i get a notification on the phone of new labs, i press add to handover, it
     happens as a duplicate". The PC's round has already written those results into today's Lab box (the alert is cut
     from that very text): only a result the box does not hold yet is added, without the "new labs (time) —" words. */
  if (field === 'labs') {
    const flat = (x) => txt(x).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    const box = flat(d.labs);
    const parts = line.replace(/^new labs(\s*\([^)]*\))?\s*—\s*/i, '').split(' · ').map(flat).filter(Boolean);
    const miss = parts.filter((x) => box.indexOf(x) < 0);
    if (!miss.length) return 'already';
    line = miss.join(', ');
  }
  st.days = st.days || {};
  st.days[iso] = Object.assign(d, { [field]: txt(d[field]) ? `${txt(d[field])}\n${line}` : line });
  changed();
  return true;
}
function showNewAlerts() {
  if (!S.login || staffMode() || $('#alertBox')) return;
  const seen = seenAlerts();
  const day = Date.now() - 24 * 3600 * 1000;
  /* seen by its id, or by its words (the same alert under another id) */
  const key = (a) => `k:${PhoneLink.alertKey ? PhoneLink.alertKey(a) : a.id}`;
  const fresh = alertsList().filter((a) => a && a.id && (a.ms || 0) >= day && seen.indexOf(a.id) < 0 && seen.indexOf(key(a)) < 0);
  if (!fresh.length) return;
  markSeen(fresh.map((a) => a.id).concat(fresh.map(key)));
  /* shown whole here: a notification for it does not open it a second time */
  try { const o = JSON.parse(localStorage.getItem('nci-phone-notif-opened') || '[]'); localStorage.setItem('nci-phone-notif-opened', JSON.stringify(o.concat(fresh.map((a) => a.id)).slice(-200))); } catch (e) { /* fine */ }
  alertBox(fresh);
}
/* alerts in full, each with "Add to handover" */
function alertBox(fresh) {
  if (!fresh || !fresh.length) return;
  const old = $('#alertBox');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'alertBox';
  box.setAttribute('style', 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px');
  box.innerHTML = `<div style="background:var(--bg,#fff);color:inherit;border-radius:12px;max-width:560px;width:100%;max-height:85vh;overflow:auto;padding:14px">
    <h3 style="margin:0 0 8px">${fresh.length === 1 ? 'Alert' : `${fresh.length} alerts`}</h3>
    ${fresh.map((a, i) => `<div style="border-top:1px solid #ddd;padding:8px 0">
      <div class="dim small">${esc(new Date(a.ms || 0).toLocaleString([], { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }))} · ${esc({ labs: 'New labs', culture: 'Culture finalised', fever: 'Fever', afebrile: '24 h without fever' }[a.kind] || 'Alert')}</div>
      <div dir="auto" style="white-space:pre-wrap;margin:4px 0 6px">${esc(a.text)}</div>
      ${a.pid ? `<button data-addho="${i}">＋ Add to handover</button>` : ''}</div>`).join('')}
    <div class="actions"><button class="primary" id="alertOk">OK</button></div></div>`;
  document.body.appendChild(box);
  $$('[data-addho]', box).forEach((b) => { b.onclick = () => {
    const ok = addAlertToHandover(fresh[+b.dataset.addho]);
    b.disabled = true; b.textContent = ok === 'already' ? '✓ Already in today\'s handover' : ok ? '✓ Added to today\'s handover' : 'The child is not on the ward';
  }; });
  $('#alertOk', box).onclick = () => { box.remove(); render(); };
}

/* 21 November 2026, Dr Boulos: "notifications on android should be clickable to view full text" — opened from a
   notification (the app comes to the front), the alerts Android showed and this app has not opened yet are shown
   whole, whether or not the app had them already */
const NOTIF_OPENED = 'nci-phone-notif-opened';
async function openNotified() {
  const R = runnerPlugin();
  if (!R || !S.login || staffMode()) return;
  let got = null;
  try { got = await R.dispatchEvent({ label: RUNNER, event: 'nciNotified', details: {} }); } catch (e) { return; }
  const ids = ((got && got.notified) || []).filter((n) => n && n.id && Date.now() - (n.at || 0) < 24 * 3600 * 1000).map((n) => n.id);
  let opened = [];
  try { opened = JSON.parse(localStorage.getItem(NOTIF_OPENED) || '[]'); } catch (e) { opened = []; }
  const want = ids.filter((id) => opened.indexOf(id) < 0);
  if (!want.length) return;
  try { localStorage.setItem(NOTIF_OPENED, JSON.stringify(opened.concat(want).slice(-200))); } catch (e) { /* again next time */ }
  const all = (S.data && S.data.alerts) || [];
  const list = want.map((id) => all.find((a) => a.id === id)).filter(Boolean);
  if (list.length) { markSeen(list.map((a) => a.id)); alertBox(list); }
}
/* the background runner: which file and ward to watch, and what is new */
const RUNNER = 'eg.edu.nci.orders.alerts';
let runnerSet = '';
function runnerPlugin() {
  const C = window.Capacitor;
  if (!(C && C.isNativePlatform && C.isNativePlatform())) return null;
  return C.registerPlugin ? C.registerPlugin('BackgroundRunner') : (C.Plugins && C.Plugins.BackgroundRunner);
}
async function tellRunner(fileId) {
  const R = runnerPlugin();
  if (staffMode()) return;
  if (!R || !S.login || !fileId) return;
  const alerts = (S.data && S.data.alerts) || [];
  try {
    const key = `${fileId}|${wardKey()}`;
    if (runnerSet !== key) {
      try { await R.requestPermissions({ apis: ['notifications'] }); } catch (e) { /* asked again next time */ }
      await R.dispatchEvent({ label: RUNNER, event: 'nciConfig',
        details: { fileId, wardKey: wardKey(), al: K().al, seenIds: alerts.map((a) => a.id) } });
      runnerSet = key;
      return;
    }
    if (alerts.length) await R.dispatchEvent({ label: RUNNER, event: 'nciShow', details: { alerts: alerts.slice(-20) } });
  } catch (e) { /* the runner tries on its own every 15 minutes */ }
}

async function askHis() {
  if (!(S.pc && S.pc.online)) { alert('No computer of this ward is on right now. Open the app on a ward PC (signed in to the ward), then ask again.'); return; }
  if (!S.pc.hisReady && !confirm(`The PC (${S.pc.host}) has not set up the HIS lab screen yet, so it may not manage. Ask anyway?`)) return;
  try {
    const req = PhoneLink.newRequest('his', Date.now(), 'phone');
    const st = store();
    const r = await st.update(wardKey(), (entry) => (entry && entry.account && entry.account.hash === S.login.hash
      ? { entry: PhoneLink.addRequest(entry, req) } : { error: 'signed-out' }));
    if (!r || r.error) throw new Error('Could not reach the ward file — try again.');
    S.requests = r.entry.requests; keep();
    await google().drive.setProps(await st.locate(), { [K().rq]: req.id });
    toast(`Asked ${S.pc.host} — the results appear here in a minute or two`);
    render();
    waitFor(req.id);
  } catch (e) { toast(offline(e) ? 'No internet' : e.message); }
}
/* 11 November 2026: "add a button: generate today's handover and
   tomorrow's doctor orders. they should be generated to google drive from
   the pc, and trigger a download to my phone" — a PC of the ward makes
   them (NCI ORDERS / PDFs / ward / today); the phone downloads each one:
   on Android into Documents / NCI Orders and offered to open or share; in
   the browser as an ordinary download. */
async function askPdfs() {
  if (!(S.pc && S.pc.online)) { alert('No computer of this ward is on right now. Open the app on a ward PC (signed in to the ward), then ask again.'); return; }
  try {
    const req = PhoneLink.newRequest('pdfs', Date.now(), 'phone');
    const st = store();
    const r = await st.update(wardKey(), (entry) => (entry && entry.account && entry.account.hash === S.login.hash
      ? { entry: PhoneLink.addRequest(entry, req) } : { error: 'signed-out' }));
    if (!r || r.error) throw new Error('Could not reach the ward file — try again.');
    S.requests = r.entry.requests; keep();
    await google().drive.setProps(await st.locate(), { [K().rq]: req.id });
    toast(`Asked ${S.pc.host} for the PDFs — they download here in a minute or two`);
    render();
    waitFor(req.id, downloadPdfs);
  } catch (e) { toast(offline(e) ? 'No internet' : e.message); }
}
async function savePdf(name, b64) {
  const C = window.Capacitor;
  const native = C && C.isNativePlatform && C.isNativePlatform();
  if (native) {
    const FS = C.registerPlugin ? C.registerPlugin('Filesystem') : C.Plugins.Filesystem;
    let uri = '';
    try {
      const w = await FS.writeFile({ path: `NCI Orders/${name}`, data: b64, directory: 'DOCUMENTS', recursive: true });
      uri = w.uri;
    } catch (e) {
      const w = await FS.writeFile({ path: name, data: b64, directory: 'CACHE', recursive: true });
      uri = w.uri;
    }
    return uri;
  }
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return url;
}
async function downloadPdfs(r) {
  const files = (r && r.files) || [];
  if (!files.length) { toast('The PC made no PDFs'); return; }
  toast(`Downloading ${files.length} PDF(s)…`);
  const uris = [];
  for (const f of files) {
    try { uris.push(await savePdf(f.name, await google().drive.bytes(f.id))); } catch (e) { toast(`Not downloaded: ${f.name} — ${e.message}`); }
  }
  const C = window.Capacitor;
  if (uris.length && C && C.isNativePlatform && C.isNativePlatform()) {
    toast(`${uris.length} PDF(s) saved in Documents / NCI Orders`);
    try {
      const Share = C.registerPlugin ? C.registerPlugin('Share') : C.Plugins.Share;
      await Share.share({ title: 'NCI Orders PDFs', files: uris, dialogTitle: 'Open or send the PDFs' });
    } catch (e) { /* saved; the share sheet was closed */ }
  } else if (uris.length) toast(`${uris.length} PDF(s) downloaded`);
}
/* the answer: every 15 s for up to 6 minutes */
function waitFor(id, then, failed, tries) {
  const max = tries || 24;
  let n = 0;
  const t = setInterval(async () => {
    n++;
    try {
      const m = await google().drive.meta(await store().locate());
      if ((m.properties || {})[K().dn] === id || n > max) {
        clearInterval(t);
        await pull();
        const r = (S.requests || []).find((x) => x.id === id);
        if (r && r.status === 'done' && then) await then(r);
        else if (r && r.status === 'done') { toast('HIS results are ready to review'); route('fetch'); }
        else if (failed) failed(r);
        else { toast(r && r.reason ? `The PC could not ${then ? 'make the PDFs' : 'fetch'}: ${r.reason}` : 'No answer from the PC'); render(); }
      }
    } catch (e) { if (n > max) clearInterval(t); }
  }, 15000);
}

/* ── 3. one child's handover ── */
/* 22 November 2026, Dr Boulos: "even if labs are not retrieved today, add the trend button, also show the labs in a
   normal font, without the grey textbox" */
function labsView(st) {
  const dates = Object.keys(st.days || {}).filter((d) => txt((st.days[d] || {}).labs)).sort();
  const d = dates[dates.length - 1];
  if (!d) return `<p class="dim">No labs retrieved yet.</p>${trendHtml(st)}`;
  return `<div class="dim small">${d === today() ? 'Today' : `Last retrieved ${esc(Ward.fullDate(d))}`}</div>
    <div class="labs plain">${Ward.redFlags(esc(Ward.tightCbc(st.days[d].labs))).replace(/\n/g, '<br>')}</div>${trendHtml(st)}`;
}
/* 15 November 2026, Dr Boulos: "lab trends on tap" — the last seven days
   with labs, figure by figure (Ward.labTrend), a small line beside each;
   ANC below 500 and 1000, Hb below 7 and PLT below 20 marked */
const TREND_LOW = { ANC: [500, 1000], Hb: [7, 8], PLT: [20, 50] };
function trendFlag(key, v) {
  const t = TREND_LOW[key];
  if (!t || v == null) return '';
  return v < t[0] ? 'lo2' : v < t[1] ? 'lo1' : '';
}
function sparkSvg(vals) {
  const pts = vals.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) return '';
  const W0 = 40, H0 = 16;
  const ys = pts.map(([, v]) => v);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const x = (i) => (vals.length > 1 ? (i / (vals.length - 1)) * (W0 - 4) + 2 : W0 / 2);
  const y = (v) => (hi === lo ? H0 / 2 : H0 - 2 - ((v - lo) / (hi - lo)) * (H0 - 4));
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const [li, lv] = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W0} ${H0}" width="${W0}" height="${H0}" aria-hidden="true"><path d="${d}"/><circle cx="${x(li).toFixed(1)}" cy="${y(lv).toFixed(1)}" r="2"/></svg>`;
}
function trendHtml(st) {
  const tr = Ward.labTrend ? Ward.labTrend(st, today(), 7) : { dates: [] };
  if (!tr.dates.length || !tr.rows.length) return '<details class="trend"><summary>📈 Trend</summary><p class="dim small">No labs in the last 7 days.</p></details>';
  const dm = (iso) => `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}`;
  const fmt = (k, v) => (v == null ? '·' : k === 'ANC' ? String(v) : String(+v.toFixed(2)));
  return `<details class="trend"><summary>📈 Trend — last ${tr.dates.length} days</summary>
    <div class="trendwrap"><table class="trendtab"><thead><tr><th></th>${tr.dates.map((d) => `<th>${dm(d)}</th>`).join('')}<th></th></tr></thead>
    <tbody>${tr.rows.map((r) => `<tr><th>${esc(r.key)}</th>${r.values.map((v) => `<td class="${trendFlag(r.key, v)}">${fmt(r.key, v)}</td>`).join('')}<td>${sparkSvg(r.values)}</td></tr>`).join('')}</tbody></table></div>
    <div class="dim small">ANC in cells/µL. Marked: ANC &lt; 500 / 1000, Hb &lt; 7 / 8, PLT &lt; 20 / 50.</div></details>`;
}
/* 22 November 2026: "if i add a to do on my phone, it should be uploaded as the single line it is, instantly after i
   finish typing and press an add button … also ticking is processed the same way" */
function sendNow() { changed(); clearTimeout(pushTimer); upload(); }
/* "Medications should be each in a line" — at commas outside brackets */
function medLines(t) {
  const out = [];
  String(t || '').split('\n').forEach((line) => {
    let depth = 0, cur = '';
    for (const ch of line) {
      if (ch === '(') depth++;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && !depth) { if (txt(cur)) out.push(txt(cur)); cur = ''; } else cur += ch;
    }
    if (txt(cur)) out.push(txt(cur));
  });
  return out;
}
/* the day's to-do, one line an item: tick it, and (not in staff mode) add one */
function todoItemsHtml(p, d, iso, readOnly) {
  const lines = String(Ward.todoText(p, d, iso, readWard(p.id)) || '').split('\n').map((l) => txt(l).replace(/\s*✓$/, '')).filter(Boolean);
  return `<ul class="list todo">${lines.map((l) => {
    const done = Ward.isTodoDone(d, l);
    return readOnly ? `<li dir="auto" class="${done ? 'done' : ''}">${esc(l)}${done ? ' <b class="tick">✓</b>' : ''}</li>`
      : `<li dir="auto"><button class="todoline${done ? ' done' : ''}" data-tdp="${esc(p.id)}" data-tdl="${esc(l)}">${esc(l)}${done ? ' <b class="tick">✓</b>' : ''}</button></li>`;
  }).join('') || '<li class="dim">Nothing to do.</li>'}</ul>
    ${readOnly ? '' : `<div class="todoadd"><input type="text" dir="auto" data-tdadd="${esc(p.id)}" placeholder="+ add a to do"><button class="sm" data-tdgo="${esc(p.id)}">Add</button></div>`}`;
}
function wireTodoItems() {
  $$('[data-tdl]').forEach((b) => { b.onclick = () => {
    const st = editWard(b.dataset.tdp);
    st.days = st.days || {};
    const d = Ward.dayOf(st, today());
    st.days[today()] = Ward.markTodo(d, b.dataset.tdl, !Ward.isTodoDone(d, b.dataset.tdl));
    sendNow();
    render();
  }; });
  const add = (pid) => {
    const inp = $(`[data-tdadd="${CSS.escape(pid)}"]`);
    const v = txt(inp && inp.value).replace(/\s*\n\s*/g, ' ');
    if (!v) return;
    const st = editWard(pid);
    st.days = st.days || {};
    const d = Ward.dayOf(st, today());
    st.days[today()] = Object.assign(d, { todo: txt(d.todo) ? `${txt(d.todo)}\n${v}` : v });
    sendNow();
    render();
    toast('Added — sent to the ward');
  };
  $$('[data-tdgo]').forEach((b) => { b.onclick = () => add(b.dataset.tdgo); });
  $$('[data-tdadd]').forEach((i) => { i.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(i.dataset.tdadd); } }; });
}
/* 22 November 2026, Dr Boulos: "lets add staff mode to the app where it has a layout similar to the patient screen, but
   it is read only, no fields to add anything or enter text, and the orders part has the antibiotics to the top, with days
   to the right, and no X icon to cancel, this is designed to get an overview of the patients" — kept on this phone */
/* 22 November 2026, Dr Boulos: "staff mode is toggleable in full screen at first installation, and can be changed from
   the more screen, it has access to every ward, but read only"; "it gives no notifications, alerts, the whole app
   becomes just wards, that if opened shows patients, read only, not all the functions of right now, and no more button
   or the bottom bar". Each ward is opened with its own password once (kept on this phone); nothing is ever sent. */
const MODE_KEY = 'nci-phone-mode';
const appMode = () => { try { return localStorage.getItem(MODE_KEY) || ''; } catch (e) { return 'doctor'; } };
const setMode = (m) => { try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* this session */ } };
const staffMode = () => appMode() === 'staff';
const STAFF_PASS = 'nci-phone-staff-wards';
/* the staff password's hash as last typed on this phone (the file's staff.hash) */
const STAFF_ONE = 'nci-phone-staff-one';
const staffOne = () => { try { return localStorage.getItem(STAFF_ONE) || ''; } catch (e) { return ''; } };
/* may this phone open that ward? the staff password (current), else that ward's own */
function staffMayOpen(all, key) {
  const e = (all.wards || {})[key];
  if (!e || !e.account) return false;
  if (all.staff && all.staff.hash && staffOne() === all.staff.hash) return true;
  return staffKept()[key] === e.account.hash;
}
const staffKept = () => { try { return JSON.parse(localStorage.getItem(STAFF_PASS) || '{}'); } catch (e) { return {}; } };
function modeHtml() {
  return `<div class="login modepick">
    <h1>NCI Orders</h1><p class="dim">How is this phone used?</p>
    <button class="primary big" id="mdDoctor">Doctor<small>the ward's handover, orders, labs, alerts — writing and sending</small></button>
    <button class="big" id="mdStaff">Staff — read only<small>every ward's children to look at; nothing to type, no alerts</small></button>
    <p class="dim small">It can be changed later (Doctor: More → Staff mode; Staff: Resident mode, at the foot of the wards).</p></div>`;
}
function quietRunner() {
  const R = runnerPlugin();
  runnerSet = '';
  if (R) R.dispatchEvent({ label: RUNNER, event: 'nciConfig', details: { fileId: '', wardKey: '', al: '', seenIds: [] } }).catch(() => {});
}
function modeWire() {
  $('#mdDoctor').onclick = () => { setMode('doctor'); route(S.login ? 'ward' : 'login'); };
  $('#mdStaff').onclick = () => { setMode('staff'); quietRunner(); S = { login: null }; keep(); route('swards'); };
}
let staffWards = null;
/* 22 November 2026, Dr Boulos: "have the bottom bar be a list of wards: 3rd south, 4th south, 5th south, 8th south, 9th
   south ICU, 5th North ICU, and 5th north, some of these are not on the app right now, just put a placeholder, or have
   them updated as soon as profiles are created, also patients are scrollable to left or right, and there's a back button
   top left for reviewing all patients in this floor" */
const STAFF_FLOORS = ['3rd South', '4th South', '5th South', '8th South', '9th South ICU', '5th North ICU', '5th North'];
const floorKey = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* 22 November 2026, Dr Boulos: "the bar below shows duplicates, 5th north ICU and 9th South ICU are already there as 5th
   ICU and 9th ICU" — a ward named without its side (5th ICU) is that floor's (5th North ICU): there is one ICU a floor.
   Each ward sits under one floor only; the exact name first, then the name without North / South. */
/* 24 November 2026, Dr Boulos: "now every ward has joined the app except the 8th south, remove doubles". A ward is
   known by its floor, its side and whether it is the ICU, however it is written — "5th ICU", "5 North ICU", "ICU 5N",
   "الخامس اطفال شمالي عناية": each floor of the list gets the ward that is that floor (its side first, then a ward
   named without a side), and two wards that are the same floor are one button — the one with the children on it. */
const ORD_AR = { 'الثالث': 3, 'الرابع': 4, 'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'العاشر': 10 };
const ORD_EN = { third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
function floorSig(n) {
  const t = String(n || '').toLowerCase();
  let num = '';
  const m = /(\d{1,2})/.exec(t);
  if (m) num = String(+m[1]);
  else {
    Object.keys(ORD_AR).forEach((k) => { if (!num && t.indexOf(k) >= 0) num = String(ORD_AR[k]); });
    Object.keys(ORD_EN).forEach((k) => { if (!num && t.indexOf(k) >= 0) num = String(ORD_EN[k]); });
  }
  const side = /north|شمال|(\d)\s*n\b/.test(t) ? 'n' : /south|جنوب|(\d)\s*s\b/.test(t) ? 's' : '';
  const icu = /icu|عناي|intensive/.test(t);
  return { num, side, icu };
}
const sameFloor = (a, b, sideBlankOk) => !!a.num && a.num === b.num && a.icu === b.icu && (a.side === b.side || (sideBlankOk && (!a.side || !b.side)));
function staffFloors() {
  /* doubles among the wards themselves first: one per floor, the one with children */
  const all = (staffWards || []).slice().sort((a, b) => (b.n || 0) - (a.n || 0));
  const known = [];
  all.forEach((w) => {
    const sg = floorSig(w.ward);
    if (sg.num && known.some((k) => sameFloor(floorSig(k.ward), sg, false))) return;
    if (!sg.num && known.some((k) => floorKey(k.ward) === floorKey(w.ward))) return;
    known.push(w);
  });
  const used = new Set();
  const out = STAFF_FLOORS.map((n) => ({ name: n, w: null }));
  [false, true].forEach((loose) => out.forEach((f) => {
    if (f.w) return;
    const w = known.find((x) => !used.has(x.key) && (floorKey(x.ward) === floorKey(f.name) || sameFloor(floorSig(x.ward), floorSig(f.name), loose)));
    if (w) { f.w = w; used.add(w.key); }
  }));
  /* a ward that is not a floor of the list (Day care) still shows, at the end — once; one that is a floor already
     taken is a double and is not shown again */
  known.forEach((w) => {
    if (used.has(w.key)) return;
    const sg = floorSig(w.ward);
    if (sg.num && out.some((f) => sameFloor(floorSig(f.name), sg, true))) return;
    out.push({ name: w.ward, w });
  });
  return out;
}
let staffBarSig = '';
function staffBar() {
  let bar = document.getElementById('staffbar');
  if (!bar) {
    bar = document.createElement('nav');
    bar.id = 'staffbar';
    bar.className = 'staffbar';
    document.body.appendChild(bar);
  }
  bar.hidden = false;
  document.body.classList.add('hasbar');
  if (staffWards == null) {
    staffWards = [];
    driveStore().read().then((all) => {
      staffWards = Object.keys(all.wards || {}).filter((k) => (all.wards[k] || {}).account).map((k) => { const e = all.wards[k]; return { key: k, ward: e.ward || k, n: (((e.data || {}).patients) || []).filter((x) => !x.discharged).length, moved: !!e.moved }; });
      staffBarSig = ''; render(); staffCounts();
    }).catch(() => { staffWards = null; });
  }
  const cur = S.login ? floorKey(S.login.ward) : '';
  const sig = `${cur}|${(staffWards || []).map((w) => w.key).join(',')}`;
  if (sig === staffBarSig) return;
  staffBarSig = sig;
  bar.innerHTML = staffFloors().map((f) => `<button class="floor${f.w ? '' : ' soon'}${f.w && floorKey(f.w.ward) === cur ? ' on' : ''}"${f.w ? ` data-floor="${esc(f.w.key)}"` : ' disabled title="Not on the app yet — appears once the ward is set up on a computer"'}>${esc(f.name)}${f.w ? '' : '<small>soon</small>'}</button>`).join('');
  bar.querySelectorAll('[data-floor]').forEach((b) => { b.onclick = () => staffOpenWard(b.dataset.floor); });
}
async function staffOpenWard(key) {
  const w = (staffWards || []).find((x) => x.key === key);
  if (!w) return;
  {
    try {
      const all = await withLoading(driveStore().read());
      const e = all.wards[key];
      if (staffMayOpen(all, key)) {
        const h = e.account.hash;
        S = { login: { ward: e.ward || w.ward, hash: h }, base: clone(e.data || {}), data: clone(e.data || {}), dirty: false, outbox: [], requests: [], pc: null, pulledAt: Date.now() };
        keep(); wardQ = ''; route('ward'); return;
      }
    } catch (e) { toast(offline(e) ? 'No internet' : e.message); return; }
  }
  /* the password, once: on the wards screen */
  S = { login: null }; keep(); staffAsk = key; route('swards');
}
/* 25 November 2026: the staff password, once right — the staff sign-in on the new server (in the background) */
function staffServer(pw) {
  if (!window.Supa) return;
  Supa.secrets('staff', pw).then((sec) => { Supa.keepStaff(sec); return Supa.staffConnect(sec); })
    .then(() => { toast('Staff: reading the wards from the new server'); staffCounts(); })
    .catch((e) => { if (e.pending) toast(e.message); });
}
/* 28 November 2026, Dr Boulos: "the web app shows 0 children in staff mode". Since the wards moved to the new server
   (25 November), Drive keeps no children: each ward's count is read from the new server with the staff sign-in. A ward
   whose main PC has not yet locked its key for staff says so instead of "0 children". */
let staffCounting = false;
async function staffCounts() {
  const ssec = window.Supa && Supa.staffMine ? Supa.staffMine() : null;
  if (!ssec || staffCounting || !staffWards) return;
  staffCounting = true;
  try {
    for (const w of staffWards) {
      try {
        const got = await Supa.staffWard(ssec, w.key);
        if (got && got.data) { w.n = ((got.data.patients || []).filter((x) => !x.discharged)).length; w.sb = 'ok'; } else w.sb = 'nokey';
      } catch (e) { w.sb = 'err'; if (e.reask) { Supa.keepStaff(null); break; } }
    }
  } finally { staffCounting = false; }
  staffBarSig = ''; render();
}
function staffCountText(w) {
  if (w.sb === 'nokey' && (w.moved || !w.n)) return 'opens once its main PC saves (a minute or two)';
  if (!w.sb && w.moved && window.Supa && Supa.staffMine && Supa.staffMine()) return 'reading…';
  if (!w.sb && w.moved) return 'type the staff password to see its children';
  return `${w.n} child${w.n === 1 ? '' : 'ren'}`;
}
let staffAsk = '';
let staffHasOne = false;
function swardsHtml() {
  const kept = staffKept();
  return `<header class="bar"><h2>Wards</h2></header>
    <div class="note">Read only. Open a ward to see its children — the staff password (or the ward's own) is asked once.</div>
    <!-- 22 November 2026, Dr Boulos: "add a button to enter staff credentials and open up every ward" -->
    <div class="pad"><button class="primary big resmode" id="sAll" type="button">Staff password<small>${staffOne() ? 'typed on this phone — every ward opens' : 'type it once to open every ward'}</small></button></div>
    <div class="cards">${staffWards == null ? '<p class="dim pad">Reading the wards…</p>'
    : staffWards.map((w) => `<button class="card" data-swk="${esc(w.key)}"><div class="top"><bdi class="nm">${esc(w.ward)}</bdi></div>
      <div class="meta">${staffCountText(w)}</div></button>`).join('') || '<p class="dim pad">No wards yet.</p>'}</div>
    <div class="spass" id="sPass" hidden><label><span id="sPassWhat">Password for</span> <b id="sPassWard"></b><input id="sPassIn" type="password" autocomplete="current-password"></label>
      <button class="primary" id="sPassGo">Open</button><p class="err" id="sPassErr"></p></div>
    <!-- 22 November 2026, Dr Boulos: "use this phone as a doctor's: make that a button called resident mode" -->
    <div class="pad"><button class="big resmode" id="toDoctor" type="button">Resident mode<small>this phone as a doctor's: the ward's handover, orders, labs, alerts</small></button></div>`;
}
function swardsWire() {
  if (staffWards == null) {
    driveStore().read().then((all) => {
      staffWards = Object.keys(all.wards || {}).map((k) => { const e = all.wards[k] || {}; return { key: k, ward: e.ward || k, n: (((e.data || {}).patients) || []).filter((x) => !x.discharged).length, moved: !!e.moved }; })
        .filter((w) => (all.wards[w.key] || {}).account).sort((a, b) => a.ward.localeCompare(b.ward));
      render(); staffCounts();
    }).catch((e) => { staffWards = []; toast(offline(e) ? 'No internet' : e.message); render(); });
  }
  let pick = null;
  const open = async (w, hash) => {
    const all = await driveStore().read();
    const e = all.wards[w.key];
    if (!e || !e.account || e.account.hash !== hash) throw new Error('Wrong password for this ward.');
    S = { login: { ward: e.ward || w.ward, hash }, base: clone(e.data || {}), data: clone(e.data || {}), dirty: false, outbox: [], requests: [], pc: null, pulledAt: Date.now() };
    keep();
    route('ward');
  };
  $$('[data-swk]').forEach((b) => { b.onclick = async () => {
    const w = (staffWards || []).find((x) => x.key === b.dataset.swk);
    if (!w) return;
    try {
      const all = await withLoading(driveStore().read());
      if (staffMayOpen(all, w.key)) { await open(w, all.wards[w.key].account.hash); return; }
      staffHasOne = !!(all.staff && all.staff.hash);
    } catch (e) { /* asked below */ }
    pick = w;
    $('#sPassWhat').textContent = staffHasOne ? 'The staff password' : 'Password for';
    $('#sPassWard').textContent = staffHasOne ? '' : w.ward;
    $('#sPass').hidden = false;
    $('#sPassIn').value = '';
    $('#sPassIn').focus();
  }; });
  $('#sAll').onclick = () => {
    pick = { all: true };
    $('#sPassWhat').textContent = 'The staff password';
    $('#sPassWard').textContent = '';
    $('#sPassErr').textContent = '';
    $('#sPass').hidden = false;
    $('#sPassIn').value = '';
    $('#sPassIn').focus();
  };
  const go = async () => {
    if (!pick) return;
    try {
      const all = await driveStore().read();
      if (pick.all) {
        if (!(all.staff && all.staff.hash)) throw new Error('No staff password yet — set one on a ward\'s PC: Troubleshooting → Staff password…');
        const hs = await scryptHex($('#sPassIn').value, all.staff.salt);
        if (hs === all.staff.hash) staffServer($('#sPassIn').value);
        if (hs !== all.staff.hash) throw new Error('Wrong staff password.');
        try { localStorage.setItem(STAFF_ONE, hs); } catch (x) { /* asked next time */ }
        $('#sPassIn').value = '';
        pick = null;
        toast('Every ward is open on this phone');
        render();
        return;
      }
      const e = all.wards[pick.key];
      if (all.staff && all.staff.hash) {
        /* the one staff password: every ward from now on */
        const hs = await scryptHex($('#sPassIn').value, all.staff.salt);
        if (hs === all.staff.hash) staffServer($('#sPassIn').value);
        if (hs !== all.staff.hash) throw new Error('Wrong staff password.');
        try { localStorage.setItem(STAFF_ONE, hs); } catch (x) { /* asked next time */ }
        await open(pick, e.account.hash);
        return;
      }
      const h = await scryptHex($('#sPassIn').value, e.account.salt);
      if (h !== e.account.hash) throw new Error('Wrong password for this ward.');
      const kept = staffKept(); kept[pick.key] = h;
      try { localStorage.setItem(STAFF_PASS, JSON.stringify(kept)); } catch (x) { /* asked next time */ }
      await open(pick, h);
    } catch (e) { $('#sPassErr').textContent = offline(e) ? 'No internet' : e.message; }
  };
  $('#sPassGo').onclick = go;
  if (staffAsk) { const b = $(`[data-swk="${CSS.escape(staffAsk)}"]`); staffAsk = ''; if (b) b.click(); }
  $('#sPassIn').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('#toDoctor').onclick = (e) => { if (e) e.preventDefault(); setMode('doctor'); S = { login: null }; keep(); route('login'); };
}
/* the earlier days without the "culture finalised" lines ("remove culture finalized from previous days overview") */
const noFinal = (t) => String(t || '').split('\n').filter((l) => !/finali[sz]ed/i.test(l)).join('\n');
function orderLines(p) {
  const o = (S.data.orders || {})[String(p.id)] || { sel: {} };
  return (S.data.drugs || []).filter((d) => o.sel && o.sel[d.id] && o.sel[d.id].on).map((d) => {
    let line = '';
    try { line = Sheet.orderLine(d, o.sel[d.id], p) || ''; } catch (e) { line = ''; }
    return { d, line: txt(line).split('\n')[0] };
  });
}
function patientHtml() {
  const p = patients().find((x) => String(x.id) === String(view.pid)) || (S.data.patients || []).find((x) => String(x.id) === String(view.pid));
  if (!p) return `${header('Not found', true)}`;
  return `${header(`<bdi id="pTitle">${esc(p.name)}</bdi>`, true)}
    <div class="rview" id="pView"><div class="rslide" id="pSlide">${patientBody(p)}</div></div>`;
}
/* the child's page itself — what slides when swiping to the next child */
/* staff mode's orders: the antibiotics first, each with its day to the right; then the rest; nothing to take off */
function staffOrdersHtml(p, ol, iso) {
  const abx = ol.filter((x) => x.d.day_counter || /antimicrobial/.test(x.d.group || '') || /antibacterial|antifungal|antiviral/.test(x.d.drug_class || ''));
  const rest = ol.filter((x) => abx.indexOf(x) < 0);
  const day = (d) => { try { return Sheet.antibioticDay(p, d, iso) || ''; } catch (e) { return ''; } };
  return `<section><h3>Orders <span class="dim">(${ol.length})</span></h3>
    <ul class="list staffabx">${abx.map((x) => `<li><span>${esc(x.d.short_en || x.d.name_en || x.d.ar_name)}</span><b class="abxday">${day(x.d) ? `D${day(x.d)}` : ''}</b></li>`).join('')}</ul>
    <ul class="list">${rest.map((x) => `<li dir="rtl">${esc(x.line || x.d.ar_name || x.d.name_en)}</li>`).join('') || (abx.length ? '' : '<li class="dim">Nothing ordered yet.</li>')}</ul></section>`;
}
function patientBody(p) {
  const st = readWard(p.id);
  const iso = today();
  const d = Ward.dayOf(st, iso);
  const meds = txt(d.meds) || txt(d.medsAuto);
  const imaging = [['CT', st.ct], ['Echo', st.echo]].filter(([, x]) => txt(x.date) || txt(x.finding))
    .map(([l, x]) => ({ label: l, date: x.date, text: x.finding })).concat((st.moreImaging || []).map((x) => ({ label: x.label, date: x.date, text: x.finding })));
  const cultures = Ward.cultureList ? Ward.cultureList(st).map((x) => ({ label: x.label, date: x.date, text: x.result, final: x.final }))
    : [['Rectal swab', st.rectal], ['Blood culture', st.blood]].filter(([, x]) => txt(x.date) || txt(x.result))
      .map(([l, x]) => ({ label: l, date: x.date, text: x.result })).concat((st.moreCultures || []).map((x) => ({ label: x.label, date: x.date, text: x.result })));
  const chemoTodo = (Ward.chemoTodoFor ? Ward.chemoTodoFor(p, iso) : []).concat(Ward.cultureTodoFor ? Ward.cultureTodoFor(readWard(p.id), iso) : []);
  const past = Object.keys(st.days || {}).filter((k) => k < iso).sort().reverse()
    .filter((k) => txt(st.days[k].clinically) || txt(st.days[k].labs) || txt(st.days[k].todo)).slice(0, 7);
  const ol = orderLines(p);
  const ro = staffMode();
  const item = (x) => `<li${x.final ? ' class="final"' : ''}><b>${esc(x.label)}</b>${x.date ? ` <span class="dim">${esc(Ward.fullDate(x.date))}</span>` : ''}${x.text ? ` — ${esc(x.text)}` : ''}${x.final ? ' <span class="b b-alarm">Finalised — check HIS</span>' : ''}</li>`;
  return `${childSyncHtml(p.id)}
    <div class="pt">
      <div class="meta">Room ${esc(p.room || '—')} · ${esc(p.mrn || '')} · ${esc(p.diagnosis || '')}</div>
      <div class="meta"><b>${esc(Sheet.dayLabel(p, iso) || '')}</b> · ${p.weight ? `${esc(p.weight)} kg` : 'no weight'}${p.height ? ` · ${esc(p.height)} cm` : ''}</div>
      ${txt(st.summary) ? `<div class="sum" dir="auto">${esc(st.summary)}</div>` : ''}
    </div>
    ${/* 22 November 2026, Dr Boulos: "phone app should be summary, then vitals, then clinical, then to do, then
         cultures, imaging, then meds, and lastly orders, previous days last" (the labs with the vitals) */''}
    ${/* 7 November 2026: "recover fever of the last week and show a chart
         for review, on both windows and android" */''}
    ${Ward.feverChartSvg ? `<section><h3>Temperature — last 7 days</h3>${Ward.feverChartSvg(st.temps || [], null, { w: 400, h: 200 })}</section>` : ''}
    ${/* 22 November 2026, Dr Boulos: HR, SpO2 and RR below the fever chart, "and it should behave the same way in the
         android app" — on an ICU (the ward's kind, set at calibration), or wherever the HIS gave them */''}
    ${Ward.vitalChartSvg && ((S.data && (S.data.wardKind === 'icu' || (S.data.wardKind !== 'ward' && S.data.hisWard && S.data.hisWard.kind === 'icu'))) || ['hr', 'spo2', 'rr'].some((k) => ((st.vitals || {})[k] || []).length))
    ? `<section><h3>HR · SpO2 · RR — last 7 days</h3>${['hr', 'spo2', 'rr'].map((k) => Ward.vitalChartSvg(k, (st.vitals || {})[k] || [], null, { w: 400, h: 120 })).join('')}</section>` : ''}
    <section><h3>Labs</h3>${labsView(st)}</section>
    <section><h3>Clinically — today</h3>
      ${ro ? (txt(d.clinically) ? `<div class="pre" dir="auto">${esc(d.clinically)}</div>` : '<p class="dim">Nothing written today.</p>')
    : `<textarea id="fClin" dir="auto" rows="4" placeholder="Today's clinical notes">${esc(d.clinically)}</textarea>`}</section>
    <section><h3>To do</h3>
      ${d.todoCarried && txt(d.todo) ? `<div class="dim small">Carried from ${esc(Ward.fullDate(d.todoCarried))}</div>` : ''}
      ${todoItemsHtml(p, d, iso, ro)}</section>
    <section><h3>Cultures &amp; swabs</h3><ul class="list">${cultures.map(item).join('') || '<li class="dim">None.</li>'}</ul>
      ${ro ? '' : addForm('cul', Ward.CULTURE_KINDS, 'Result')}</section>
    <section><h3>Imaging</h3><ul class="list">${imaging.map(item).join('') || '<li class="dim">None.</li>'}</ul>
      ${ro ? '' : addForm('img', Ward.IMAGING_KINDS, 'Finding')}</section>
    <section><h3>Medications today</h3>${meds ? `<ul class="list meds">${medLines(meds).map((m) => `<li dir="auto">${esc(m)}</li>`).join('')}</ul>` : '<p class="dim">From the orders, once written.</p>'}</section>
    ${ro ? staffOrdersHtml(p, ol, iso) : `<section><h3>Orders <span class="dim">(${ol.length})</span></h3>
      ${(() => { const a = Ward.gcsfAdvice ? Ward.gcsfAdvice(p, ((S.data.orders || {})[String(p.id)]) || {}, S.data.drugs, d.labs) : null;
    return a ? `<div class="note warn">${esc(a.text)} — a suggestion; nothing is changed until you take it off.</div>` : ''; })()}
      ${(() => { const a = Ward.feverAdvice ? Ward.feverAdvice(readWard(p.id), ((S.data.orders || {})[String(p.id)]) || {}, S.data.drugs) : null;
    return a ? `<div class="note warn">${esc(a.text)} — a suggestion; nothing is ordered or booked.</div>` : ''; })()}
      <ul class="orders">${ol.map((x) => `<li><span dir="rtl">${esc(x.line || x.d.ar_name || x.d.name_en)}</span>
        <button class="x" data-unorder="${esc(x.d.id)}" title="Take off the order">✕</button></li>`).join('') || '<li class="dim">Nothing ordered yet.</li>'}</ul>
      <input id="drugQ" placeholder="Add a drug — type its name" autocomplete="off">
      <div id="drugHits" class="hits"></div>
      <p class="dim small">Doses and details left blank are completed on the PC before printing.</p></section>`}
    ${ro ? '' : (() => { const h = CloudSync.logFor ? CloudSync.logFor(FIELD_LOG, p.id).slice(0, 20) : [];
    return h.length ? `<section><details><summary><h3 style="display:inline">🕘 Changes</h3> <span class="dim">(${h.length})</span></summary>
      <ul class="list hist">${h.map((e) => `<li><span class="dim">${esc(hhmm(e.at) ? `${new Date(e.at).getDate()}/${new Date(e.at).getMonth() + 1} ${hhmm(e.at)}` : '')} · ${esc(e.by || '')}</span><br><b>${esc(CloudSync.pathLabel(e.path, S.data).replace(/^[^—]*— /, ''))}</b> — <span dir="auto">${esc(e.v || '(emptied)')}</span></li>`).join('')}</ul></details></section>` : ''; })()}
    ${past.length ? `<section><h3>Earlier days</h3>${past.map((k) => `<details><summary>${esc(Ward.fullDate(k))}</summary>
      ${txt(st.days[k].labs) ? `<div class="labs plain">${Ward.redFlags(esc(Ward.tightCbc(st.days[k].labs))).replace(/\n/g, '<br>')}</div>` : ''}
      ${txt(noFinal(st.days[k].clinically)) ? `<div class="pre" dir="auto">${esc(noFinal(st.days[k].clinically))}</div>` : ''}
      ${txt(st.days[k].todo) ? `<div class="pre dim" dir="auto">To do: ${esc(st.days[k].todo)}</div>` : ''}</details>`).join('')}</section>` : ''}`;
}
function addForm(kind, list, what) {
  return `<details class="add"><summary>＋ Add</summary>
    <input list="${kind}List" id="${kind}Label" placeholder="What (e.g. ${esc(list[0])})"><datalist id="${kind}List">${list.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
    <input type="date" id="${kind}Date" value="${today()}">
    ${kind === 'cul' ? `<select id="culKind"><option value="">Result —</option>${(Ward.CULTURE_CODES || ['NG', 'P', 'NS']).map((c) => `<option>${c}</option>`).join('')}<option value="organism">Organism…</option></select>
    <input id="culText" placeholder="organism" dir="auto" hidden>` : `<input id="${kind}Text" placeholder="${what}" dir="auto">`}
    <button class="primary" id="${kind}Add">Add</button></details>`;
}
function patientWire() {
  $('#goBack').onclick = () => route('ward');
  const p = (S.data.patients || []).find((x) => String(x.id) === String(view.pid));
  if (!p) return;
  /* 17 November 2026: swipe to the next child, as in the round */
  const list = patients();
  const at = list.findIndex((x) => String(x.id) === String(p.id));
  if (at >= 0) attachPager({ view: $('#pView'), slide: $('#pSlide'), count: list.length, index: at, page: (k) => patientBody(list[k]),
    light: (k) => { const t = $('#pTitle'); if (t) t.textContent = list[k].name; },
    settled: (k) => route('patient', list[k].id) });
  const iso = today();
  const setDay = (field, v) => { const st = editWard(p.id); st.days[iso] = Object.assign(Ward.dayOf(st, iso), { [field]: v }); changedSoon(); };
  wireTodoItems();
  if (staffMode()) return;
  $('#fClin').oninput = (e) => setDay('clinically', e.target.value);
  const add = (kind) => {
    const label = txt($(`#${kind}Label`).value); const date = $(`#${kind}Date`).value;
    /* 8 November 2026: a culture's result is NG, P, NS, or the organism typed */
    const t = kind === 'cul' ? ($('#culKind').value === 'organism' ? txt($('#culText').value) : $('#culKind').value) : txt($(`#${kind}Text`).value);
    if (!label) { toast('Say what it is'); return; }
    const st = editWard(p.id);
    if (kind === 'img') st.moreImaging = (st.moreImaging || []).concat([{ label, date, finding: t, result: '' }]);
    else st.moreCultures = (st.moreCultures || []).concat([{ label, date, result: t, finding: '' }]);
    changed(); render(); toast(`${label} added`);
  };
  $('#imgAdd').onclick = () => add('img');
  $('#culAdd').onclick = () => add('cul');
  if ($('#culKind')) $('#culKind').onchange = () => { $('#culText').hidden = $('#culKind').value !== 'organism'; if (!$('#culText').hidden) $('#culText').focus(); };
  /* drugs: search the ward's own list, tap to put on the order */
  const order = () => {
    S.data.orders = S.data.orders || {};
    const k = String(p.id);
    if (!S.data.orders[k]) S.data.orders[k] = { sel: {}, extra: '' };
    S.data.orders[k].sel = S.data.orders[k].sel || {};
    return S.data.orders[k];
  };
  $('#drugQ').oninput = (e) => {
    const q = txt(e.target.value).toLowerCase();
    const o = order();
    const hits = q.length < 2 ? [] : (S.data.drugs || []).filter((d) => !(o.sel[d.id] && o.sel[d.id].on)
      && [d.name_en, d.ar_name, d.template_ar, d.category].some((x) => txt(x).toLowerCase().includes(q))).slice(0, 12);
    $('#drugHits').innerHTML = hits.map((d) => `<button data-order="${esc(d.id)}"><b>${esc(d.name_en || d.ar_name)}</b> <span class="dim">${esc(d.category || '')}</span></button>`).join('');
    $$('[data-order]').forEach((b) => { b.onclick = () => {
      const o2 = order();
      o2.sel[b.dataset.order] = Object.assign({}, o2.sel[b.dataset.order] || {}, { on: true });
      changed(); render(); toast('Added to the order');
    }; });
  };
  $$('[data-unorder]').forEach((b) => { b.onclick = () => {
    const o = order();
    if (o.sel[b.dataset.unorder]) o.sel[b.dataset.unorder].on = false;
    changed(); render(); toast('Taken off the order');
  }; });
}

/* ── 4. reviewing what a PC fetched from the HIS ── */
function fetchHtml() {
  const f = S.fetch;
  if (!f) return `${header('HIS results', true)}<p class="dim pad">Nothing fetched yet.</p>`;
  const rows = f.rows || [];
  return `${header('HIS results', true)}
    <p class="dim pad">${f.hourly ? 'The hourly round, from' : 'From'} ${esc(f.host)} at ${new Date(f.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} for ${esc(Ward.fullDate(f.iso))}.
      Ticked items are written into today's handover; untick anything you do not want.</p>
    ${f.moves && f.moves.otherWard ? `<div class="note warn">The PC's HIS was open on another ward — discharges and admissions were not checked.</div>` : ''}
    ${f.moves && f.moves.gone && f.moves.gone.length ? `<div class="note warn">No longer on the ward in the HIS: ${f.moves.gone.map((x) => `<bdi>${esc(x.name)}</bdi>`).join(', ')} — discharge them on a PC.</div>` : ''}
    ${f.moves && f.moves.fresh && f.moves.fresh.length ? `<div class="note">New in the HIS, not on the handover: ${f.moves.fresh.map((x) => `<bdi>${esc(x.name)}</bdi>`).join(', ')} — admit them here (More → Admit a patient) on a PC.</div>` : ''}
    ${rows.map((r) => `<section class="fx"><h3><bdi>${esc(r.name)}</bdi> <span class="dim">room ${esc(r.room || '—')}</span></h3>
      ${(r.cultures || []).length ? `<div class="note warn">Culture finalised in the last 2 weeks: ${r.cultures.map((c) => `${esc(c.name)} (${esc(c.date)})`).join(', ')} — see the HIS.</div>` : ''}
      ${r.text ? `<label class="chk"><input type="checkbox" data-k="${esc(r.pid)}:labs" checked> <span><b>Labs</b><div class="labs">${Ward.redFlags(esc(Ward.tightCbc(r.text))).replace(/\n/g, '<br>')}</div></span></label>`
    : `<div class="dim">${r.ok ? 'No results from today.' : `Could not read: ${esc(r.reason || 'unknown')}`}</div>`}
      ${r.fever && r.fever.line ? `<label class="chk"><input type="checkbox" data-k="${esc(r.pid)}:fever" checked> <span><b>Fever:</b> ${esc(r.fever.line)}</span></label>` : ''}
      ${r.fever && (r.fever.week || []).length && Ward.feverChartSvg ? (() => {
    const wk = { temps: (readWard(r.pid).temps || []).slice() };
    Ward.addTemps(wk, r.fever.week);
    return Ward.feverChartSvg(wk.temps, null, { w: 400, h: 200 });
  })() : ''}
      ${r.fluidLine ? `<label class="chk"><input type="checkbox" data-k="${esc(r.pid)}:fluid" checked> <span><b>Fluids:</b> ${esc(r.fluidLine)}</span></label>` : ''}
      ${r.wt && (r.wt.weight != null || r.wt.height != null) ? `<label class="chk"><input type="checkbox" data-k="${esc(r.pid)}:wt" checked> <span><b>Weight/height in the HIS:</b> ${esc(r.wt.weight ?? '—')} kg / ${esc(r.wt.height ?? '—')} cm <span class="dim">— doses follow the weight; untick to keep the app's</span></span></label>` : ''}
    </section>`).join('')}
    <div class="actions sticky"><button id="fxSkip">Not now</button><button class="primary" id="fxApply">Fill in everything ticked</button></div>`;
}
function fetchWire() {
  $('#goBack').onclick = () => route('ward');
  if (!S.fetch) return;
  $('#fxSkip').onclick = () => route('ward');
  $('#fxApply').onclick = () => {
    const keepIt = {};
    $$('[data-k]').forEach((c) => { const [pid, k] = c.dataset.k.split(':'); keepIt[pid] = keepIt[pid] || {}; keepIt[pid][k] = c.checked; });
    const n = PhoneLink.applyFetch(S.data, S.fetch.rows, keepIt, S.fetch.iso);
    S.applied = S.fetch.id;
    changed();
    toast(`Filled in for ${n} child(ren)`);
    route('ward');
  };
}

/* ── 5. booking a procedure, on the procedures sheet itself ── */
function bookHtml() {
  const list = patients();
  return `${header('Book a procedure', true)}<div class="form pad">
    <label>Child<select id="bkWho"><option value="">— choose —</option>${list.map((p) => `<option value="${esc(p.id)}">${p.room ? `${esc(p.room)} · ` : ''}${esc(p.name)}</option>`).join('')}</select></label>
    <div class="row">${['BMA', 'BMB', 'CSF', 'ITH'].map((x) => `<label class="chk inline"><input type="checkbox" data-proc="${x}"> ${x}</label>`).join('')}</div>
    <label>Date<input type="date" id="bkDate" value="${today()}"></label>
    <label>Place<input id="bkPlace" dir="auto"></label>
    <label>Mediastinal mass<select id="bkMass"><option value=""></option><option>No</option><option>Yes</option></select></label>
    <label>Known allergies<input id="bkAllergy"></label>
    <label>Prescribing physician<input id="bkDoc"></label>
    <label>Notes<textarea id="bkNotes" rows="2"></textarea></label>
    <label class="chk" id="bkSchBox" hidden><input type="checkbox" id="bkSch" checked> Also print «تعطى حقنة الظهر اليوم» on that day's orders</label>
    <p class="err" id="bkErr"></p>
    <button class="primary big" id="bkGo">Book it</button></div>`;
}
function bookWire() {
  $('#goBack').onclick = () => route('ward');
  const who = () => (S.data.patients || []).find((p) => String(p.id) === $('#bkWho').value);
  const sch = () => { const p = who(); $('#bkSchBox').hidden = !(p && $('[data-proc="ITH"]').checked && Schedule.chemoDay(p, $('#bkDate').value)); };
  $('#bkWho').onchange = () => { const p = who(); if (p && !txt($('#bkPlace').value)) $('#bkPlace').value = p.ward || ''; sch(); };
  $$('[data-proc]').forEach((c) => { c.onchange = sch; });
  $('#bkDate').onchange = sch;
  $('#bkGo').onclick = async () => {
    const p = who();
    const procs = $$('[data-proc]').filter((c) => c.checked).map((c) => c.dataset.proc);
    const date = $('#bkDate').value;
    const miss = [['the child', p], ['a procedure', procs.length], ['the date', date]].filter(([, v]) => !v).map(([k]) => k);
    if (miss.length) { $('#bkErr').textContent = `Still needed: ${miss.join(', ')}.`; return; }
    const t = new Date(); const pp = (n) => String(n).padStart(2, '0');
    const fields = { Timestamp: `${t.getFullYear()}-${pp(t.getMonth() + 1)}-${pp(t.getDate())}T${pp(t.getHours())}:${pp(t.getMinutes())}:${pp(t.getSeconds())}`,
      Date: date, Name: p.name || '', MRN: p.mrn || '', Place: txt($('#bkPlace').value),
      Age: (Sheet.ageText && p.dobYear ? Sheet.ageText(p) : '') || p.age || '',
      SEX: p.sex === 'M' ? 'Male' : p.sex === 'F' ? 'Female' : '', 'Diagnosis ': p.diagnosis || '',
      'Procedure List': procs.join(', '), 'Mediastinal Mass ': $('#bkMass').value, 'known Allergies': txt($('#bkAllergy').value),
      'Prescribing Physician': txt($('#bkDoc').value), Notes: txt($('#bkNotes').value) };
    $('#bkGo').disabled = true; $('#bkGo').textContent = 'Booking…';
    try {
      await google().append(PROC_LINK, fields, ['Timestamp', 'Date']);
      if (!$('#bkSchBox').hidden && $('#bkSch').checked) {
        const n = Schedule.chemoDay(p, date);
        p.schedules = (p.schedules || []).concat([{ text: 'تعطى حقنة الظهر اليوم', days: [n], cycle: p.cycleName || '' }]);
        changed();
      }
      toast(`${p.name} booked: ${procs.join(', ')} on ${Ward.fullDate(date)}`);
      route('ward');
    } catch (e) {
      $('#bkErr').textContent = offline(e) ? 'No internet — nothing was booked.' : `Not booked: ${e.message}`;
      $('#bkGo').disabled = false; $('#bkGo').textContent = 'Book it';
    }
  };
}

/* ── start ── */
restore();
document.addEventListener('DOMContentLoaded', () => {
  const was = S.login ? lastView() : null;
  if (was) route(was.name, was.pid); else route(S.login ? 'ward' : 'login');
  /* 25 November 2026: a phone signed in before the move is asked once */
  setTimeout(() => moveAsk(), 5000);
  /* 11 November 2026: "Sync phone app on opening" — the ward's file is
     brought in each time the app opens or comes back to the front (what
     the phone has not uploaded yet is added in first) */
  const syncNow = () => {
    if (!S.login) return;
    if (typing()) { heldBack = true; return; }
    pull().then(() => { if (!typing()) render(); syncBadge(); }).catch((e) => { syncBadge(e); if (!offline(e)) toast(e.message); }).then(look).then(showNewAlerts).then(openNotified);
  };
  syncNow();
  setInterval(look, 60 * 1000);
  /* 13 November 2026: the phone's own update — a look shortly after opening, then every six hours */
  setTimeout(() => { checkPhoneUpdate(); }, 20 * 1000);
  /* every half hour: a build two behind loses the ward (buildGate) */
  setInterval(() => { checkPhoneUpdate(); }, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  /* 7 November 2026: "make the back button go back, not close the
     application." Android's back does what the screen's own ‹ does; an
     open drop-down section closes first; on the ward list or the sign-in
     the app goes to the background instead of closing. */
  const C = window.Capacitor;
  const AppPlugin = C && (C.registerPlugin ? C.registerPlugin('App') : C.Plugins && C.Plugins.App);
  if (AppPlugin && C.isNativePlatform && C.isNativePlatform()) {
    AppPlugin.addListener('backButton', () => phoneBack(AppPlugin));
  }
});
/* what Android's back button does, screen by screen */
function phoneBack(AppPlugin) {
  const open = [...document.querySelectorAll('details[open]')].pop();
  if (open) { open.open = false; return 'closed a section'; }
  const b = $('#goBack');
  if (b) { b.click(); return 'back'; }
  if (AppPlugin && AppPlugin.minimizeApp) AppPlugin.minimizeApp();
  return 'background';
}
window.NciPhone = { get state() { return S; }, render, route, look, pull, push, phoneBack, showNewAlerts, alertBox, openNotified, addAlertToHandover, savePdf, askPdfs, sheet, sealPin, b64, unb64, loading, checkPhoneUpdate, updateCountdown };
})();
