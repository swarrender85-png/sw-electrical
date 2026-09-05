/* SW Electrical — EV survey page.
   Loaded only on ev-survey.html. Compresses photos in the browser before
   upload (a phone photo straight off the camera can be 5-10MB; resizing to
   a sensible max dimension keeps the upload fast on mobile data and keeps
   the eventual email attachment size reasonable). Nothing here reads or
   writes any personal data except what the visitor types into the form.
*/
(function () {
  'use strict';

  var form = document.getElementById('survey-form');
  if (!form) return;

  var MAX_DIMENSION = 1600;   // longest edge, in pixels, after compression
  var JPEG_QUALITY = 0.82;
  var MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // hard ceiling per photo, post-compression

  var compressed = {}; // slot key -> Blob
  var placeholderHTML = {}; // slot key -> original icon markup, for resetting after success

  Array.prototype.forEach.call(document.querySelectorAll('.photo-slot-preview'), function (p) {
    placeholderHTML[p.id] = p.innerHTML;
  });

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('Could not process image'));
          resolve(blob);
        }, 'image/jpeg', JPEG_QUALITY);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image'));
      };
      img.src = url;
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-photo]'), function (input) {
    var slot = input.getAttribute('data-photo');
    var preview = document.getElementById('preview-' + slot);
    var filenameEl = document.getElementById('filename-' + slot);
    var btnLabel = input.closest('.photo-slot-btn').querySelector('.photo-slot-btn-label');

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;

      if (file.size > 25 * 1024 * 1024) {
        filenameEl.textContent = "That file's a bit large — try a different photo.";
        return;
      }

      btnLabel.textContent = 'Processing…';
      filenameEl.textContent = '';

      compressImage(file)
        .then(function (blob) {
          if (blob.size > MAX_UPLOAD_BYTES) {
            filenameEl.textContent = "Still too large after compression — try a different photo.";
            btnLabel.textContent = 'Choose photo';
            return;
          }
          compressed[slot] = blob;
          var objectUrl = URL.createObjectURL(blob);
          preview.innerHTML = '<img src="' + objectUrl + '" alt="">';
          preview.classList.add('has-image');
          var kb = Math.round(blob.size / 1024);
          filenameEl.textContent = 'Photo added (' + kb + ' KB)';
          btnLabel.textContent = 'Change photo';
        })
        .catch(function () {
          filenameEl.textContent = "Couldn't process that photo — try again or pick another.";
          btnLabel.textContent = 'Choose photo';
        });
    });
  });

  var status = document.getElementById('survey-status');
  var submit = document.getElementById('survey-submit');

  function say(kind, msg) {
    status.className = 'form-status show ' + kind;
    status.textContent = msg;
    status.setAttribute('tabindex', '-1');
    status.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (form.querySelector('[name="company"]').value) return; // honeypot

    var data = new FormData(form);
    var fd = new FormData();
    ['name', 'phone', 'email', 'postcode', 'property_type', 'tenure',
     'parking_type', 'charger_location_notes', 'ev_status', 'preferred_time', 'notes']
      .forEach(function (key) { fd.append(key, data.get(key) || ''); });

    Object.keys(compressed).forEach(function (slot) {
      fd.append('photo_' + slot, compressed[slot], slot + '.jpg');
    });

    submit.disabled = true;
    var original = submit.textContent;
    submit.textContent = 'Sending…';

    fetch('/api/ev-survey', { method: 'POST', body: fd })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed');
        form.reset();
        compressed = {};
        Array.prototype.forEach.call(document.querySelectorAll('.photo-slot-preview'), function (p) {
          p.classList.remove('has-image');
          p.innerHTML = placeholderHTML[p.id] || '';
        });
        Array.prototype.forEach.call(document.querySelectorAll('.photo-slot-btn-label'), function (l) {
          l.textContent = 'Choose photo';
        });
        Array.prototype.forEach.call(document.querySelectorAll('[id^="filename-"]'), function (f) {
          f.textContent = '';
        });
        say('ok', "Thanks — that's all sent through. I'll go through it and come back to you, usually within one working day.");
      })
      .catch(function () {
        say('err', "That didn't send. Please call or WhatsApp instead, a photo of your fuse board and meter is a great start.");
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = original;
      });
  });
})();
