const ORIGINS = ['arc', 'zen', 'chrome', 'firefox', 'other'];
const CHIPS = ['m1', 'm2', 'm3', 'm4', 'm5'];
const MEMORIES = [8, 16, 24, 32, 48, 64, 96, 128];
const LANGS = ['en', 'fr'];
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const UPSERT = `INSERT INTO invites (email, origin, chip, memory, hope, lang, created_at, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
ON CONFLICT(email) DO UPDATE SET origin = excluded.origin, chip = excluded.chip,
  memory = excluded.memory, hope = excluded.hope, lang = excluded.lang, updated_at = excluded.updated_at`;

const text = (form, name) => String(form.get(name) ?? '').trim();

export function parseInvite(form) {
  const email = text(form, 'email').toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'email' };

  const origin = text(form, 'origin');
  if (!ORIGINS.includes(origin)) return { ok: false, error: 'origin' };

  const chip = text(form, 'chip') || null;
  const memory = text(form, 'memory') ? Number(text(form, 'memory')) : null;
  const hope = text(form, 'hope') || null;
  const lang = text(form, 'lang') || 'en';
  if ((chip && !CHIPS.includes(chip)) || (memory !== null && !MEMORIES.includes(memory))
    || (hope && hope.length > 280) || !LANGS.includes(lang)) {
    return { ok: false, error: 'field' };
  }
  return { ok: true, invite: { email, origin, chip, memory, hope, lang } };
}

export async function verifyTurnstile(token, secret, ip, fetchImpl = fetch) {
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetchImpl(SITEVERIFY, { method: 'POST', body });
    return (await res.json()).success === true;
  } catch {
    return false;
  }
}

export async function saveInvite(db, invite, now) {
  const { email, origin, chip, memory, hope, lang } = invite;
  await db.prepare(UPSERT).bind(email, origin, chip, memory, hope, lang, now).run();
}

const PAGES = {
  en: { title: 'Something went wrong', body: 'Something went wrong — please try again.', back: 'Back to the form', href: '/#invite' },
  fr: { title: 'Oups', body: "Oups, ça n'a pas marché, réessaie.", back: 'Revenir au formulaire', href: '/fr/#invite' },
};

// Never echoes user input: the page is built only from the fixed strings above.
function errorPage(lang, status) {
  const p = PAGES[lang] ?? PAGES.en;
  const html = `<!doctype html><html lang="${PAGES[lang] ? lang : 'en'}"><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${p.title}</title>`
    + `<link rel="stylesheet" href="/assets/site.css"><main class="prose"><p>${p.body}</p>`
    + `<p><a href="${p.href}">${p.back}</a></p></main></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function handleInvite({ request, env, waitUntil = () => {}, fetchImpl = fetch, now = new Date().toISOString() }) {
  const type = request.headers.get('Content-Type') ?? '';
  if (!type.startsWith('multipart/form-data') && !type.startsWith('application/x-www-form-urlencoded')) {
    return errorPage('en', 400);
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return errorPage('en', 400);
  }
  const lang = text(form, 'lang');

  const token = text(form, 'cf-turnstile-response');
  const ip = request.headers.get('CF-Connecting-IP');
  if (!token || !(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip, fetchImpl))) return errorPage(lang, 403);

  const parsed = parseInvite(form);
  if (!parsed.ok) return errorPage(lang, 400);

  try {
    await saveInvite(env.DB, parsed.invite, now);
  } catch {
    return errorPage(lang, 503);
  }
  // The invite is saved: a failed notification mail must not fail the visitor's request.
  if (env.NOTIFY) {
    waitUntil(env.NOTIFY.fetch('https://notify/', { method: 'POST', body: JSON.stringify(parsed.invite) }).catch(() => {}));
  }
  const location = parsed.invite.lang === 'fr' ? '/fr/merci.html' : '/thanks.html';
  return new Response(null, { status: 303, headers: { Location: location } });
}
