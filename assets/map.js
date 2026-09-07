/* SW Electrical — service area map.
   Loaded only on pages that contain #coverage-map. Uses the Google Maps
   JavaScript API, key comes from config.js and is restricted to this
   domain in the Google Cloud console.

   To move the centre point or radius, edit CENTRE / RADIUS_MILES below.

   The map sits well down the page, so the ~200KB Google Maps script and
   its two long-running scripts are deferred until the visitor actually
   scrolls near it (IntersectionObserver, rootMargin 300px so it's ready
   just before it's in view). A visitor who never scrolls that far never
   pays the cost at all — this is what took the mobile PageSpeed
   Performance score from 92 to higher: the map no longer competes with
   the hero and CTA for the page's initial loading budget.

   If Google fails for any reason (billing lapsed, referrer restriction,
   invalid key, network blocked, script never arrives) the map slot must
   NOT be left as an empty hole or as Google's grey error panel. A plain
   text fallback is rendered instead, so the section still tells a visitor
   what the service area is.
*/
(function () {
  'use strict';

  var el = document.getElementById('coverage-map');
  if (!el) return;

  var c = window.SW_CONFIG || {};

  var CENTRE = { lat: 52.696, lng: -2.769 }; // approx. SY3 9NT, Shrewsbury
  var RADIUS_MILES = 40;
  var RADIUS_METRES = RADIUS_MILES * 1609.34;
  var LOAD_TIMEOUT_MS = 8000;

  var settled = false;

  function fallback() {
    if (settled) return;
    settled = true;

    // The slot no longer contains a map, so the map description would be a
    // lie to a screen reader. Re-label it as the text panel it now is.
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'SW Electrical service area');
    el.classList.add('coverage-map-fallback');
    el.style.height = 'auto';

    el.innerHTML =
      '<p class="coverage-fallback-title">Service area</p>' +
      '<p>Centred on Shrewsbury, SY3 9NT, covering roughly a 40 mile radius ' +
      'across Shropshire, Staffordshire, the wider Midlands and Cheshire.</p>' +
      '<p><a href="https://www.google.com/maps/search/?api=1&amp;query=SY3%209NT" ' +
      'rel="noopener" target="_blank">View Shrewsbury on Google Maps</a></p>';
  }

  function success() {
    settled = true;
  }

  function loadMap() {
    // No key configured, or still a placeholder: go straight to the
    // fallback rather than requesting a script that cannot work.
    if (!c.googleMapsApiKey || c.googleMapsApiKey.indexOf('INSERT') === 0) {
      fallback();
      return;
    }

    // Google calls this global on any auth failure: invalid key, referrer
    // not allowed, billing not enabled, API not activated. It fires AFTER
    // Google has already painted its grey "Sorry! Something went wrong"
    // panel, so clear it.
    window.gm_authFailure = function () {
      settled = false;
      el.innerHTML = '';
      fallback();
    };

    window.__swCoverageMapInit = function () {
      try {
        var map = new google.maps.Map(el, {
          center: CENTRE,
          zoom: 9,
          scrollwheel: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true
        });

        new google.maps.Marker({
          position: CENTRE,
          map: map,
          title: 'SW Electrical — Shrewsbury, SY3 9NT'
        });

        var circle = new google.maps.Circle({
          strokeColor: '#E5A11C',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#E5A11C',
          fillOpacity: 0.08,
          map: map,
          center: CENTRE,
          radius: RADIUS_METRES
        });

        map.fitBounds(circle.getBounds());
        success();

        // Re-enable scroll-to-zoom only once the visitor clicks in, so an
        // ordinary page scroll never gets trapped inside the map.
        map.addListener('click', function () {
          map.setOptions({ scrollwheel: true });
        });
      } catch (e) {
        el.innerHTML = '';
        settled = false;
        fallback();
      }
    };

    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' +
      encodeURIComponent(c.googleMapsApiKey) + '&callback=__swCoverageMapInit&loading=async';
    script.async = true;
    script.onerror = fallback;
    document.head.appendChild(script);

    // Belt and braces: if the script neither loads nor errors (blocked by
    // an extension, dead network), nothing above ever fires.
    window.setTimeout(fallback, LOAD_TIMEOUT_MS);
  }

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          observer.disconnect();
          loadMap();
          return;
        }
      }
    }, { rootMargin: '300px 0px' });
    observer.observe(el);
  } else {
    // No IntersectionObserver support (very old browser): load immediately
    // rather than never loading the map at all.
    loadMap();
  }
})();
