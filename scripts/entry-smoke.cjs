// Runs the actual auth-entry function in isolation: no secrets or live services.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const start = html.indexOf('async function initAuth() {');
const end = html.indexOf('\nfunction showAuthScreen()', start);
assert.ok(start > 0 && end > start);
const source = html.slice(start, end);
async function check(url, options = {}) {
  const calls = [];
  const location = new URL(url, 'https://conver.test');
  location.replace = target => calls.push(['redirect', target]);
  const context = {
    URLSearchParams, window: {location}, authToken: null, currentUser: null,
    checkEmailVerification: async () => !!options.verified,
    localStorage: {getItem: () => options.token || null, removeItem: () => {}},
    setAuthToken(token) { context.authToken = token; },
    sbClient: {auth: {getSession: async () => ({data: {session: options.session || null}})}},
    fetch: async () => {calls.push(['profile']);return {ok:true};},
    loadUserData: async () => calls.push(['data']),
    applyAvatarPhoto: () => calls.push(['avatar']),
    afterSignIn: async () => calls.push(['restore']),
    showAuthScreen: () => calls.push(['auth']),
    showView: view => calls.push(['view', view])
  };
  vm.createContext(context);
  await vm.runInContext(source + '\ninitAuth()', context);
  return calls;
}
(async () => {
  for (const url of ['/', '/app', '/index.html', '/app?auth=unknown']) {
    assert.deepEqual(await check(url), [['redirect', '/landing.html']]);
  }
  for (const view of ['signin', 'signup']) {
    assert.deepEqual(await check('/app?auth=' + view), [['auth'], ['view', view]]);
  }
  assert.deepEqual(await check('/app', {session:{access_token:'fixture',user:{id:'fixture'}}}), [['restore']]);
  assert.deepEqual(await check('/app', {token:'fixture'}), [['profile'],['data'],['avatar']]);
  assert.deepEqual(await check('/app#access_token=fixture', {verified:true}), []);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(config.rewrites.find(route => route.source === '/').destination, '/landing.html');
  assert.equal(config.rewrites.find(route => route.source === '/app').destination, '/index.html');
  assert.ok(config.rewrites.every(route => !route.source.startsWith('/api')));
  console.log('12 entry checks passed: intro, explicit auth, invalid query, saved session, OAuth token, verification callback, Vercel paths, API routes untouched.');
})().catch(error => {console.error(error);process.exitCode=1;});
