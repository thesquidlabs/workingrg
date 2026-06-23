
// Use the sqs-core module to access core Squarespace
// functionality, like Lifecycle and ImageLoader. For
// full documentation, go to:
//
// http://github.com/squarespace/squarespace-core

var core = require('@squarespace/core');

// Showcase Window pin controller.
// A [data-showcase] section stacks N absolutely-positioned [data-showcase-card] panes; only the
// .is-active one is visible (styles in site.less .section-fill--showcase). While the section is the
// one in view, wheel/touch is hijacked: each gesture advances the active card and the section stays
// pinned. At either end (down on last card / up on first) the gesture is NOT consumed, so native
// scroll-snap carries to the adjacent section. Mirrors the window.block layout per card.
function initShowcase(section) {
  var cards = section.querySelectorAll('[data-showcase-card]');
  if (cards.length < 2) {
    // Single (or zero) card: nothing to hijack - leave native scroll alone.
    if (cards.length === 1) { cards[0].classList.add('is-active'); }
    return;
  }

  var index = 0;
  var cooldownMs = 450;        // quiet gap after scrolling stops before the next step is allowed
  var locked = false;
  var unlockTimer = null;
  var engaged = false;         // section is the one in view (set by IntersectionObserver)
  var touchStartY = null;
  var touchThreshold = 40;     // px of vertical drag before a swap registers

  cards[0].classList.add('is-active');

  // Engage only when the section substantially fills the viewport. Listening on window (not the
  // section) + this ratio gate means a fast scroll still catches the section instead of flying past.
  var io = new IntersectionObserver(function (entries) {
    engaged = entries[0].intersectionRatio >= 0.6;
  }, { threshold: [0, 0.6, 1] });
  io.observe(section);

  function setActive(next) {
    cards[index].classList.remove('is-active');
    cards[next].classList.add('is-active');
    index = next;
  }

  // Shared step logic for wheel + touch. dir: +1 down, -1 up. Returns true if the gesture was
  // consumed (caller should preventDefault); false to release to native scroll-snap.
  // Momentum-safe: every consumed event re-arms the unlock timer, so one continuous gesture
  // (with trailing inertia) advances exactly one card - it can't expire mid-flick and double-step.
  function handle(dir) {
    if (!engaged) { return false; }
    var atBoundary = (dir > 0 && index === cards.length - 1) ||
                     (dir < 0 && index === 0);
    if (atBoundary) { return false; }          // let native snap move to the next/prev section
    if (!locked) {
      setActive(index + dir);
      locked = true;
    }
    if (unlockTimer) { clearTimeout(unlockTimer); }
    unlockTimer = setTimeout(function () { locked = false; }, cooldownMs);
    return true;                               // pinned: consume the gesture
  }

  window.addEventListener('wheel', function (e) {
    if (e.deltaY === 0) { return; }
    if (handle(e.deltaY > 0 ? 1 : -1)) { e.preventDefault(); }
  }, { passive: false });

  window.addEventListener('touchstart', function (e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    if (touchStartY === null) { return; }
    var delta = touchStartY - e.touches[0].clientY;   // drag up (next) = positive
    if (Math.abs(delta) < touchThreshold) { return; }
    if (handle(delta > 0 ? 1 : -1)) {
      e.preventDefault();
      touchStartY = e.touches[0].clientY;             // reset so the next step needs a fresh drag
    }
  }, { passive: false });

  window.addEventListener('touchend', function () {
    touchStartY = null;
  }, { passive: true });
}

window.addEventListener('DOMContentLoaded', function() {

  var images = document.querySelectorAll('img[data-src]');

  for (var i = 0; i < images.length; i++) {
    core.ImageLoader.load(images[i], {
      load: true
    });
  }

  var showcases = document.querySelectorAll('[data-showcase]');

  for (var j = 0; j < showcases.length; j++) {
    initShowcase(showcases[j]);
  }

});
