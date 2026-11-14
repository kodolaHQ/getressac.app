import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInvite, verifyTurnstile, handleInvite } from '../src/invite.js';

const form = (fields) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

const full = { email: 'a@b.co', origin: 'arc', chip: 'm3', memory: '16', hope: 'tabs', lang: 'fr' };

const fakeDb = () => {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return { bind: (...args) => ({ run: async () => { calls.push({ sql, args }); return { success: true }; } }) };
    },
  };
};

const fetchOk = (success) => async () => Response.json({ success });
const fetchThrows = async () => { throw new Error('network down'); };

const post = (fields, headers = {}) =>
  new Request('https://getressac.app/api/invite', { method: 'POST', body: form(fields), headers });

const run = (fields, { success = true, fetchImpl, headers } = {}) => {
  const db = fakeDb();
  const env = { DB: db, TURNSTILE_SECRET: 'secret' };
  const res = handleInvite({
    request: post(fields, headers),
    env,
    fetchImpl: fetchImpl ?? fetchOk(success),
    now: '2026-11-14T10:00:00.000Z',
  });
  return res.then((r) => ({ res: r, db }));
};

test('parseInvite accepts a full form', () => {
  assert.deepEqual(parseInvite(form(full)), {
    ok: true,
    invite: { email: 'a@b.co', origin: 'arc', chip: 'm3', memory: 16, hope: 'tabs', lang: 'fr' },
  });
});

test('parseInvite normalises email', () => {
  const r = parseInvite(form({ ...full, email: ' A@B.Co ' }));
  assert.equal(r.invite.email, 'a@b.co');
});

test('parseInvite rejects bad email', () => {
  for (const email of ['nope', '', 'a@b', 'a b@c.co', `${'a'.repeat(250)}@b.co`]) {
    assert.deepEqual(parseInvite(form({ ...full, email })), { ok: false, error: 'email' }, email);
  }
});

test('parseInvite rejects unknown origin', () => {
  assert.deepEqual(parseInvite(form({ ...full, origin: 'chrome' })), { ok: false, error: 'origin' });
  const { origin, ...noOrigin } = full;
  assert.deepEqual(parseInvite(form(noOrigin)), { ok: false, error: 'origin' });
});

test('parseInvite rejects out-of-list chip, memory, lang and long hope', () => {
  for (const bad of [{ chip: 'm9' }, { memory: '12' }, { lang: 'de' }, { hope: 'x'.repeat(281) }]) {
    assert.deepEqual(parseInvite(form({ ...full, ...bad })), { ok: false, error: 'field' }, JSON.stringify(bad));
  }
});

test('parseInvite turns empty optionals into null and defaults lang to en', () => {
  const r = parseInvite(form({ email: 'a@b.co', origin: 'ai', chip: '', memory: '', hope: '  ' }));
  assert.deepEqual(r.invite, { email: 'a@b.co', origin: 'ai', chip: null, memory: null, hope: null, lang: 'en' });
});

test('parseInvite ignores extra fields', () => {
  assert.equal(parseInvite(form({ ...full, admin: 'yes' })).ok, true);
});

test('handleInvite redirects to thanks', async () => {
  const en = await run({ ...full, lang: 'en', 'cf-turnstile-response': 't' });
  assert.equal(en.res.status, 303);
  assert.equal(en.res.headers.get('Location'), '/thanks.html');
  assert.equal(en.db.calls.length, 1);
  const fr = await run({ ...full, 'cf-turnstile-response': 't' });
  assert.equal(fr.res.headers.get('Location'), '/fr/merci.html');
});

test('upserts a normalised email', async () => {
  const { db } = await run({ ...full, email: 'Someone@Example.com ', 'cf-turnstile-response': 't' });
  assert.match(db.calls[0].sql, /ON CONFLICT\(email\) DO UPDATE/);
  assert.equal(db.calls[0].args[0], 'someone@example.com');
  assert.deepEqual(db.calls[0].args, ['someone@example.com', 'arc', 'm3', 16, 'tabs', 'fr', '2026-11-14T10:00:00.000Z']);
});

test('rejects without turnstile', async () => {
  const en = await run({ ...full, lang: 'en' });
  assert.equal(en.res.status, 403);
  assert.equal(en.db.calls.length, 0);
  assert.match(await en.res.text(), /href="\/#invite"/);
  const fr = await run(full);
  assert.match(await fr.res.text(), /href="\/fr\/#invite"/);
});

test('rejects when siteverify fails', async () => {
  const { res, db } = await run({ ...full, 'cf-turnstile-response': 't' }, { success: false });
  assert.equal(res.status, 403);
  assert.equal(db.calls.length, 0);
});

test('survives siteverify network error', async () => {
  const { res, db } = await run({ ...full, 'cf-turnstile-response': 't' }, { fetchImpl: fetchThrows });
  assert.equal(res.status, 403);
  assert.equal(db.calls.length, 0);
});

test('rejects invalid form with 400', async () => {
  const { res, db } = await run({ ...full, origin: 'chrome', 'cf-turnstile-response': 't' });
  assert.equal(res.status, 400);
  assert.match(res.headers.get('Content-Type'), /text\/html/);
  assert.equal(db.calls.length, 0);
});

test('error page never echoes user input', async () => {
  const { res } = await run({ ...full, email: '<script>x</script>', 'cf-turnstile-response': 't' });
  assert.doesNotMatch(await res.text(), /<script>x/);
});

test('rejects non-form bodies', async () => {
  const db = fakeDb();
  const res = await handleInvite({
    request: new Request('https://getressac.app/api/invite', {
      method: 'POST', body: JSON.stringify(full), headers: { 'Content-Type': 'application/json' },
    }),
    env: { DB: db, TURNSTILE_SECRET: 's' },
    fetchImpl: fetchOk(true),
  });
  assert.equal(res.status, 400);
  assert.equal(db.calls.length, 0);
});

test('verifyTurnstile posts secret, response and remoteip to siteverify', async () => {
  let seen;
  const ok = await verifyTurnstile('tok', 'sec', '1.2.3.4', async (url, init) => {
    seen = { url, body: init.body };
    return Response.json({ success: true });
  });
  assert.equal(ok, true);
  assert.equal(seen.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(seen.body.get('secret'), 'sec');
  assert.equal(seen.body.get('response'), 'tok');
  assert.equal(seen.body.get('remoteip'), '1.2.3.4');
});
