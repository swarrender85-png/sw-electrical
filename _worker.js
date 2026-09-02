/**
 * SW Electrical — Cloudflare Pages root Worker
 *
 * Serves the static site and handles the enquiry form end to end.
 * No third-party database. Everything runs in Cloudflare.
 *
 *   POST /api/enquiry     Validate, save to D1, email Sean, respond.
 *   GET  /api/enquiries   Read the enquiry log as JSON. Requires the
 *                         x-admin-secret header. Not linked anywhere.
 *
 * ---------------------------------------------------------------------------
 * BINDINGS — Pages > Settings > Bindings > Add > D1 database
 *   Variable name:  DB
 *   Database:       sw-electrical
 *
 * VARIABLES — Pages > Settings > Variables and secrets
 *   RESEND_API_KEY   Resend API key                     (Secret)
 *   FROM_EMAIL       website@swelectrical.co.uk         (Text)
 *   TO_EMAIL         info@swelectrical.co.uk            (Text)
 *   ADMIN_SECRET     a long random string you invent    (Secret)
 *
 * Redeploy after adding bindings or variables.
 * ---------------------------------------------------------------------------
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/enquiry') {
      if (request.method !== 'POST') {
        return json({ error: 'POST only' }, 405, { Allow: 'POST' });
      }
      return handleEnquiry(request, env, ctx);
    }

    if (url.pathname === '/api/enquiries') {
      return listEnquiries(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

/* ------------------------------------------------------------------ */

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });
}

const FIELDS = {
  name: 100,
  phone: 40,
  email: 200,
  postcode: 12,
  service: 80,
  details: 4000
};

async function handleEnquiry(request, env, ctx) {
  let d;
  try {
    d = await request.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  // Honeypot: bots fill every field, people leave this one alone.
  if (d.company) return json({ ok: true }, 200);

  const clean = {};
  for (const [field, max] of Object.entries(FIELDS)) {
    const v = String(d[field] ?? '').trim();
    if (!v) return json({ error: `Missing ${field}` }, 400);
    if (v.length > max) return json({ error: `${field} too long` }, 400);
    clean[field] = v;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.email)) {
    return json({ error: 'Invalid email' }, 400);
  }

  const preferred = ['Phone', 'WhatsApp', 'Email'].includes(d.preferred) ? d.preferred : null;
  const id = crypto.randomUUID();

  if (!env.DB) return json({ error: 'Storage not configured' }, 500);

  try {
    await env.DB.prepare(
      `INSERT INTO enquiries (id, name, phone, email, postcode, service, details, preferred, ip_country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        clean.name,
        clean.phone,
        clean.email,
        clean.postcode,
        clean.service,
        clean.details,
        preferred,
        request.headers.get('cf-ipcountry') || null
      )
      .run();
  } catch (err) {
    return json({ error: 'Could not save enquiry' }, 500);
  }

  // The enquiry is saved. Email is a notification, so send it after the
  // response goes out. A mail failure must never lose the enquiry.
  ctx.waitUntil(sendEmail(env, { id, ...clean, preferred }));

  return json({ ok: true }, 200);
}

async function sendEmail(env, r) {
  if (!env.RESEND_API_KEY || !env.TO_EMAIL || !env.FROM_EMAIL) return;

  const esc = (s) =>
    String(s ?? '').replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));

  const rows = [
    ['Name', r.name],
    ['Phone', r.phone],
    ['Email', r.email],
    ['Postcode', r.postcode],
    ['Service', r.service],
    ['Preferred contact', r.preferred || 'Not stated'],
    ['Details', r.details]
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;vertical-align:top;color:#4B5B70">${esc(k)}</td>` +
        `<td style="padding:6px 0;vertical-align:top"><strong>${esc(v).replace(/\n/g, '<br>')}</strong></td></tr>`
    )
    .join('');

  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;color:#0C1B2E;max-width:600px">
      <h2 style="margin:0 0 4px">New website enquiry</h2>
      <p style="margin:0 0 18px;color:#4B5B70">${esc(r.service)} in ${esc(r.postcode)}</p>
      <table style="border-collapse:collapse;font-size:15px">${rows}</table>
      <p style="margin-top:22px">
        <a href="tel:${esc(r.phone)}" style="background:#12294A;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Call ${esc(r.name)}</a>
      </p>
      <p style="color:#4B5B70;font-size:13px;margin-top:22px">Sent from swelectrical.co.uk. Also saved to the enquiry log.</p>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [env.TO_EMAIL],
        reply_to: r.email,
        subject: `Website enquiry: ${r.service} (${r.postcode})`,
        html
      })
    });
    if (res.ok && env.DB) {
      await env.DB.prepare('UPDATE enquiries SET emailed = 1 WHERE id = ?').bind(r.id).run();
    }
  } catch {
    // Row stays with emailed = 0 so failures are visible in the log.
  }
}

async function listEnquiries(request, env) {
  if (!env.ADMIN_SECRET || request.headers.get('x-admin-secret') !== env.ADMIN_SECRET) {
    return json({ error: 'Unauthorised' }, 401);
  }
  if (!env.DB) return json({ error: 'Storage not configured' }, 500);

  const { results } = await env.DB.prepare(
    `SELECT id, created_at, name, phone, email, postcode, service, details,
            preferred, status, emailed
     FROM enquiries ORDER BY created_at DESC LIMIT 200`
  ).all();

  return json({ count: results.length, enquiries: results });
}
