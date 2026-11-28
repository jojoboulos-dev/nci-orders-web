'use strict';
/* ══════════════════════════════════════════════════════════════════
 * THE NEW SERVER, ON THE PHONE (the same as supabase.js on a computer)
 *
 * 25 November 2026, Dr Boulos: "do everything now, EVERYTHING". The phone reads the ward's copy from the new server
 * and sends what is typed there as notes — sealed on the phone with the ward's key, exactly as a computer seals them
 * (PBKDF2-SHA256 for the two secrets the ward's password gives, AES-256-GCM, gzip), so a computer opens what a phone
 * sends and the other way round. The password itself is never kept: only the two secrets.
 * ══════════════════════════════════════════════════════════════════ */
(function () {
const URL0 = 'https://uimyjsadxgujsluegejb.supabase.co';
const KEY = 'sb_publishable_3jgTQxOEQIirbShQo7AVww_VkzxBa-W';
const ROUNDS = 210000;
const enc = new TextEncoder();
const subtle = () => (window.crypto && window.crypto.subtle);
const b64 = (u8) => { let s = ''; const a = new Uint8Array(u8); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => { const t = atob(String(s || '')); const a = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; };
const b64url = (u8) => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const wardId = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
const emailOf = (k) => `${wardId(k)}@nci-orders.app`;

async function pbkdf2(password, salt) {
  const base = await subtle().importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ROUNDS }, base, 256));
}
async function secrets(wardKey, password) {
  const w = wardId(wardKey);
  return { ward: w, auth: b64url(await pbkdf2(password, `nci-orders/auth/${w}`)), lock: b64(await pbkdf2(password, `nci-orders/lock/${w}`)) };
}
const aes = (raw, use) => subtle().importKey('raw', raw, 'AES-GCM', false, [use]);
async function seal(rawKey, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, await aes(rawKey, 'encrypt'), bytes);
  return { iv: b64(iv), ciphertext: b64(ct) };
}
async function open(rawKey, iv, ciphertext) {
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aes(rawKey, 'decrypt'), unb64(ciphertext)));
}
async function gz(bytes, how) {
  const s = new Blob([bytes]).stream().pipeThrough(how === 'in' ? new CompressionStream('gzip') : new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function sealData(rawKey, data) { return seal(rawKey, await gz(enc.encode(JSON.stringify(data || {})), 'in')); }
async function openData(rawKey, iv, ciphertext) { return JSON.parse(new TextDecoder().decode(await gz(await open(rawKey, iv, ciphertext), 'out'))); }

async function call(method, path, body, token, extra) {
  const headers = Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {}, extra || {});
  const res = await fetch(`${URL0}${path}`, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
  if (!res.ok) {
    const e = new Error(String((json && (json.msg || json.message || json.error_description || json.error)) || `HTTP ${res.status}`).slice(0, 200));
    e.status = res.status;
    throw e;
  }
  return json;
}
/* signed in, the ward's key opened. A phone never claims a ward or makes its key: only a computer does. */
let cache = null;
async function connect(sec) {
  if (cache && cache.ward === sec.ward && Date.now() - cache.at < 40 * 60000) return cache;
  let s;
  try { s = await call('POST', '/auth/v1/token?grant_type=password', { email: emailOf(sec.ward), password: sec.auth }); } catch (e) {
    if (e.status === 400) { const x = new Error('The ward\'s password does not open the new server (changed on a computer?) — type it again.'); x.reask = true; throw x; }
    throw e;
  }
  const uid = s.user && s.user.id;
  const keys = await call('GET', `/rest/v1/ward_keys?ward_id=eq.${encodeURIComponent(sec.ward)}&user_id=eq.${uid}&select=wrapped`, null, s.access_token);
  if (!keys.length) throw new Error('This ward is not on the new server yet — its main PC has to move first.');
  const [iv, ct] = String(keys[0].wrapped).split('.');
  let dataKey;
  try { dataKey = await open(unb64(sec.lock), iv, ct); } catch (e) { const x = new Error('The ward\'s key does not open with this password — type it again.'); x.reask = true; throw x; }
  cache = { ward: sec.ward, token: s.access_token, uid, dataKey, at: Date.now() };
  return cache;
}
async function pull(c) {
  const rows = await call('GET', `/rest/v1/ward_data?ward_id=eq.${encodeURIComponent(c.ward)}&select=version,iv,ciphertext,updated_at`, null, c.token);
  if (!rows.length) return null;
  return { data: await openData(c.dataKey, rows[0].iv, rows[0].ciphertext), version: rows[0].version, at: rows[0].updated_at };
}
async function waiting(c) {
  const rows = await call('GET', `/rest/v1/ward_notes?ward_id=eq.${encodeURIComponent(c.ward)}&select=id,iv,ciphertext&order=created_at.asc`, null, c.token);
  const out = [];
  for (const r of rows) { try { out.push(Object.assign(await openData(c.dataKey, r.iv, r.ciphertext), { id: r.id })); } catch (e) { /* not this key */ } }
  return out;
}
async function sendNotes(c, notes) {
  const rows = [];
  for (const n of notes || []) rows.push(Object.assign({ id: String(n.id).slice(0, 64), ward_id: c.ward }, await sealData(c.dataKey, n)));
  if (!rows.length) return [];
  await call('POST', '/rest/v1/ward_notes', rows, c.token, { Prefer: 'return=minimal,resolution=ignore-duplicates' });
  const ids = rows.map((r) => `"${r.id}"`).join(',');
  const back = await call('GET', `/rest/v1/ward_notes?ward_id=eq.${encodeURIComponent(c.ward)}&id=in.(${ids})&select=id`, null, c.token);
  return back.map((r) => r.id);
}
/* the phone's secrets, kept in its own storage (never the password) */
const KEEP = 'nci-sb';
const mine = () => { try { const j = JSON.parse(localStorage.getItem(KEEP) || 'null'); return j && j.ward && j.auth && j.lock ? j : null; } catch (e) { return null; } };
const keepMine = (s) => { try { if (s) localStorage.setItem(KEEP, JSON.stringify(s)); else localStorage.removeItem(KEEP); } catch (e) { /* asked again */ } cache = null; };

/* ── STAFF (25 November 2026, "do everything now, EVERYTHING") ──
   The staff sign-in (staff@nci-orders.app, a secret from the staff password) reads every ward and writes none. Its own
   key pair, made here the first time once the developer has made the sign-in staff: the public half for the wards'
   main PCs to lock their keys with; the private half sealed with a key from the staff password. */
const STAFF_KEEP = 'nci-sb-staff';
const staffMine = () => { try { const j = JSON.parse(localStorage.getItem(STAFF_KEEP) || 'null'); return j && j.auth && j.lock ? j : null; } catch (e) { return null; } };
const keepStaff = (s) => { try { if (s) localStorage.setItem(STAFF_KEEP, JSON.stringify(s)); else localStorage.removeItem(STAFF_KEEP); } catch (e) { /* asked again */ } staffCache = null; };
let staffCache = null;
async function staffConnect(sec) {
  if (staffCache && Date.now() - staffCache.at < 40 * 60000) return staffCache;
  const email = emailOf('staff');
  let s;
  try { s = await call('POST', '/auth/v1/token?grant_type=password', { email, password: sec.auth }); } catch (e) {
    if (e.status !== 400) throw e;
    try { s = await call('POST', '/auth/v1/signup', { email, password: sec.auth }); } catch (e2) {
      const x = new Error(/already/i.test(e2.message) ? 'The staff password does not open the new server — type it again, or ask the developer to reset the staff sign-in.' : e2.message); x.reask = true; throw x;
    }
  }
  const token = s.access_token;
  const uid = s.user && s.user.id;
  const me = await call('GET', `/rest/v1/staff?user_id=eq.${uid}&select=user_id`, null, token);
  if (!me.length) { const x = new Error('The staff sign-in is made on the new server — waiting for the developer to approve it.'); x.pending = true; throw x; }
  let priv;
  const sealed = await call('GET', `/rest/v1/staff_priv?user_id=eq.${uid}&select=enc_priv`, null, token);
  if (sealed.length) {
    const [iv, ct] = String(sealed[0].enc_priv).split('.');
    const pk = await open(unb64(sec.lock), iv, ct);
    priv = await subtle().importKey('pkcs8', pk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  } else {
    const pair = await subtle().generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
    const spki = new Uint8Array(await subtle().exportKey('spki', pair.publicKey));
    const pk = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
    const w = await seal(unb64(sec.lock), pk);
    await call('POST', '/rest/v1/staff_priv', { user_id: uid, enc_priv: `${w.iv}.${w.ciphertext}` }, token, { Prefer: 'return=minimal' });
    await call('POST', '/rest/v1/staff_pub', { user_id: uid, pub: b64(spki) }, token, { Prefer: 'return=minimal' });
    priv = pair.privateKey;
  }
  staffCache = { uid, token, priv, at: Date.now() };
  return staffCache;
}
/* one ward's copy, for staff: its key unlocked with the staff private half (once that ward's main PC has locked it) */
async function staffWard(sec, wardKey) {
  const c = await staffConnect(sec);
  const w = wardId(wardKey);
  const keys = await call('GET', `/rest/v1/ward_keys?ward_id=eq.${encodeURIComponent(w)}&user_id=eq.${c.uid}&select=wrapped`, null, c.token);
  if (!keys.length || !/^rsa\./.test(keys[0].wrapped)) return null;
  const dataKey = new Uint8Array(await subtle().decrypt({ name: 'RSA-OAEP' }, c.priv, unb64(keys[0].wrapped.slice(4))));
  return pull({ ward: w, token: c.token, dataKey });
}

async function getBox(c, name) {
  const rows = await call('GET', `/rest/v1/ward_box?ward_id=eq.${encodeURIComponent(c.ward)}&name=eq.${encodeURIComponent(name)}&select=iv,ciphertext`, null, c.token);
  return rows.length ? openData(c.dataKey, rows[0].iv, rows[0].ciphertext) : null;
}
/* 25 November 2026, Dr Boulos: "1 yes" — the ward's entry (what its Drive entry held, without the data), sealed, one
   row, `version` moving on each write; what the approved wards share (the physicians' sealed HIS sign-ins) */
async function wardExists(wardKey) { return !!(await call('POST', '/rest/v1/rpc/ward_exists', { w: wardId(wardKey) })); }
async function getEntry(c) {
  const rows = await call('GET', `/rest/v1/ward_entry?ward_id=eq.${encodeURIComponent(c.ward)}&select=version,iv,ciphertext`, null, c.token);
  return rows.length ? { version: Number(rows[0].version) || 1, entry: await openData(c.dataKey, rows[0].iv, rows[0].ciphertext) } : null;
}
async function updateEntry(c, fn, tries) {
  for (let i = 0; i < (tries || 6); i++) {
    const cur = await getEntry(c);
    if (!cur) return { error: 'ward-missing' };
    const r = fn(cur.entry);
    if (!r || r.error) return r || { error: 'nothing' };
    const s = await sealData(c.dataKey, r.entry);
    const rows = await call('PATCH', `/rest/v1/ward_entry?ward_id=eq.${encodeURIComponent(c.ward)}&version=eq.${cur.version}`,
      { version: cur.version + 1, iv: s.iv, ciphertext: s.ciphertext, updated_at: new Date().toISOString() }, c.token, { Prefer: 'return=representation' });
    if (Array.isArray(rows) && rows.length === 1) return Object.assign({ ok: true }, r);
  }
  return { error: 'busy' };
}
async function getShared(c, name) {
  const rows = await call('GET', `/rest/v1/shared?name=eq.${encodeURIComponent(name)}&select=version,body`, null, c.token);
  return rows.length ? { version: Number(rows[0].version) || 1, body: rows[0].body || {} } : null;
}
async function updateShared(c, name, fn, tries) {
  for (let i = 0; i < (tries || 6); i++) {
    const cur = await getShared(c, name);
    if (!cur) return { error: 'not on the new server' };
    const next = fn(JSON.parse(JSON.stringify(cur.body)));
    if (!next || next.error) return next || { error: 'nothing' };
    const rows = await call('PATCH', `/rest/v1/shared?name=eq.${encodeURIComponent(name)}&version=eq.${cur.version}`,
      { version: cur.version + 1, body: next, updated_at: new Date().toISOString() }, c.token, { Prefer: 'return=representation' });
    if (Array.isArray(rows) && rows.length === 1) return { ok: true };
  }
  return { error: 'busy' };
}
/* known once seen: a phone that knows its ward's entry is on the new server never falls back to Drive for it */
const ENTRY_KEEP = 'nci-sb-entry';
const entryKnown = () => { try { const m = mine(); return !!m && localStorage.getItem(ENTRY_KEEP) === m.ward; } catch (e) { return false; } };
const entryMark = (w) => { try { if (w) localStorage.setItem(ENTRY_KEEP, w); else localStorage.removeItem(ENTRY_KEEP); } catch (e) { /* asked again */ } };
window.Supa = { wardExists, getEntry, updateEntry, getShared, updateShared, entryKnown, entryMark, getBox, staffMine, keepStaff, staffConnect, staffWard, wardId, emailOf, secrets, sealData, openData, connect, pull, waiting, sendNotes, mine, keepMine };
})();
