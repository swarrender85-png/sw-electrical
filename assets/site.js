/* SW Electrical — site behaviour. No dependencies. */

/* Generic carousels — the EV survey's example-photo slots and the EV
   charging page's charger price carousel both use this. A carousel with
   no data-count (a single "coming soon" placeholder) has nothing to wire
   up, since there's only one slide until real content exists. */
Array.prototype.forEach.call(document.querySelectorAll('.example-carousel[data-count]'), function (carousel) {
  var slides = Array.prototype.slice.call(carousel.querySelectorAll('.example-slide'));
  var dots = Array.prototype.slice.call(carousel.querySelectorAll('.example-dot'));
  var prev = carousel.querySelector('.example-prev');
  var next = carousel.querySelector('.example-next');
  var index = 0;

  function show(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === index); });
    dots.forEach(function (d, n) { d.classList.toggle('is-active', n === index); });
  }

  if (prev) prev.addEventListener('click', function () { show(index - 1); });
  if (next) next.addEventListener('click', function () { show(index + 1); });
  dots.forEach(function (dot, i) { dot.addEventListener('click', function () { show(i); }); });

  carousel.tabIndex = 0;
  carousel.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
});

/* Cloudflare Turnstile — shared loader for the enquiry and EV survey forms.
   Loads the widget script once, only when a site key is configured in
   config.js, and only on pages that actually have a .cf-turnstile slot.
   Left unconfigured (turnstileSiteKey blank), this is a no-op: the div
   stays empty, no token is produced, and the worker skips verification
   entirely since it fails open with no TURNSTILE_SECRET_KEY set. */
var __swTurnstileLoading = false;
/* ---------- Shared form helpers (enquiry form and EV survey) ----------
   Field errors are shown in two places: a message directly under the field
   at fault, and the summary by the submit button. A customer told "that
   phone number does not look right" should not have to hunt for the box.

   The client-side checks deliberately mirror the worker's (same patterns,
   same wording). They exist so a mistake is caught before a survey spends
   minutes uploading photos; the worker still re-checks everything and has
   the final say. If a rule changes in _worker.js, change it here too. */
var SW_PHONE_OK = /^[0-9+()\s.-]{7,}$/;
var SW_POSTCODE_OK = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}$/i;
var SW_EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function swFieldEl(form, field) {
  if (field.indexOf('photo_') === 0) {
    return form.querySelector('.photo-slot[data-slot="' + field.slice(6) + '"]');
  }
  if (field.indexOf('video_') === 0) {
    var v = form.querySelector('[data-video="' + field.slice(6) + '"]');
    return v ? (v.closest('.photo-slot, .video-slot') || v) : null;
  }
  return form.querySelector('[name="' + field + '"]');
}

function swClearFieldErrors(form) {
  Array.prototype.forEach.call(form.querySelectorAll('.field-error'), function (n) { n.remove(); });
  Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (n) {
    n.removeAttribute('aria-invalid');
    n.removeAttribute('aria-describedby');
  });
  Array.prototype.forEach.call(form.querySelectorAll('.has-error'), function (n) { n.classList.remove('has-error'); });
}

