import { EmailMessage } from 'cloudflare:email';

const FROM = 'invites@getressac.app';

export default {
  async fetch(request, env) {
    const i = await request.json();
    // Only the body carries visitor input; headers use fixed strings and the already-validated email.
    const body = [
      `Email: ${i.email}`,
      `Origin: ${i.origin}`,
      `Mac: ${i.chip ?? '-'} / ${i.memory ? `${i.memory} GB` : '-'}`,
      `Lang: ${i.lang}`,
      `Hope: ${i.hope ?? '-'}`,
    ].join('\r\n');
    const raw = [
      `From: Ressac <${FROM}>`,
      `To: ${env.NOTIFY_TO}`,
      `Reply-To: ${i.email}`,
      `Subject: New Ressac invite request`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@getressac.app>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      body,
    ].join('\r\n');
    await env.EMAIL.send(new EmailMessage(FROM, env.NOTIFY_TO, raw));
    return new Response(null, { status: 204 });
  },
};
