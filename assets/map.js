/* SW Electrical — service area map.
   Loaded only on pages that contain #coverage-map. Uses OpenStreetMap tiles
   via Leaflet, no API key, no billing account, no tracking.

   To move the centre point (e.g. once you have exact coordinates for
   SY3 9NT), just change CENTRE below. To change the radius, edit
   RADIUS_MILES.
*/
(function () {
  'use strict';

  if (typeof L === 'undefined') return;
  var el = document.getElementById('coverage-map');
  if (!el) return;

  var CENTRE = [52.696, -2.769]; // approx. SY3 9NT, Shrewsbury
  var RADIUS_MILES = 40;
  var RADIUS_METRES = RADIUS_MILES * 1609.34;

  var map = L.map(el, {
    scrollWheelZoom: false,
    attributionControl: true
  }).setView(CENTRE, 9);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);

  var circle = L.circle(CENTRE, {
    radius: RADIUS_METRES,
    color: '#E5A11C',
    weight: 2,
    fillColor: '#E5A11C',
    fillOpacity: 0.08
  }).addTo(map);

  L.marker(CENTRE)
    .addTo(map)
    .bindPopup('SW Electrical<br>Shrewsbury, SY3 9NT');

  // Fit the view to the full circle, with a little breathing room.
  map.fitBounds(circle.getBounds(), { padding: [12, 12] });

  // Re-enable scroll-to-zoom only once the visitor has clicked into the map,
  // so an ordinary page scroll never gets trapped inside it.
  map.once('click', function () { map.scrollWheelZoom.enable(); });
})();
