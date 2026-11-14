'use strict';
/* ══════════════════════════════════════════════════════════════════
 * THE WEB APP'S GOOGLE SIGN-IN (iPhone, option A)
 *
 * Dr Boulos, 8 November 2026: "lets build the webapp with the google login
 * thing". The web copy of the phone app carries no service-account key:
 * each doctor signs in with their own Google account (Google Identity
 * Services, in the browser), and reaches the ward file because the NCI
 * ORDERS folder is shared with them. Then the ward's name and password, as
 * on the Android app.
 *
 * Only on the web copy (build-www.js --web writes web-config.js with the
 * OAuth client ID). The token lives in this tab's memory and in
 * sessionStorage for an hour at most — Google's own lifetime — and is never
 * written anywhere else.
 * ══════════════════════════════════════════════════════════════════ */
(function () {

const SCOPE = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets openid email';
const SS = 'nci-web-token';
const GIS = 'https://accounts.google.com/gsi/client';

let tok = null;          /* { access, until, email } */
let tc = null;           /* Google's token client */
let gisLoad = null;

try { const j = JSON.parse(sessionStorage.getItem(SS) || 'null'); if (j && j.until > Date.now() + 60000) tok = j; } catch (e) { /* none */ }

function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (gisLoad) return gisLoad;
  gisLoad = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = GIS; s.async = true;
    s.onload = () => ok();
    s.onerror = () => { gisLoad = null; no(new Error('Google sign-in could not be loaded — check the internet.')); };
    document.head.appendChild(s);
  });
  return gisLoad;
}

const clientId = () => (window.NCI_WEB && window.NCI_WEB.clientId) || '';

/* ask Google for a token; interactive the first time (a button press),
   silent after while the browser is still signed in to Google */
async function ask() {
  if (!clientId()) throw new Error('The web app is not set up yet: it has no Google sign-in client.');
  await loadGis();
  return new Promise((ok, no) => {
    const hint = (tok && tok.email) || (localStorage.getItem('nci-web-email') || '');
    tc = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPE,
      hint: hint || undefined,
      callback: async (r) => {
        if (!r || r.error || !r.access_token) { no(new Error(r && r.error_description || r && r.error || 'Google sign-in was cancelled.')); return; }
        if (window.google.accounts.oauth2.hasGrantedAllScopes
          && !window.google.accounts.oauth2.hasGrantedAllScopes(r, 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets')) {
          no(new Error('Google Drive and Sheets must both be allowed for the ward file to open.'));
          return;
        }
        let email = hint;
        try {
          const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${r.access_token}` } });
          if (u.ok) email = (await u.json()).email || email;
        } catch (e) { /* the name is only a courtesy */ }
        tok = { access: r.access_token, until: Date.now() + (Number(r.expires_in) || 3600) * 1000, email };
        try { sessionStorage.setItem(SS, JSON.stringify(tok)); localStorage.setItem('nci-web-email', email || ''); } catch (e) { /* private mode */ }
        ok(tok.access);
      },
      error_callback: (e) => no(new Error(e && e.type === 'popup_closed' ? 'Google sign-in was closed before it finished.'
        : e && e.type === 'popup_failed_to_open' ? 'The browser blocked Google\'s sign-in window — allow pop-ups for this page.'
          : 'Google sign-in did not finish.')),
    });
    tc.requestAccessToken({ prompt: hint ? '' : 'select_account' });
  });
}

/* what google.js calls before each request. Google's sign-in window may
   open only from a tap (Safari blocks it otherwise), so an expired hour is
   not renewed here: the app shows "Reconnect Google" and the tap renews it. */
async function token() {
  if (tok && Date.now() < tok.until - 60000) return tok.access;
  const e = new Error('Google sign-in has expired — tap "Reconnect Google".');
  e.googleSignIn = true;
  throw e;
}

function signedIn() { return !!(tok && Date.now() < tok.until - 60000); }
function email() { return (tok && tok.email) || localStorage.getItem('nci-web-email') || ''; }
function signOut() {
  const t = tok && tok.access;
  tok = null;
  try { sessionStorage.removeItem(SS); } catch (e) { /* none */ }
  if (t && window.google && window.google.accounts && window.google.accounts.oauth2) {
    try { window.google.accounts.oauth2.revoke(t, () => {}); } catch (e) { /* gone already */ }
  }
}

window.NciWebLogin = { token, ask, signedIn, email, signOut, clientId };
})();
