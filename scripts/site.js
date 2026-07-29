
// Plain browser script - NO require()/module imports. Squarespace serves /scripts files as-is, so
// a bare `require` throws "require is not defined" and kills the whole file. ImageLoader is a
// Squarespace runtime global (window.ImageLoader), used directly and guarded below - never bundled.

// Showcase pin controller (native sticky-scroll - NO wheel/touch hijack).
// The showcase (.showcase[data-showcase]) is a tall block with one native snap stop per card
// ([data-showcase-stop] in .showcase__rail) behind a position:sticky frame ([data-showcase-stage]).
// Native scroll + scroll-snap do ALL the stepping: smooth, one card per gesture, and the first/last
// cards are real snap stops so they can never be skipped. This controller never touches the scroll -
// it only reflects which stop is centred into the card slide (is-active/is-above/is-below on
// [data-showcase-card]) and the dots. IntersectionObserver is fine here (unlike the old hijack, which
// needed a synchronous engagement test to preventDefault): there is nothing to preventDefault, so a
// one-frame async lag only trails the visual slide - native snap already owns the motion.
// Styles: site.less .showcase / .section-fill--showcase.
function initShowcase(root) {
  var stage = root.querySelector('[data-showcase-stage]');
  var cards = root.querySelectorAll('[data-showcase-card]');
  var dots = root.querySelectorAll('[data-showcase-dot]');
  var stops = root.querySelectorAll('[data-showcase-stop]');
  var index = 0;

  // Set each card's state by its index relative to the new active one: earlier cards park ABOVE, later
  // cards park BELOW, active sits centred. Directional slide without tracking scroll direction. Keep the
  // progress dots in sync - exactly one active.
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
    for (var d = 0; d < dots.length; d++) {
      if (d === next) {
        dots[d].classList.add('is-active');
      } else {
        dots[d].classList.remove('is-active');
      }
    }
    index = next;
  }

  if (cards.length < 2) {
    // Single (or zero) card: nothing to step - just seat it.
    if (cards.length === 1) { cards[0].classList.add('is-active'); }
    if (stage) { stage.classList.add('is-ready'); }
    return;
  }

  // Seat card 0, then flip .is-ready on the stage so the CSS park positions engage with no entrance anim.
  setActive(0);
  if (stage) { stage.classList.add('is-ready'); }

  // Reflect the centred stop into the active card. rootMargin -50%/-50% collapses the root to a single
  // horizontal line at the viewport middle; the stop crossing it is the one filling the screen.
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].isIntersecting) { continue; }
      var idx = Array.prototype.indexOf.call(stops, entries[i].target);
      if (idx !== -1 && idx !== index) { setActive(idx); }
    }
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
  for (var s = 0; s < stops.length; s++) { io.observe(stops[s]); }
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
