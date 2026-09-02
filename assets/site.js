/* SW Electrical — site behaviour. No dependencies. */
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

  /* ---------- Enquiry form ---------- */
  var form = document.getElementById('enquiry-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var submit = form.querySelector('button[type="submit"]');

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
