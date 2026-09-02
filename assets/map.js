/* SW Electrical — service area map.
   Loaded only on pages that contain #coverage-map. Uses the Google Maps
   JavaScript API, key comes from config.js and is restricted to this
   domain in the Google Cloud console.

   To move the centre point or radius, edit CENTRE / RADIUS_MILES below.
*/
(function () {
  'use strict';

  var el = document.getElementById('coverage-map');
  if (!el) return;

  var c = window.SW_CONFIG || {};
  if (!c.googleMapsApiKey || c.googleMapsApiKey.indexOf('INSERT') === 0) return;

  var CENTRE = { lat: 52.696, lng: -2.769 }; // approx. SY3 9NT, Shrewsbury
  var RADIUS_MILES = 40;
  var RADIUS_METRES = RADIUS_MILES * 1609.34;

  window.__swCoverageMapInit = function () {
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

    // Re-enable scroll-to-zoom only once the visitor clicks in, so an
    // ordinary page scroll never gets trapped inside the map.
    map.addListener('click', function () {
      map.setOptions({ scrollwheel: true });
    });
  };

  var script = document.createElement('script');
  script.src = 'https://maps.googleapis.com/maps/api/js?key=' +
    encodeURIComponent(c.googleMapsApiKey) + '&callback=__swCoverageMapInit&loading=async';
  script.async = true;
  document.head.appendChild(script);
})();