/** Mark one field as wrong, put the message beside it, and move to it. */
function swShowFieldError(form, field, msg) {
  var el = swFieldEl(form, field);
  if (!el) return;
  var id = 'err-' + field;
  var note = document.createElement('p');
  note.className = 'field-error';
  note.id = id;
  note.textContent = msg;

  var isControl = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
  if (isControl) {
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', id);
    var wrap = el.closest('.field') || el.parentNode;
    wrap.appendChild(note);
    el.focus();
  } else {
    // a photo or video slot: mark the whole slot
    el.classList.add('has-error');
    el.appendChild(note);
    var btn = el.querySelector('input, button, .photo-slot-btn');
    if (btn && btn.focus) btn.focus();
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/** Client-side mirror of the worker's checks. Returns { error, field } or null. */
function swValidate(form, required) {
  for (var i = 0; i < required.length; i++) {
    var f = form.querySelector('[name="' + required[i][0] + '"]');
    if (f && !String(f.value || '').trim()) return { field: required[i][0], error: required[i][1] };
  }
  var val = function (n) { var x = form.querySelector('[name="' + n + '"]'); return x ? String(x.value || '').trim() : ''; };
  if (!SW_EMAIL_OK.test(val('email'))) {
    return { field: 'email', error: 'That email address does not look right. Please check it and try again.' };
  }
  if (!SW_PHONE_OK.test(val('phone'))) {
    return { field: 'phone', error: 'That phone number does not look right. Please use digits only, for example 07700 900123.' };
  }
  if (!SW_POSTCODE_OK.test(val('postcode'))) {
    return { field: 'postcode', error: 'That postcode does not look right. Please check it, for example SY3 9NT.' };
  }
  return null;
}

/** Turnstile tokens are single use. After ANY failed submission the old
 *  token is spent, so get a fresh one or the retry fails its spam check. */
function swResetTurnstile(form) {
  var slot = form.querySelector('.cf-turnstile');
  if (slot && window.turnstile) {
    try { window.turnstile.reset(slot); } catch (e) { /* widget not rendered */ }
  }
}

function loadTurnstileIfConfigured(form) {
  var slot = form.querySelector('.cf-turnstile');
  var siteKey = (window.SW_CONFIG || {}).turnstileSiteKey;
  if (!slot || !siteKey) return;

  slot.setAttribute('data-sitekey', siteKey);

  if (window.turnstile) { window.turnstile.render(slot); return; }
  if (__swTurnstileLoading) return;
  __swTurnstileLoading = true;

  var script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

(function () {
  'use strict';

  /* ---------- Mobile navigation ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Inject real contact details from config.js ---------- */
  var c = window.SW_CONFIG || {};

  function setAll(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  if (c.phoneDial && c.phoneDial.indexOf('INSERT') === -1) {
    setAll('[data-tel]', function (el) {
      el.setAttribute('href', 'tel:+' + c.phoneDial.replace(/\D/g, ''));
    });
  }
  if (c.phoneDisplay && c.phoneDisplay.indexOf('INSERT') === -1) {
    setAll('[data-tel-text]', function (el) { el.textContent = c.phoneDisplay; });
  }
  if (c.whatsapp && c.whatsapp.indexOf('INSERT') === -1) {
    var waHref = 'https://wa.me/' + c.whatsapp.replace(/\D/g, '') +
      '?text=' + encodeURIComponent(c.whatsappMessage || '');
    setAll('[data-wa]', function (el) { el.setAttribute('href', waHref); });
  }
  if (c.email && c.email.indexOf('INSERT') === -1) {
    setAll('[data-email]', function (el) {
      el.setAttribute('href', 'mailto:' + c.email);
    });
    setAll('[data-email-text]', function (el) { el.textContent = c.email; });
  }
  if (c.googleReviewUrl) {
    setAll('[data-review-link]', function (el) {
      el.setAttribute('href', c.googleReviewUrl);
      el.hidden = false;
    });
  }
  if (c.facebook) {
    setAll('[data-facebook]', function (el) {
      el.setAttribute('href', c.facebook);
      el.hidden = false;
    });
    // The footer link is wrapped in an <li> that is hidden by default, so
    // the row does not appear as an empty bullet when no URL is configured.
    setAll('[data-facebook-item]', function (el) { el.hidden = false; });
  }

  /* ---------- Cloudflare Web Analytics ----------
     Cookie-free by design, so this needs no consent banner. Loaded last and
     async so it never delays the page. Disabled simply by leaving the token
     blank in config.js. */
  if (c.cloudflareAnalyticsToken) {
    var beacon = document.createElement('script');
    beacon.defer = true;
    beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    beacon.setAttribute('data-cf-beacon', JSON.stringify({ token: c.cloudflareAnalyticsToken }));
    document.head.appendChild(beacon);
  }

  /* ---------- Enquiry form ---------- */
  var form = document.getElementById('enquiry-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var submit = form.querySelector('button[type="submit"]');

  // Time-trap: records when the form became visible, so the worker can
  // reject anything submitted implausibly fast (a bot filling and posting
  // a form in well under a second, before a person could have typed a word).
  var startedField = form.querySelector('[name="form_started"]');
  if (startedField) startedField.value = String(Date.now() / 1000);

  loadTurnstileIfConfigured(form);

  function say(kind, msg) {
    status.className = 'form-status show ' + kind;
    status.textContent = msg;
    status.setAttribute('tabindex', '-1');
    status.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    swClearFieldErrors(form);

    // Honeypot: real people leave this empty.
    if (form.querySelector('[name="company"]').value) return;

    // Catch obvious mistakes before sending. The worker re-checks everything.
    var problem = swValidate(form, [
      ['name', 'Please enter your name.'],
      ['phone', 'Please enter a phone number.'],
      ['email', 'Please enter an email address.'],
      ['postcode', 'Please enter a postcode.'],
      ['service', 'Please choose the service you need.'],
      ['details', 'Please enter a short description of the work.']
    ]);
    if (problem) {
      say('err', problem.error);
      swShowFieldError(form, problem.field, problem.error);
      return;
    }

    var data = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    var original = submit.textContent;
    submit.textContent = 'Sending…';

    fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) {
        // The worker explains exactly what failed. Read the body so the
        // customer sees that rather than one line for every problem.
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) {
            var err = new Error('rejected');
            err.serverMessage = body && body.error;
            err.field = body && body.field;
            throw err;
          }
        });
      })
      .then(function () {
        form.reset();
        say('ok', 'Thanks, your enquiry has been sent. Sean will get back to you, usually within one working day. For anything urgent, please call instead.');
      })
      .catch(function (e) {
        var msg = (e && e.serverMessage)
          ? e.serverMessage
          : 'That did not send. Please check your connection and try again, or call or WhatsApp Sean instead.';
        say('err', msg);
        if (e && e.field) swShowFieldError(form, e.field, msg);
      })
      .then(function () {
        // Whatever happened, the Turnstile token is now spent.
        swResetTurnstile(form);
        submit.disabled = false;
        submit.textContent = original;
      });
  });
})();
