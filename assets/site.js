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

    // Honeypot: real people leave this empty.
    if (form.querySelector('[name="company"]').value) return;

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
        if (!r.ok) throw new Error('Request failed');
        form.reset();
        say('ok', 'Thanks, your enquiry has been sent. Sean will get back to you, usually within one working day. For anything urgent, please call instead.');
      })
      .catch(function () {
        say('err', 'That did not send. Please call or WhatsApp Sean instead, or email your details directly.');
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = original;
      });
  });
})();
