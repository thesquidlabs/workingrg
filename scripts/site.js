
// Plain browser script - NO require()/module imports. Squarespace serves /scripts files as-is, so
// a bare `require` throws "require is not defined" and kills the whole file. ImageLoader is a
// Squarespace runtime global (window.ImageLoader), used directly and guarded below - never bundled.

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

  var dots = section.querySelectorAll('.section-fill__dot');   // progress indicator, one per card
  var index = 0;
  var cooldownMs = 450;        // minimum time between card steps (throttle)
  var lastStep = 0;            // timestamp of the last step
  var touchStartY = null;
  var touchThreshold = 40;     // px of vertical drag before a swap registers

  // Fixed-header height: the scroll-snap line the section seats against.
  function headerHeight() {
    var header = document.querySelector('header');
    return header ? header.getBoundingClientRect().height : 0;
  }

  // Synchronous engagement test (NOT IntersectionObserver - its async callback lags behind a fast
  // flick, letting wheels pass through so native snap skips the whole section). True whenever the
  // section straddles the vertical middle of the viewport, i.e. it is the dominant section on screen.
  function coversCenter() {
    var r = section.getBoundingClientRect();
    var mid = window.innerHeight / 2;
    return r.top <= mid && r.bottom >= mid;
  }

  // Section is seated at the snap line (its top sits just under the fixed header).
  function aligned() {
    return Math.abs(section.getBoundingClientRect().top - headerHeight()) < 6;
  }

  // Set each card's state by its index relative to the new active one: earlier cards park ABOVE,
  // later cards park BELOW, active sits centred. This makes the slide directional without tracking
  // the scroll direction - a forward step naturally rises from the bottom, a backward step from the top.
  function setActive(next) {
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('is-active', 'is-above', 'is-below');
      if (i < next) {
        cards[i].classList.add('is-above');
      } else if (i > next) {
        cards[i].classList.add('is-below');
      } else {
        cards[i].classList.add('is-active');
      }
    }
    // Keep the progress indicator in sync - exactly one dot active.
    for (var d = 0; d < dots.length; d++) {
      if (d === next) {
        dots[d].classList.add('is-active');
      } else {
        dots[d].classList.remove('is-active');
      }
    }
    index = next;
  }

  // Seat the initial states, then flip on .is-ready. Card 0 is already at translateY(0) via CSS
  // :first-child and the rest at translateY(100%), so enabling .is-ready moves nothing - the first
  // card is pre-seated with no entrance animation; only later scroll steps animate.
  setActive(0);
  section.classList.add('is-ready');

  // Shared step logic for wheel + touch. dir: +1 down, -1 up. Returns true if the gesture was
  // consumed (caller should preventDefault); false to release to native scroll-snap.
  // Time-throttle, not a hold-lock: while engaged on a middle card the gesture is always pinned,
  // but a step fires at most once per cooldownMs. Continuous scroll advances steadily; a single
  // flick advances one card. It can never freeze - there is no lock a non-stop wheel stream could
  // keep re-arming forever.
  function handle(dir) {
    if (!coversCenter()) { return false; }      // not the dominant section - leave native scroll alone
    var atBoundary = (dir > 0 && index === cards.length - 1) ||
                     (dir < 0 && index === 0);
    if (atBoundary) { return false; }          // let native snap move to the next/prev section
    // Force-seat to the snap line if a fast flick left the section mid-viewport, so cards always
    // swap from the aligned frame (otherwise the section can be pinned half-scrolled and look skipped).
    if (!aligned()) {
      window.scrollTo(0, window.pageYOffset + section.getBoundingClientRect().top - headerHeight());
    }
    var now = Date.now();
    if (now - lastStep >= cooldownMs) {
      setActive(index + dir);
      lastStep = now;
    }
    return true;                               // pinned: consume the gesture (step or throttled)
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

// Force-load every responsive (data-src) image up front. Run on load AND resize: the
// initial pass alone misses reflow-triggered container-size changes, and showcase cards
// rely on container size for ImageLoader's responsive resolution. Loading at page load
// (not on scroll) keeps the showcase fully painted before it's reached, so a normal
// scroll pins it instead of skipping it as the images populate late.
function loadAllImages() {
  if (!window.ImageLoader) { return; }
  var images = document.querySelectorAll('img[data-src]');
  for (var i = 0; i < images.length; i++) {
    window.ImageLoader.load(images[i], {
      load: true
    });
  }
}

window.addEventListener('DOMContentLoaded', function() {

  loadAllImages();

  var showcases = document.querySelectorAll('[data-showcase]');

  for (var j = 0; j < showcases.length; j++) {
    initShowcase(showcases[j]);
  }

});

window.addEventListener('resize', loadAllImages);
