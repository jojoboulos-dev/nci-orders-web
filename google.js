'use strict';
/* ══════════════════════════════════════════════════════════════════
 * GOOGLE, FROM THE PHONE
 *
 * The phone's copy of sheetswrite.js: the same service account and key
 * ("we'll use the same service account with the same key"), the same Drive
 * and Sheets calls, signed with the browser's own crypto instead of Node's.
 * Only what the phone needs: the ward file (find, read, write, its small
 * labels) and appending a booking to the procedures sheet. The row
 * layout — alignRow, likeSheet, fold — is sheetswrite.js's, word for word;
 * tools/check_mobile.js holds the two to the same answers.
 * ══════════════════════════════════════════════════════════════════ */
(function () {

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

const txt = (v) => (v == null ? '' : String(v)).trim();
const b64url = (bytes) => {
  let s = '';
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
};
const b64urlText = (t) => b64url(new TextEncoder().encode(t));

async function signer(pem) {
  const body = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}
async function makeJwt(key, cryptoKey, nowSec) {
  const now = Math.floor(nowSec == null ? Date.now() / 1000 : nowSec);
  const head = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64urlText(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(`${head}.${claim}`));
  return `${head}.${claim}.${b64url(sig)}`;
}

/* ── sheetswrite.js's row layout, unchanged ── */
const fold = (h) => txt(h).toLowerCase()
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/[ى]/g, 'ي').replace(/[ة]/g, 'ه')
  .replace(/[^a-z0-9؀-ۿ]/g, '');
function alignRow(headers, fields, dateKeys) {
  const want = {};
  Object.keys(fields || {}).forEach((k) => { want[fold(k)] = fields[k]; });
  const dates = new Set((dateKeys || []).map(fold));
  const row = (headers || []).map((h) => {
    const f = fold(h);
    const v = txt(want[f]);
    if (!v) return '';
    return dates.has(f) ? v : `'${v}`;
  });
  while (row.length && row[row.length - 1] === '') row.pop();
  return row;
}
function likeSheet(values, heading, iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(txt(iso));
  if (!m) return txt(iso);
  const head = (values && values[0]) || [];
  const ci = head.findIndex((h) => fold(h) === fold(heading));
  let dayFirst = false, monthFirst = false, slashes = false;
  for (let i = 1; ci >= 0 && i < (values || []).length; i++) {
    const d = /^(\d{1,2})\/(\d{1,2})\/\d{4}/.exec(txt((values[i] || [])[ci]));
    if (!d) continue;
    slashes = true;
    if (+d[1] > 12) dayFirst = true;
    if (+d[2] > 12) monthFirst = true;
  }
  if (!slashes) return m[4] ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] || '00'}` : `${m[1]}-${m[2]}-${m[3]}`;
  const D = +m[3], M = +m[2];
  const date = dayFirst && !monthFirst ? `${D}/${M}/${m[1]}` : `${M}/${D}/${m[1]}`;
  return m[4] ? `${date} ${+m[4]}:${m[5]}:${m[6] || '00'}` : date;
}

function client(key, fetchImpl) {
  const go = fetchImpl || ((u, o) => fetch(u, o));
  let token = null;
  let until = 0;
  let ck = null;
  const fail = (status, msg) => { const e = new Error(`Google answered ${status}: ${msg}`); e.status = status; return e; };
  /* 8 November 2026: "google answered 400, invalid JWT" — a phone whose
     clock is off; stamped again by Google's clock (its Date header) once */
  let skew = 0;
  const auth = async () => {
    if (key && typeof key.getToken === 'function') return key.getToken();
    if (token && Date.now() < until - 60000) return token;
    if (!ck) ck = await signer(key.private_key);
    const once = async () => {
      const r0 = await go(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(await makeJwt(key, ck, Math.floor(Date.now() / 1000) + skew))}` });
      const t0 = await r0.text();
      let j0 = {};
      try { j0 = JSON.parse(t0); } catch (e) { /* as it came */ }
      return { r: r0, t: t0, j: j0 };
    };
    let { r, t, j } = await once();
    const why = () => String((j && (j.error_description || j.error)) || t || '');
    if (!r.ok && /jwt|grant/i.test(why()) && !/signature/i.test(why())) {
      const g = Date.parse((r.headers && r.headers.get && r.headers.get('date')) || '');
      if (Number.isFinite(g)) { skew = Math.round((g - Date.now()) / 1000); ({ r, t, j } = await once()); }
    }
    if (!r.ok) throw fail(r.status, `${why()}${Math.abs(skew) > 120 ? ` — this phone's clock is ${Math.round(Math.abs(skew) / 60)} minutes off; set the date and time to automatic` : ''}`);
    token = j.access_token;
    until = Date.now() + (Number(j.expires_in) || 3600) * 1000;
    return token;
  };
  const raw = async (url, opts) => {
    const r = await go(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: `Bearer ${await auth()}` }, (opts && opts.headers) || {}) }));
    const body = await r.text();
    if (!r.ok) {
      let msg = body;
      try { msg = JSON.parse(body).error.message; } catch (e) { /* as it came */ }
      throw fail(r.status, msg);
    }
    return body;
  };
  const api = async (path, method, body) => JSON.parse(await raw(`${API}/${path}`, { method: method || 'GET',
    headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }) || '{}');

  const drive = {
    async find(folder, name) {
      const q = `'${folder}' in parents and name = '${String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and trashed = false`;
      const j = JSON.parse(await raw(`${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`, { method: 'GET' }));
      return (j.files || [])[0] || null;
    },
    async read(id) { return raw(`${DRIVE}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { method: 'GET' }); },
    /* a file's bytes (a PDF), as base64 */
    async bytes(id) {
      const r = await go(`${DRIVE}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { method: 'GET', headers: { Authorization: `Bearer ${await auth()}` } });
      if (!r.ok) throw fail(r.status, await r.text());
      const u8 = new Uint8Array(await r.arrayBuffer());
      let bin = '';
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    async write(id, text) {
      await raw(`${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&supportsAllDrives=true`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text });
      return id;
    },
    async meta(id) { return JSON.parse(await raw(`${DRIVE}/${encodeURIComponent(id)}?fields=modifiedTime,properties&supportsAllDrives=true`, { method: 'GET' })); },
    async setProps(id, props) {
      await raw(`${DRIVE}/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ properties: props }) });
    },
  };
  const q = (title) => encodeURIComponent(`'${String(title).replace(/'/g, "''")}'`);
  return {
    drive,
    async append(link, fields, dateKeys) {
      const j = await api(`${encodeURIComponent(link.id)}?fields=sheets.properties(sheetId,title)`);
      const tabs = (j.sheets || []).map((s) => s.properties);
      const tab = (link.gid && tabs.find((p) => String(p.sheetId) === String(link.gid))) || tabs[0];
      if (!tab) throw new Error('The sheet has no tabs.');
      const values = (await api(`${encodeURIComponent(link.id)}/values/${q(tab.title)}?valueRenderOption=FORMATTED_VALUE`)).values || [];
      const f = Object.assign({}, fields);
      (dateKeys || []).forEach((k) => { if (f[k]) f[k] = likeSheet(values, k, f[k]); });
      const row = alignRow(values[0] || [], f, dateKeys);
      if (!row.length) throw new Error('None of the sheet\'s headings matched the form.');
      await api(`${encodeURIComponent(link.id)}/values/${q(tab.title)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        'POST', { values: [row] });
      return { ok: true, tab: tab.title };
    },
  };
}

const GClient = { client, alignRow, likeSheet, fold, makeJwt, signer };
if (typeof window !== 'undefined') window.GClient = GClient;
if (typeof module !== 'undefined') module.exports = GClient;
})();
