/**
 * SW Electrical — Cloudflare Pages root Worker
 *
 * Serves the static site and handles the enquiry and EV survey forms
 * end to end. No third-party database. Everything runs in Cloudflare.
 *
 *   POST /api/enquiry     Validate, save to D1, email Sean, respond.
 *   GET  /api/enquiries   Read the enquiry log as JSON. Requires the
 *                         x-admin-secret header. Not linked anywhere.
 *   POST /api/ev-survey   Validate, store photos in R2, save to D1,
 *                         email Sean with photos attached, respond.
 *
 * ---------------------------------------------------------------------------
 * BINDINGS — Pages > Settings > Bindings > Add
 *   D1 database   Variable name: DB           Database: sw-electrical
 *   R2 bucket     Variable name: SURVEY_PHOTOS  Bucket: sw-electrical-survey-photos
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

    if (url.pathname === '/api/ev-survey') {
      if (request.method !== 'POST') {
        return json({ error: 'POST only' }, 405, { Allow: 'POST' });
      }
      return handleEvSurvey(request, env, ctx);
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

/* ------------------------------------------------------------------ */
/* EV charge point survey */

const SURVEY_PHOTO_SLOTS = ['consumer_unit', 'supply_meter', 'cable_route', 'charger_location'];
const SURVEY_MAX_PHOTO_BYTES = 8 * 1024 * 1024; // matches the client-side compression ceiling
const SURVEY_TEXT_FIELDS = {
  name: 100, phone: 40, email: 200, postcode: 12,
  property_type: 60, tenure: 20, parking_type: 60,
  charger_location_notes: 1000, ev_status: 40, preferred_time: 100, notes: 2000
};

async function handleEvSurvey(request, env, ctx) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  // Honeypot
  if (form.get('company')) return json({ ok: true }, 200);

  const clean = {};
  for (const [field, max] of Object.entries(SURVEY_TEXT_FIELDS)) {
    const v = String(form.get(field) ?? '').trim();
    const required = ['name', 'phone', 'email', 'postcode', 'property_type', 'parking_type'].includes(field);
    if (required && !v) return json({ error: `Missing ${field}` }, 400);
    if (v.length > max) return json({ error: `${field} too long` }, 400);
    clean[field] = v;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.email)) {
    return json({ error: 'Invalid email' }, 400);
  }

  if (!env.DB) return json({ error: 'Storage not configured' }, 500);
  if (!env.SURVEY_PHOTOS) return json({ error: 'Photo storage not configured' }, 500);

  const id = crypto.randomUUID();
  const photoKeys = {};
  const attachments = []; // built alongside the R2 write, reused for the email

  for (const slot of SURVEY_PHOTO_SLOTS) {
    const file = form.get('photo_' + slot);
    if (!file || typeof file === 'string' || file.size === 0) continue;

    if (!file.type || !file.type.startsWith('image/')) {
      return json({ error: `${slot} is not an image` }, 400);
    }
    if (file.size > SURVEY_MAX_PHOTO_BYTES) {
      return json({ error: `${slot} is too large` }, 400);
    }

    const buffer = await file.arrayBuffer();
    const key = `ev-surveys/${id}/${slot}.jpg`;

    try {
      await env.SURVEY_PHOTOS.put(key, buffer, {
        httpMetadata: { contentType: file.type || 'image/jpeg' }
      });
    } catch {
      return json({ error: 'Could not store photo' }, 500);
    }

    photoKeys[slot] = key;
    attachments.push({
      filename: slot + '.jpg',
      content: arrayBufferToBase64(buffer)
    });
  }

  try {
    await env.DB.prepare(
      `INSERT INTO ev_surveys
         (id, name, phone, email, postcode, property_type, tenure, parking_type,
          charger_location_notes, ev_status, preferred_time, notes,
          photo_consumer_unit, photo_supply_meter, photo_cable_route, photo_charger_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id, clean.name, clean.phone, clean.email, clean.postcode,
        clean.property_type, clean.tenure || null, clean.parking_type,
        clean.charger_location_notes || null, clean.ev_status || null,
        clean.preferred_time || null, clean.notes || null,
        photoKeys.consumer_unit || null, photoKeys.supply_meter || null,
        photoKeys.cable_route || null, photoKeys.charger_location || null
      )
      .run();
  } catch {
    return json({ error: 'Could not save survey' }, 500);
  }

  ctx.waitUntil(sendSurveyEmail(env, { id, ...clean, attachments }));

  return json({ ok: true }, 200);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000; // avoid call-stack limits on large arrays
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function sendSurveyEmail(env, r) {
  if (!env.RESEND_API_KEY || !env.TO_EMAIL || !env.FROM_EMAIL) return;

  const esc = (s) =>
    String(s ?? '').replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));

  const rows = [
    ['Name', r.name], ['Phone', r.phone], ['Email', r.email], ['Postcode', r.postcode],
    ['Property type', r.property_type], ['Tenure', r.tenure],
    ['Parking', r.parking_type], ['Preferred charger location', r.charger_location_notes],
    ['EV status', r.ev_status], ['Best time to call', r.preferred_time], ['Notes', r.notes]
  ]
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;vertical-align:top;color:#4B5B70">${esc(k)}</td>` +
        `<td style="padding:6px 0;vertical-align:top"><strong>${esc(v).replace(/\n/g, '<br>')}</strong></td></tr>`
    )
    .join('');

  const photoNote = r.attachments.length
    ? `<p style="color:#4B5B70">${r.attachments.length} photo${r.attachments.length === 1 ? '' : 's'} attached.</p>`
    : `<p style="color:#4B5B70">No photos were attached to this survey.</p>`;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;color:#0C1B2E;max-width:600px">
      <h2 style="margin:0 0 4px">EV charge point survey</h2>
      <p style="margin:0 0 18px;color:#4B5B70">${esc(r.postcode)}</p>
      <table style="border-collapse:collapse;font-size:15px">${rows}</table>
      ${photoNote}
      <p style="margin-top:22px">
        <a href="tel:${esc(r.phone)}" style="background:#12294A;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Call ${esc(r.name)}</a>
      </p>
      <p style="color:#4B5B70;font-size:13px;margin-top:22px">Sent from the EV survey on swelectrical.co.uk. Also saved to the survey log.</p>
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
        subject: `EV survey: ${r.name} (${r.postcode})`,
        html,
        attachments: r.attachments
      })
    });
    if (res.ok && env.DB) {
      await env.DB.prepare('UPDATE ev_surveys SET emailed = 1 WHERE id = ?').bind(r.id).run();
    }
  } catch {
    // Row stays with emailed = 0 so failures are visible in the log.
  }
}
