
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
  var gestureGapMs = 120;      // idle gap that separates one scroll gesture (flick) from the next
  var lastWheelTime = 0;       // timestamp of the previous wheel event
  var fallbackMs = 700;        // guaranteed-progress floor: a held scroll still steps this often (no freeze)
  var lastStep = 0;            // timestamp of the last actual card step
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

  // Shared step logic for wheel + touch. dir: +1 down, -1 up. allowStep gates the actual card advance.
  // Returns true if the gesture was consumed (caller should preventDefault); false to release to native snap.
  // Gesture-based with a guaranteed-progress floor. A discrete flick advances ~ONE card: the flick's
  // trailing inertia keeps firing wheel events, but they share the gesture (allowStep=false) so the
  // section stays pinned WITHOUT stepping - stops a single hard flick from walking through every card,
  // and catches an inertial scroll entering from the neighbouring section. The floor (see wheel handler)
  // still lets a sustained scroll step every fallbackMs, so a continuous stream can never freeze - it
  // steps steadily and releases at the last card. allowStep records lastStep so the floor measures from
  // the last real advance.
  function handle(dir, allowStep) {
    if (!coversCenter()) { return false; }      // not the dominant section - leave native scroll alone
    var atBoundary = (dir > 0 && index === cards.length - 1) ||
                     (dir < 0 && index === 0);
    if (atBoundary) { return false; }          // let native snap move to the next/prev section
    // Force-seat to the snap line if a fast flick left the section mid-viewport, so cards always
    // swap from the aligned frame (otherwise the section can be pinned half-scrolled and look skipped).
    if (!aligned()) {
      window.scrollTo(0, window.pageYOffset + section.getBoundingClientRect().top - headerHeight());
    }
    if (allowStep) { setActive(index + dir); lastStep = Date.now(); }
    return true;                               // pinned: consume the gesture (step or hold)
  }

  window.addEventListener('wheel', function (e) {
    if (e.deltaY === 0) { return; }
    var now = Date.now();
    var freshGesture = (now - lastWheelTime) > gestureGapMs;   // inertia from one flick shares a gesture
    lastWheelTime = now;
    // Step on a fresh flick, OR on the fallback floor so a non-stop wheel stream can never stall.
    var allow = freshGesture || (now - lastStep >= fallbackMs);
    if (handle(e.deltaY > 0 ? 1 : -1, allow)) { e.preventDefault(); }
  }, { passive: false });

  window.addEventListener('touchstart', function (e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    if (touchStartY === null) { return; }
    var delta = touchStartY - e.touches[0].clientY;   // drag up (next) = positive
    if (Math.abs(delta) < touchThreshold) { return; }
    if (handle(delta > 0 ? 1 : -1, true)) {           // threshold+reset already gate touch steps
      e.preventDefault();
      touchStartY = e.touches[0].clientY;             // reset so the next step needs a fresh drag
    }
  }, { passive: false });

  window.addEventListener('touchend', function () {
    touchStartY = null;
  }, { passive: true });
}

// Gallery carousel controller.
// A [data-gallery] section shows a fixed window of three [data-gallery-card]s in a clipped
// [data-gallery-track]; the chevrons ([data-gallery-prev|next]) slide the track one card per click
// (no scroll hijack - unlike the showcase). The dots ([data-gallery-dot], one per card) highlight the
// leftmost visible card and click to jump the window there. Horizontal sibling of initShowcase;
// styles in site.less .section-fill--gallery.
function initGallery(section) {
  var track = section.querySelector('[data-gallery-track]');
  if (!track) { return; }                                // empty/unlinked gallery: nothing to drive
  var cards = section.querySelectorAll('[data-gallery-card]');
  var dots = section.querySelectorAll('[data-gallery-dot]');
  var prev = section.querySelector('[data-gallery-prev]');
  var next = section.querySelector('[data-gallery-next]');

  var visible = 3;             // cards shown at once (matches the site.less third-width card)
  var index = 0;              // leftmost visible card

  // Furthest the window can slide: last full window of three sits flush at the end.
  function maxIndex() { return Math.max(0, cards.length - visible); }

  // One card's left-edge advance = card width + gap. Measured from the first two cards so it tracks the
  // vw-based widths/gaps at any viewport size (recomputed on resize). Single card: just its width.
  function step() {
    if (cards.length < 2) { return cards.length ? cards[0].getBoundingClientRect().width : 0; }
    return cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
  }

  function update() {
    track.style.transform = 'translateX(' + (-index * step()) + 'px)';
    for (var d = 0; d < dots.length; d++) {
      if (d === index) { dots[d].classList.add('is-active'); }
      else { dots[d].classList.remove('is-active'); }
    }
    if (prev) { prev.disabled = (index === 0); }         // disable at the bounds
    if (next) { next.disabled = (index >= maxIndex()); }
  }

  if (prev) {
    prev.addEventListener('click', function () {
      if (index > 0) { index--; update(); }
    });
  }
  if (next) {
    next.addEventListener('click', function () {
      if (index < maxIndex()) { index++; update(); }
    });
  }

  // Dots jump the window straight to a card. The last (visible-1) dots can't be a leftmost index,
  // so clicking one clamps to maxIndex() (the last full window). IIFE captures di in this var scope.
  for (var i = 0; i < dots.length; i++) {
    (function (di) {
      dots[di].addEventListener('click', function () {
        index = di > maxIndex() ? maxIndex() : di;
        update();
      });
    })(i);
  }

  // Recompute on resize - step() depends on the vw-based card width. visible is fixed, so index stays valid.
  window.addEventListener('resize', update);

  update();                                              // seat dot 0 + chevron disabled states
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

  var galleries = document.querySelectorAll('[data-gallery]');

  for (var g = 0; g < galleries.length; g++) {
    initGallery(galleries[g]);
  }

});

window.addEventListener('resize', loadAllImages);
