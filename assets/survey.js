/* SW Electrical — EV survey page.
   Loaded only on ev-survey.html. Photos are compressed in the browser
   before upload (a phone photo straight off the camera can be 5-10MB;
   resizing keeps uploads fast on mobile data). Each slot accepts multiple
   photos, added cumulatively rather than replacing one another. The cable
   route slot also accepts one short video, sent as-is (video can't be
   resized in the browser the way images can).
*/
(function () {
  'use strict';

  var form = document.getElementById('survey-form');
  if (!form) return;

  var MAX_DIMENSION = 1600;
  var JPEG_QUALITY = 0.82;
  var MAX_PHOTO_BYTES = 8 * 1024 * 1024;   // per photo, post-compression
  var MAX_PHOTOS_PER_SLOT = 6;
  var MAX_VIDEO_BYTES = 60 * 1024 * 1024;  // raw, no client-side compression for video

  var photos = {};   // slot key -> array of { blob, url }
  var video = {};     // slot key -> { file, name } — only 'cable_route' is used

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
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
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

  function renderThumbs(slot) {
    var wrap = document.getElementById('thumbs-' + slot);
    wrap.innerHTML = '';
    (photos[slot] || []).forEach(function (entry, index) {
      var thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      var img = document.createElement('img');
      img.src = entry.url;
      img.alt = '';
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'photo-thumb-remove';
      remove.setAttribute('aria-label', 'Remove this photo');
      remove.textContent = '\u00D7';
      remove.addEventListener('click', function () {
        URL.revokeObjectURL(entry.url);
        photos[slot].splice(index, 1);
        renderThumbs(slot);
        updateFilenameText(slot);
      });
      thumb.appendChild(img);
      thumb.appendChild(remove);
      wrap.appendChild(thumb);
    });
  }

  function updateFilenameText(slot) {
    var el = document.getElementById('filename-' + slot);
    var count = (photos[slot] || []).length;
    el.textContent = count === 0 ? '' : count + (count === 1 ? ' photo added' : ' photos added');
    var btnLabel = document.querySelector('[data-photo="' + slot + '"]')
      .closest('.photo-slot-btn').querySelector('.photo-slot-btn-label');
    btnLabel.textContent = count === 0 ? 'Choose photo' : 'Add another photo';
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-photo]'), function (input) {
    var slot = input.getAttribute('data-photo');
    photos[slot] = photos[slot] || [];

    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      input.value = ''; // allow re-selecting the same file later if removed

      files.forEach(function (file) {
        if ((photos[slot] || []).length >= MAX_PHOTOS_PER_SLOT) return;
        if (file.size > 25 * 1024 * 1024) return; // implausibly large, skip quietly

        compressImage(file)
          .then(function (blob) {
            if (blob.size > MAX_PHOTO_BYTES) return;
            photos[slot].push({ blob: blob, url: URL.createObjectURL(blob) });
            renderThumbs(slot);
            updateFilenameText(slot);
          })
          .catch(function () { /* skip files that fail to process */ });
      });
    });
  });

  // Cable route's optional video field
  Array.prototype.forEach.call(document.querySelectorAll('[data-video]'), function (input) {
    var slot = input.getAttribute('data-video');
    var fileRow = document.getElementById('video-file-' + slot);
    var filenameEl = document.getElementById('video-filename-' + slot);
    var removeBtn = document.getElementById('video-remove-' + slot);
    var btn = input.closest('.photo-slot-btn');

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.type.indexOf('video/') !== 0) { input.value = ''; return; }
      if (file.size > MAX_VIDEO_BYTES) {
        filenameEl.textContent = "That video's a bit large — a shorter clip works better.";
        fileRow.hidden = false;
        input.value = '';
        return;
      }
      video[slot] = { file: file, name: file.name };
      var mb = (file.size / (1024 * 1024)).toFixed(1);
      filenameEl.textContent = file.name + ' (' + mb + ' MB)';
      fileRow.hidden = false;
      btn.style.display = 'none';
    });

    removeBtn.addEventListener('click', function () {
      delete video[slot];
      input.value = '';
      fileRow.hidden = true;
      btn.style.display = '';
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

    Object.keys(photos).forEach(function (slot) {
      (photos[slot] || []).forEach(function (entry, i) {
        fd.append('photo_' + slot, entry.blob, slot + '-' + i + '.jpg');
      });
    });
    if (video.cable_route) {
      fd.append('video_cable_route', video.cable_route.file, video.cable_route.name);
    }

    submit.disabled = true;
    var original = submit.textContent;
    submit.textContent = 'Sending…';

    fetch('/api/ev-survey', { method: 'POST', body: fd })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed');
        form.reset();
        Object.keys(photos).forEach(function (slot) {
          (photos[slot] || []).forEach(function (entry) { URL.revokeObjectURL(entry.url); });
          photos[slot] = [];
          renderThumbs(slot);
          updateFilenameText(slot);
        });
        Object.keys(video).forEach(function (slot) { delete video[slot]; });
        Array.prototype.forEach.call(document.querySelectorAll('.video-slot-file'), function (row) {
          row.hidden = true;
        });
        Array.prototype.forEach.call(document.querySelectorAll('.video-slot .photo-slot-btn'), function (b) {
          b.style.display = '';
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
