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

/* ── what the phone keeps ─────────────────────────────────────── */
let S = { login: null, base: null, data: null, dirty: false, outbox: [], fetch: null, requests: [], applied: '', pc: null, modified: '', pulledAt: 0 };
function keep() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { toast('The phone is out of space for the ward\'s copy'); } }
function restore() {
  try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j && j.login) S = Object.assign(S, j); } catch (e) { /* a fresh start */ }
  /* typing left unsent by the version before the notes: made notes, not lost */
  try {
    if (S.login && S.dirty && !(S.outbox || []).length && S.base && S.data && window.CloudSync) {
      S.outbox = CloudSync.notesFrom(S.base, S.data, 'phone', Date.now());
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
const store = () => CloudSync.store(google().drive, FOLDER);
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
  const all = await store().read();
  const entry = all.wards[CloudSync.wardKey(ward)];
  if (!entry || !entry.account) throw new Error('There is no ward by that name. Create it on a computer first.');
  const h = await scryptHex(password, entry.account.salt);
  if (h !== entry.account.hash) throw new Error('Wrong password for this ward.');
  S = { login: { ward: entry.ward || ward, hash: h }, base: clone(entry.data || {}), data: clone(entry.data || {}),
    dirty: false, fetch: entry.hisFetch || null, requests: entry.requests || [], applied: (entry.hisFetch && entry.hisFetch.id) || '',
    pc: null, modified: '', pulledAt: Date.now() };
  keep();
}
function signOut() {
  if (S.dirty && !confirm('Some changes have not reached the ward yet. Sign out and lose them?')) return;
  S = { login: null }; keep(); route('login');
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
function loading(on) {
  loadingN = Math.max(0, loadingN + (on ? 1 : -1));
  if (typeof document !== 'undefined') document.body.classList.toggle('loading', loadingN > 0);
}
async function withLoading(p) { loading(true); try { return await p; } finally { loading(false); } }
async function pull() {
  if (busy) return busy;
  busy = withLoading((async () => {
    if ((S.outbox || []).length) await push();
    const all = await store().read();
    const entry = all.wards[wardKey()];
    if (!entry || !entry.account || entry.account.hash !== S.login.hash) {
      S = { login: null }; keep(); route('login');
      throw new Error('The ward\'s password was changed, or the ward is gone — sign in again.');
    }
    /* something was typed while the ward's file was being read: it is not
       laid over what is on the screen; the next look takes it in */
    if (typing() && S.data) { heldBack = true; return; }
    const shown = CloudSync.overlay(entry.data || {}, (entry.inbox || []).concat(S.outbox || []));
    S.base = clone(shown); S.data = clone(shown);
    S.mainHost = entry.main ? entry.main.host : '';
    S.waiting = (entry.inbox || []).length;
    S.fetch = entry.hisFetch || null;
    S.requests = entry.requests || [];
    /* the main PC's key for a PIN, and the names whose logins are saved */
    S.pinKey = entry.pinKey ? entry.pinKey.key : '';
    S.physicians = Object.keys(all.physicians || {}).map((k) => all.physicians[k].name).filter(Boolean).sort();
    S.pulledAt = Date.now();
    keep();
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
    const r = await st.update(wardKey(), (entry) => {
      if (!entry || !entry.account || entry.account.hash !== S.login.hash) return { error: 'signed-out' };
      const have = new Set((entry.inbox || []).map((n) => n.id).concat(entry.done || []));
      return { entry: Object.assign({}, entry, { inbox: (entry.inbox || []).concat(out.filter((n) => !have.has(n.id))) }) };
    });
    if (!r || r.error) throw new Error(r && r.error === 'signed-out' ? 'The ward\'s password was changed — sign in again.' : 'The ward file was busy — try again.');
    /* "confirm the sync": read back a moment later; every note must be in
       the ward's inbox (or already taken in by the main PC) */
    await new Promise((res) => setTimeout(res, 2000));
    const back = (await st.read()).wards[wardKey()] || {};
    const there = new Set((back.inbox || []).map((n) => n.id).concat(back.done || []));
    const sent = new Set(out.filter((n) => there.has(n.id)).map((n) => n.id));
    S.outbox = (S.outbox || []).filter((n) => !sent.has(n.id));
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
  const notes = CloudSync.notesFrom(S.base || {}, S.data || {}, 'phone', Date.now());
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
    if (m.modifiedTime !== S.modified) {
      if (typing()) heldBack = true;                 /* taken in when the box is left */
      else { S.modified = m.modifiedTime; await pull(); if (typing()) heldBack = true; else render(); }
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
function route(name, pid) { view = { name, pid: pid || null }; keepView(); render(); window.scrollTo(0, 0); }
function render() {
  const app = $('#app');
  if (!S.login) view.name = 'login';
  app.innerHTML = ({ login: loginHtml, ward: wardHtml, patient: patientHtml, fetch: fetchHtml, book: bookHtml, todo: todoHtml, alerts: alertsHtml, labs: labsHtml, pin: pinHtml }[view.name] || wardHtml)();
  ({ login: loginWire, ward: wardWire, patient: patientWire, fetch: fetchWire, book: bookWire, todo: todoWire, alerts: alertsWire, labs: labsWire, pin: pinWire }[view.name] || wardWire)();
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
  b.innerHTML = `${n ? `${n} note(s) to send…` : err ? 'Offline — saved on the phone' : `Sent to the main PC${at ? ` ✓ confirmed ${at}` : ''}`} · ${pc}`;
  b.className = `syncbadge${S.dirty || err ? ' warn' : ''}`;
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
    <button class="primary big" id="lgGo">Sign in</button>
    <p class="err" id="lgErr"></p>
    <p class="dim small">The same ward name and password as on the ward's computers.</p></div>`;
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
  $('#lgGo').onclick = async () => {
    const w = txt($('#lgWard').value); const p = $('#lgPass').value;
    if (!w || !p) { $('#lgErr').textContent = 'Type the ward name and the password.'; return; }
    $('#lgGo').disabled = true; $('#lgGo').textContent = 'Signing in…';
    try { await signIn(w, p); route('ward'); look(); }
    catch (e) { $('#lgErr').textContent = offline(e) ? 'No internet — the first sign-in needs it.' : e.message; }
    finally { const b = $('#lgGo'); if (b) { b.disabled = false; b.textContent = 'Sign in'; } }
  };
}

/* ── 2. the ward's cards ── */
function badges(p) {
  const out = [];
  const day = today();
  Schedule.boardLines(p, day).forEach((l) => out.push([l.kind, l.text]));
  const gc = Ward.gcsfAdvice ? Ward.gcsfAdvice(p, ((S.data.orders || {})[String(p.id)]) || {}, S.data.drugs, Ward.dayOf(readWard(p.id), day).labs) : null;
  if (gc) out.push(['warn', gc.text]);
  if (Ward.lysisAdvice) Ward.lysisAdvice(((S.data.orders || {})[String(p.id)]) || {}, S.data.drugs, Ward.dayOf(readWard(p.id), day).levels).forEach((t) => out.push(['warn', t]));
  /* how long the fever is, and fever day 5 (Ward.feverAdvice) */
  if (Ward.feverDays) {
    const fdx = Ward.feverDays(readWard(p.id).temps || []);
    const fa = Ward.feverAdvice(readWard(p.id), ((S.data.orders || {})[String(p.id)]) || {}, S.data.drugs);
    if (fa) out.push(['alarm', fa.text]);
    else if (fdx.febrile) out.push(['warn', Ward.feverDaysText(fdx)]);
  }
  const ec = Schedule.echo(p, day, Ward.echoDates ? Ward.echoDates(readWard(p.id)) : []);
  if (ec.state === 'due') out.push(['today', 'Weekly echo due today']);
  if (ec.state === 'overdue') out.push(['alarm', `Echo overdue — ${ec.days} days`]);
  if (ec.state === 'none') out.push(['warn', 'No echo on record']);
  const d = Ward.dayOf(readWard(p.id), day);
  if (Ward.cultureList && Ward.cultureList(readWard(p.id)).some((e) => e.final && e.final >= Ward.addDays(day, -2))) out.push(['alarm', 'Culture finalised — check HIS']);
  if (/\*\*/.test(d.labs || '')) out.push(['alarm', 'Hb/PLT red flag']);
  if (/^\s*Spikes?\s+/m.test(d.clinically || '')) out.push(['alarm', 'Fever spike']);
  out.push(txt(d.labs) ? ['ok', 'Labs today'] : ['warn', 'No labs today']);
  return out;
}
function header(title, back) {
  return `<header class="bar">${back ? `<button class="back" id="goBack">‹</button>` : ''}<span class="pcdot ${S.main && S.main.online ? 'on' : 'off'}" id="pcDot"></span><h2>${title}</h2>
    ${back ? '' : '<button class="ghost" id="signOut">Sign out</button>'}</header><div class="syncbadge" id="syncBadge"></div>`;
}
function wardHtml() {
  const list = patients();
  const fresh = S.fetch && S.fetch.id !== S.applied;
  const pending = (S.requests || []).filter((r) => r.status === 'pending' && Date.now() - r.at < PhoneLink.STALE_MS);
  const last = (S.requests || []).slice(-1)[0];
  return `${header(`<bdi>${esc(S.login.ward)}</bdi> · ${list.length} children`)}
    <div class="actions">
      <button id="askHis" class="${S.pc && S.pc.online ? 'primary' : ''}">⟳ Fetch from HIS (via a PC)</button>
      <button id="toBook">＋ Book a procedure</button>
      <button id="toTodo">☑ To do — everyone</button>
      <button id="toLabs">🧪 Request labs</button>
      <button id="askPdfs">📄 Today's handover + next day's orders and labs</button>
      <button id="toAlerts">🔔 Alerts${todaysAlerts().length ? ` (${todaysAlerts().length})` : ''}</button>
      <button id="toPin">🔑 Sign the main PC in to the HIS</button>
    </div>
    ${pending.length ? `<div class="note">Asked a PC for the HIS at ${new Date(pending[0].at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — waiting for it.</div>` : ''}
    ${last && last.status === 'failed' ? `<div class="note warn">The PC could not ${last.kind === 'pdfs' ? 'make the PDFs' : last.kind === 'signin' ? 'sign in' : 'fetch from the HIS'}: ${esc(last.reason)}</div>` : ''}
    ${fresh ? `<button class="note ok wide" id="toFetch">HIS results from ${esc(S.fetch.host)} are ready to review →</button>` : ''}
    <div class="cards">${list.map((p) => `<button class="card" data-pid="${esc(p.id)}">
      <div class="top"><span class="room">${p.room ? esc(p.room) : '—'}</span><bdi class="nm">${esc(p.name)}</bdi></div>
      <div class="meta">${esc(p.mrn || '')} · ${esc(Sheet.dayLabel(p, today()) || p.diagnosis || '')}</div>
      <div class="bdg">${badges(p).map(([k, t]) => `<span class="b b-${k}" dir="auto">${esc(t)}</span>`).join('')}</div>
    </button>`).join('') || '<p class="dim">No children on the ward.</p>'}</div>`;
}
function wardWire() {
  $('#signOut').onclick = signOut;
  $$('[data-pid]').forEach((b) => { b.onclick = () => route('patient', b.dataset.pid); });
  $('#toBook').onclick = () => route('book');
  $('#toTodo').onclick = () => route('todo');
  $('#toLabs').onclick = () => route('labs');
  $('#toAlerts').onclick = () => route('alerts');
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
function todoHtml() {
  const rows = patients().map((p) => ({ p, t: Ward.todoText(p, Ward.dayOf(readWard(p.id), today()), today(), readWard(p.id)) }));
  const has = rows.filter((r) => txt(r.t));
  return `${header('To do — everyone', true)}
    <div class="note">${has.length} of ${rows.length} children have something to do today.</div>
    <div class="cards">${has.map(({ p, t }) => `<button class="card" data-pid="${esc(p.id)}">
      <div class="top"><span class="room">${p.room ? esc(p.room) : '—'}</span><bdi class="nm">${esc(p.name)}</bdi></div>
      <ul class="list todo">${t.split('\n').filter((l) => txt(l)).map((l) => `<li dir="auto">☐ ${esc(l)}</li>`).join('')}</ul>
    </button>`).join('') || '<p class="dim pad">Nothing to do today for anyone.</p>'}</div>`;
}
function todoWire() {
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
    if (ok.some((o) => o.key === m.key)) return `<div class="meta">✓ requested: <b>${esc(m.label)}</b> <button class="x" data-sgun="${esc(p.id)}|${esc(m.key)}">✕</button></div>`;
    const s = sug.find((x) => x.key === m.key);
    const k = `${iso}|${p.id}|${m.key}`;
    const on = k in labsDraft ? labsDraft[k] : !!s;
    return `<label class="chk"><input type="checkbox" data-sg="${esc(p.id)}|${esc(m.key)}"${on ? ' checked' : ''}>
      <span>${esc(m.label)}${s ? ` <span class="dim small">— suggested: ${esc(s.why)}</span>` : ''}</span></label>`;
  };
  return `${header('Request labs', true)}
    <div class="actions">
      <button id="lbToday" class="${tmr ? '' : 'primary'}">Now — today</button>
      <button id="lbTomorrow" class="${tmr ? 'primary' : ''}">${esc(Ward.nextWorkLabel(today()))}</button>
    </div>
    ${tmr ? '<div class="note ok">Requesting for <b>tomorrow</b> — ordered from a ward PC (Order labs → next working day → Order in HIS), which sets that day as the HIS Schedule Date; the nurses\' paper is printed from there too (Print for nursing).</div>' : ''}
    <div class="note">The rules' suggestions are ticked already (a blood culture at the first fever and its follow-ups, the
      swabs and an INR on admission); tick or untick anything. Requested labs are ordered by a PC.</div>
    <div class="cards">${rows.map(({ p, sug, ok }) => `<div class="card">
      <div class="top"><span class="room">${p.room ? esc(p.room) : '—'}</span><bdi class="nm">${esc(p.name)}</bdi>
        ${sug.length ? `<span class="b b-warn">${sug.length} suggested</span>` : ''}${ok.length ? `<span class="b b-ok">${ok.length} requested</span>` : ''}</div>
      ${Ward.LAB_MENU.map((m) => item(p, m, sug, ok)).join('')}
    </div>`).join('') || '<p class="dim pad">No children on the ward.</p>'}</div>
    <div class="actions sticky"><button class="primary big" id="sgGo">Request the ticked labs</button></div>`;
}
function labsWire() {
  const iso = labsIso();
  $('#goBack').onclick = () => route('ward');
  $$('[data-sg]').forEach((c) => { c.onchange = () => { labsDraft[`${iso}|${c.dataset.sg}`] = c.checked; }; });
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
    if (!n) { toast('Nothing ticked'); return; }
    /* 13 November 2026: "a confirmation message for booking labs" — said once
       the ward file has them, read back */
    const when = iso === today() ? 'today' : 'tomorrow';
    changed();
    clearTimeout(pushTimer);
    render();
    sheet(`<div class="sheeticon">⏳</div><h3>Sending ${n} lab request(s) for ${when}…</h3>`, false);
    push().then(() => {
      syncBadge();
      sheet(`<div class="sheeticon ok">✓</div><h3>${n} lab request(s) for ${when} sent</h3>
        <p>Confirmed in the ward file at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
        ${S.main && S.main.online ? `The main PC (${esc(S.main.host)}) has them within a minute;` : 'The main PC is off — it takes them when it is on;'}
        they are ordered in the HIS from a ward PC (Order labs → Order in HIS).</p>`);
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
async function checkPhoneUpdate() {
  const mine = Number(window.NCI_PHONE_BUILD) || 0;
  const AI = apkInstaller();
  if (!AI || !mine || updLooking || !S.login) return;
  updLooking = true;
  try {
    const f = await google().drive.find(FOLDER, PHONE_APK);
    if (!f) return;
    const props = (await google().drive.meta(f.id)).properties || {};
    const latest = Number(props.build) || 0;
    if (!(latest > mine) || !props.sha256) return;
    const b64s = await withLoading(google().drive.bytes(f.id));
    const u8 = unb64(b64s);
    if ((await sha256Hex(u8)) !== props.sha256) return;          /* still uploading, or damaged: next look */
    const C = window.Capacitor;
    const FS = C.registerPlugin ? C.registerPlugin('Filesystem') : C.Plugins.Filesystem;
    const w = await FS.writeFile({ path: 'nci-orders-update.apk', data: b64s, directory: 'CACHE' });
    updateCountdown(latest, w.uri);
  } catch (e) { /* the next look tries again */ } finally { updLooking = false; }
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
const alertsList = () => ((S.data && S.data.alerts) || []).slice().reverse();
const todaysAlerts = () => alertsList().filter((a) => new Date(a.ms || 0).toISOString().slice(0, 10) === today());
const ICON = { labs: '🧪', culture: '🧫', fever: '🌡', afebrile: '✓' };
function alertsHtml() {
  const list = alertsList();
  return `${header('Alerts', true)}
    <div class="note">What the ward PC's round found new — labs, finalised cultures, fever, 24 hours without fever. The last three days.</div>
    <div class="pad"><ul class="list alerts">${list.map((a) => {
      const d = new Date(a.ms || 0);
      const when = `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      return `<li dir="auto"><span class="dim small">${esc(when)}</span> ${ICON[a.kind] || '•'} ${esc(a.text)}</li>`;
    }).join('') || '<li class="dim">Nothing yet.</li>'}</ul></div>`;
}
function alertsWire() { $('#goBack').onclick = () => route('ward'); }

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
function markSeen(ids) { try { localStorage.setItem(ALERT_SEEN, JSON.stringify(seenAlerts().concat(ids).slice(-400))); } catch (e) { /* shown again next time */ } }
function addAlertToHandover(a) {
  const p = ((S.data && S.data.patients) || []).find((x) => String(x.id) === String(a.pid));
  if (!p) return false;
  const st = editWard(p.id);
  const iso = today();
  const d = Ward.dayOf(st, iso);
  const field = a.kind === 'labs' ? 'labs' : 'clinically';
  let line = txt(a.text).replace(/^Room [^·]*·\s*/, '');
  if (line.indexOf(`${txt(p.name)}:`) === 0) line = txt(line.slice(txt(p.name).length + 1));
  if (txt(d[field]).indexOf(txt(line)) >= 0) return true;
  st.days = st.days || {};
  st.days[iso] = Object.assign(d, { [field]: txt(d[field]) ? `${txt(d[field])}\n${line}` : line });
  changed();
  return true;
}
function showNewAlerts() {
  if (!S.login || $('#alertBox')) return;
  const seen = seenAlerts();
  const day = Date.now() - 24 * 3600 * 1000;
  const fresh = alertsList().filter((a) => a && a.id && (a.ms || 0) >= day && seen.indexOf(a.id) < 0);
  if (!fresh.length) return;
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
  markSeen(fresh.map((a) => a.id));
  $$('[data-addho]', box).forEach((b) => { b.onclick = () => {
    const ok = addAlertToHandover(fresh[+b.dataset.addho]);
    b.disabled = true; b.textContent = ok ? '✓ Added to today\'s handover' : 'The child is not on the ward';
  }; });
  $('#alertOk', box).onclick = () => { box.remove(); render(); };
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
function waitFor(id, then, failed) {
  let n = 0;
  const t = setInterval(async () => {
    n++;
    try {
      const m = await google().drive.meta(await store().locate());
      if ((m.properties || {})[K().dn] === id || n > 24) {
        clearInterval(t);
        await pull();
        const r = (S.requests || []).find((x) => x.id === id);
        if (r && r.status === 'done' && then) await then(r);
        else if (r && r.status === 'done') { toast('HIS results are ready to review'); route('fetch'); }
        else if (failed) failed(r);
        else { toast(r && r.reason ? `The PC could not ${then ? 'make the PDFs' : 'fetch'}: ${r.reason}` : 'No answer from the PC'); render(); }
      }
    } catch (e) { if (n > 24) clearInterval(t); }
  }, 15000);
}

/* ── 3. one child's handover ── */
function labsView(st) {
  const dates = Object.keys(st.days || {}).filter((d) => txt((st.days[d] || {}).labs)).sort();
  const d = dates[dates.length - 1];
  if (!d) return '<p class="dim">No labs retrieved yet.</p>';
  return `<div class="dim small">${d === today() ? 'Today' : `Last retrieved ${esc(Ward.fullDate(d))}`}</div>
    <div class="labs">${Ward.redFlags(esc(Ward.tightCbc(st.days[d].labs))).replace(/\n/g, '<br>')}</div>`;
}
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
  const st = readWard(p.id);
  const iso = today();
  const d = Ward.dayOf(st, iso);
  const meds = txt(d.meds) || txt(d.medsAuto);
  const imaging = [['CT', st.ct], ['Echo', st.echo]].filter(([, x]) => txt(x.date) || txt(x.finding))
    .map(([l, x]) => ({ label: l, date: x.date, text: x.finding })).concat((st.moreImaging || []).map((x) => ({ label: x.label, date: x.date, text: x.finding })));
  /* the ward's order — swabs, blood by date, the rest — when this build's
     ward.js has it (Ward.cultureList, 7 November 2026) */
  const cultures = Ward.cultureList ? Ward.cultureList(st).map((x) => ({ label: x.label, date: x.date, text: x.result, final: x.final }))
    : [['Rectal swab', st.rectal], ['Blood culture', st.blood]].filter(([, x]) => txt(x.date) || txt(x.result))
      .map(([l, x]) => ({ label: l, date: x.date, text: x.result })).concat((st.moreCultures || []).map((x) => ({ label: x.label, date: x.date, text: x.result })));
  /* "always write chemo in the to do" — shown above the box, as on the PC */
  const chemoTodo = (Ward.chemoTodoFor ? Ward.chemoTodoFor(p, iso) : []).concat(Ward.cultureTodoFor ? Ward.cultureTodoFor(readWard(p.id), iso) : []);
  const past = Object.keys(st.days || {}).filter((k) => k < iso).sort().reverse()
    .filter((k) => txt(st.days[k].clinically) || txt(st.days[k].labs) || txt(st.days[k].todo)).slice(0, 7);
  const ol = orderLines(p);
  const item = (x) => `<li${x.final ? ' class="final"' : ''}><b>${esc(x.label)}</b>${x.date ? ` <span class="dim">${esc(Ward.fullDate(x.date))}</span>` : ''}${x.text ? ` — ${esc(x.text)}` : ''}${x.final ? ' <span class="b b-alarm">Finalised — check HIS</span>' : ''}</li>`;
  return `${header(`<bdi>${esc(p.name)}</bdi>`, true)}
    <div class="pt">
      <div class="meta">Room ${esc(p.room || '—')} · ${esc(p.mrn || '')} · ${esc(p.diagnosis || '')}</div>
      <div class="meta"><b>${esc(Sheet.dayLabel(p, iso) || '')}</b> · ${p.weight ? `${esc(p.weight)} kg` : 'no weight'}${p.height ? ` · ${esc(p.height)} cm` : ''}</div>
      ${txt(st.summary) ? `<div class="sum" dir="auto">${esc(st.summary)}</div>` : ''}
    </div>
    <section><h3>Labs</h3>${labsView(st)}</section>
    ${/* 7 November 2026: "recover fever of the last week and show a chart
         for review, on both windows and android" */''}
    ${Ward.feverChartSvg ? `<section><h3>Temperature — last 7 days</h3>${Ward.feverChartSvg(st.temps || [], null, { w: 400, h: 200 })}</section>` : ''}
    <section><h3>Clinically — today</h3>
      <textarea id="fClin" dir="auto" rows="4" placeholder="Today's clinical notes">${esc(d.clinically)}</textarea></section>
    <section><h3>To do</h3>
      ${chemoTodo.length ? `<div class="bdg">${chemoTodo.map((t) => `<span class="b b-today">${esc(t)}</span>`).join('')}</div>` : ''}
      <textarea id="fTodo" dir="auto" rows="3" placeholder="To do">${esc(d.todo)}</textarea></section>
    <section><h3>Medications today</h3>${meds ? `<div class="pre" dir="auto">${esc(meds)}</div>` : '<p class="dim">From the orders, once written.</p>'}</section>
    <section><h3>Orders <span class="dim">(${ol.length})</span></h3>
      ${(() => { const a = Ward.gcsfAdvice ? Ward.gcsfAdvice(p, ((S.data.orders || {})[String(p.id)]) || {}, S.data.drugs, d.labs) : null;
    return a ? `<div class="note warn">${esc(a.text)} — a suggestion; nothing is changed until you take it off.</div>` : ''; })()}
      ${(() => { const a = Ward.feverAdvice ? Ward.feverAdvice(readWard(p.id), ((S.data.orders || {})[String(p.id)]) || {}, S.data.drugs) : null;
    return a ? `<div class="note warn">${esc(a.text)} — a suggestion; nothing is ordered or booked.</div>` : ''; })()}
      <ul class="orders">${ol.map((x) => `<li><span dir="rtl">${esc(x.line || x.d.ar_name || x.d.name_en)}</span>
        <button class="x" data-unorder="${esc(x.d.id)}" title="Take off the order">✕</button></li>`).join('') || '<li class="dim">Nothing ordered yet.</li>'}</ul>
      <input id="drugQ" placeholder="Add a drug — type its name" autocomplete="off">
      <div id="drugHits" class="hits"></div>
      <p class="dim small">Doses and details left blank are completed on the PC before printing.</p></section>
    <section><h3>Imaging</h3><ul class="list">${imaging.map(item).join('') || '<li class="dim">None.</li>'}</ul>
      ${addForm('img', Ward.IMAGING_KINDS, 'Finding')}</section>
    <section><h3>Cultures &amp; swabs</h3><ul class="list">${cultures.map(item).join('') || '<li class="dim">None.</li>'}</ul>
      ${addForm('cul', Ward.CULTURE_KINDS, 'Result')}</section>
    ${past.length ? `<section><h3>Earlier days</h3>${past.map((k) => `<details><summary>${esc(Ward.fullDate(k))}</summary>
      ${txt(st.days[k].labs) ? `<div class="labs">${Ward.redFlags(esc(Ward.tightCbc(st.days[k].labs))).replace(/\n/g, '<br>')}</div>` : ''}
      ${txt(st.days[k].clinically) ? `<div class="pre" dir="auto">${esc(st.days[k].clinically)}</div>` : ''}
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
  const iso = today();
  const setDay = (field, v) => { const st = editWard(p.id); st.days[iso] = Object.assign(Ward.dayOf(st, iso), { [field]: v }); changed(); };
  $('#fClin').oninput = (e) => setDay('clinically', e.target.value);
  $('#fTodo').oninput = (e) => setDay('todo', e.target.value);
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
    ${f.moves && f.moves.gone && f.moves.gone.length ? `<div class="note warn">No longer on the ward in the HIS: ${f.moves.gone.map((x) => `<bdi>${esc(x.name)}</bdi>`).join(', ')} — discharge them on a PC.</div>` : ''}
    ${f.moves && f.moves.fresh && f.moves.fresh.length ? `<div class="note">New in the HIS, not on the handover: ${f.moves.fresh.map((x) => `<bdi>${esc(x.name)}</bdi>`).join(', ')} — admit them on a PC.</div>` : ''}
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
  /* 11 November 2026: "Sync phone app on opening" — the ward's file is
     brought in each time the app opens or comes back to the front (what
     the phone has not uploaded yet is added in first) */
  const syncNow = () => {
    if (!S.login) return;
    if (typing()) { heldBack = true; return; }
    pull().then(() => { if (!typing()) render(); syncBadge(); }).catch((e) => { syncBadge(e); if (!offline(e)) toast(e.message); }).then(look).then(showNewAlerts);
  };
  syncNow();
  setInterval(look, 60 * 1000);
  /* 13 November 2026: the phone's own update — a look shortly after opening, then every six hours */
  setTimeout(() => { checkPhoneUpdate(); }, 20 * 1000);
  setInterval(() => { checkPhoneUpdate(); }, 6 * 60 * 60 * 1000);
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
window.NciPhone = { get state() { return S; }, route, look, pull, push, phoneBack, showNewAlerts, addAlertToHandover, savePdf, askPdfs, sheet, sealPin, b64, unb64, loading, checkPhoneUpdate, updateCountdown };
})();
