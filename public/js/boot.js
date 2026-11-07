/* public/js/boot.js — the one thing that must run before paint: tell CSS that
   JavaScript is alive so reveal animations can start hidden (and stay visible
   for everyone else). Loaded from /js/main.js's own <script> tag in the head. */
(function () {
  var d = document.documentElement;
  d.className = d.className.replace(/\bno-js\b/, '').trim() + ' js';
  // Expose a coarse "viewport height" for mobile browsers that include the URL bar.
  function setVh() {
    d.style.setProperty('--vh', window.innerHeight * 0.01 + 'px');
  }
  setVh();
  window.addEventListener('resize', setVh, { passive: true });
})();
