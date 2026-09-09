/* ==========================================================================
   AIKA — scroll-driven "Love, Aika" morph
   The signature text lives as ONE fixed-position element. On every scroll
   frame we measure where it should be (position + font-size) by
   interpolating between its "hero" state (centered, huge, on the landing
   section) and its "settled" state (small, sitting inside the homepage
   panel, matching the reference layout).
   ========================================================================== */

(function () {
  "use strict";

  var track   = document.getElementById("morph-track");
  var slot    = document.getElementById("signature-slot");
  var scrollHint = document.querySelector(".scroll-hint");
  var signature;

  // ---- build the signature element once ----
  function buildSignature() {
    signature = document.createElement("div");
    signature.id = "signature";
    signature.setAttribute("aria-hidden", "true"); // decorative echo; real text is in the DOM flow elsewhere for a11y
    signature.innerHTML =
      '<span class="word word--love">Love,</span>' +
      '<span class="word word--aika">Aika</span>';
    document.body.appendChild(signature);
  }

  // ---- accessible, non-animated text for screen readers ----
  function addAccessibleHeading() {
    var h1 = document.createElement("h1");
    h1.className = "sr-only-signature";
    h1.style.position = "absolute";
    h1.style.width = "1px";
    h1.style.height = "1px";
    h1.style.overflow = "hidden";
    h1.style.clip = "rect(0 0 0 0)";
    h1.textContent = "Love, Aika — An Evening of Elegance, October 24, 2026";
    document.body.insertBefore(h1, document.body.firstChild);
  }

  // ---- measurement helpers ----
  // Both states return the CENTER POINT of where the signature block's
  // visual center should sit, plus the font-size to use. Because we always
  // measure the signature's OWN rendered size (see measureSignatureAt) and
  // anchor by its true center, "centerX/centerY" here means the exact same
  // thing in both states — no more guessed %-offsets that only look right
  // at one particular width.

  // HERO state: centered in the landing viewport, large.
  function getHeroRect() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var fontSize = clamp(vw * 0.11, 64, 168); // big, matches "Love," headline scale
    return {
      centerX: vw / 2,
      centerY: vh * 0.60, // sits in the reserved .landing__stack area
      fontSize: fontSize
    };
  }

  // SETTLED state: matches the reserved slot inside the homepage panel.
  function getSettledRect() {
    var r = slot.getBoundingClientRect();
    // Font-size driven primarily off slot HEIGHT (not width) so the two-line
    // script signature reliably fits inside the reserved box on any viewport,
    // including narrow mobile widths where panel width stays large but the
    // slot height is comparatively tighter.
    var fontSize = clamp(r.height * 0.46, 28, 66);
    var padLeft = parseFloat(getComputedStyle(slot).paddingLeft) || 0;
    var contentWidth = Math.max(r.width - padLeft, 0);
    return {
      centerX: r.left + padLeft + contentWidth / 2,
      centerY: r.top + r.height / 2,
      fontSize: fontSize
    };
  }

  // ---- measure the signature's OWN rendered box at a given font-size ----
  // We set the font-size first (this affects layout), then read back the
  // element's actual width/height. This replaces the old fixed "-42%"
  // guess: instead of assuming where the ink sits inside the box, we ask
  // the browser directly, every frame, at the exact size we're about to
  // show it at.
  function measureSignatureAt(fontSize) {
    signature.style.fontSize = fontSize + "px";
    var box = signature.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ---- scroll progress across the morph track ----
  function getProgress() {
    var trackRect = track.getBoundingClientRect();
    var trackTop = trackRect.top;
    var trackHeight = trackRect.height;
    var vh = window.innerHeight;

    // progress = 0 when track's top reaches viewport top (landing fully shown, about to leave)
    // progress = 1 when track's bottom reaches viewport top (homepage fully in place)
    var raw = (0 - trackTop) / (trackHeight - vh * 0.15);
    return clamp(raw, 0, 1);
  }

  var ticking = false;

  function update() {
    ticking = false;

    var p = getProgress();
    var eased = easeInOutCubic(p);

    var hero = getHeroRect();
    var settled = getSettledRect();

    var cx = lerp(hero.centerX, settled.centerX, eased);
    var cy = lerp(hero.centerY, settled.centerY, eased);
    var fs = lerp(hero.fontSize, settled.fontSize, eased);

    // Set font-size FIRST, then measure the box it produces at that size.
    // This is the fix: instead of guessing a fixed "-42%, -50%" offset that
    // only lines up correctly at one specific size/width, we ask the
    // browser for the real rendered box every frame and center THAT.
    var box = measureSignatureAt(fs);

    signature.style.left = cx + "px";
    signature.style.top = cy + "px";
    // translate by exactly half the measured box in each axis — this is a
    // true geometric center, valid at every scroll position, not an
    // eyeballed percentage.
    signature.style.transform =
      "translate(" + (-box.width / 2) + "px, " + (-box.height / 2) + "px)";

    // ambient florals: fade slightly as we settle into the homepage
    document.querySelectorAll(".floral").forEach(function (f) {
      f.style.opacity = String(lerp(0.9, 0.5, eased));
    });

    // hide the scroll hint as soon as the user starts scrolling —
    // uses raw scrollY directly (not morph progress) so it reacts to
    // the very first pixel of scroll, not just after the morph track
    // math clears its threshold.
    if (scrollHint) {
      if (window.scrollY > 10) {
        scrollHint.classList.add("is-hidden");
      } else {
        scrollHint.classList.remove("is-hidden");
      }
    }
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  // ---- first-visit fade-in ----
  // Both .landing__inner and #signature fade in together, driven purely by
  // the body.is-loading class (see style.css). We only need to remove the
  // class one frame after paint so the browser registers the initial
  // (hidden) state before the transition starts — otherwise the browser
  // may collapse the "from" and "to" states into a single frame and skip
  // the animation entirely.
  function playLoadFade() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        document.body.classList.remove("is-loading");
      });
    });
  }

  // ---- SECTION 3 fade/slide-in on scroll (IntersectionObserver) ----
  function initDetailsReveal() {
    var details = document.getElementById("details");
    if (!details || !window.IntersectionObserver) {
      if (details) details.classList.add("is-visible");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            details.classList.add("is-visible");
            observer.unobserve(details);
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(details);
  }

  // ---- editable seat count (details section) ----
  // Digits only, and if the guest clears it entirely we restore the
  // original value on blur instead of leaving the sentence broken.
  function initSeatCount() {
    var el = document.getElementById("seat-count");
    if (!el) return;

    var defaultValue = el.textContent.trim() || "2";

    el.addEventListener("beforeinput", function (e) {
      if (e.data && /[^0-9]/.test(e.data)) {
        e.preventDefault();
      }
    });

    el.addEventListener("input", function () {
      var digitsOnly = el.textContent.replace(/[^0-9]/g, "");
      if (digitsOnly !== el.textContent) {
        el.textContent = digitsOnly;
        var range = document.createRange();
        var sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    el.addEventListener("blur", function () {
      var val = el.textContent.trim();
      el.textContent = val === "" ? defaultValue : val;
    });

    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      }
    });
  }

  // ---- Generate Link button ----
  // Takes whatever number is currently in #seat-count and builds a
  // shareable link (current page URL + ?seats=N) so that opening that
  // link later will show this same seat count. Also wires up the
  // Copy button and a short "Na-copy sa clipboard!" confirmation.
  function initLinkGenerator() {
    var btn = document.getElementById("generate-link-btn");
    var resultBox = document.getElementById("generated-link-box");
    var input = document.getElementById("generated-link-input");
    var copyBtn = document.getElementById("copy-link-btn");
    var copiedMsg = document.getElementById("link-copied-msg");
    var seatEl = document.getElementById("seat-count");
    if (!btn || !resultBox || !input || !copyBtn || !seatEl) return;

    btn.addEventListener("click", function () {
      // make sure any in-progress edit is committed before reading the value
      seatEl.blur();

      var seats = seatEl.textContent.trim() || "2";
      var url = new URL(window.location.href);
      url.search = ""; // drop any existing query params first
      url.searchParams.set("seats", seats);

      input.value = url.toString();
      resultBox.hidden = false;
      copiedMsg.hidden = true;
      input.focus();
      input.select();
    });

    copyBtn.addEventListener("click", function () {
      input.select();
      input.setSelectionRange(0, input.value.length);

      function showCopied() {
        copiedMsg.hidden = false;
        window.clearTimeout(showCopied._t);
        showCopied._t = window.setTimeout(function () {
          copiedMsg.hidden = true;
        }, 2000);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(showCopied).catch(function () {
          document.execCommand("copy");
          showCopied();
        });
      } else {
        document.execCommand("copy");
        showCopied();
      }
    });
  }

  // ---- seat count from URL (?seats=N) ----
  // When a guest opens a link that already has ?seats=N (generated via
  // the button above), show that number immediately instead of the
  // default, so the recipient sees their own reserved seat count.
  function applySeatCountFromURL() {
    var el = document.getElementById("seat-count");
    if (!el) return;

    var params = new URLSearchParams(window.location.search);
    var raw = params.get("seats");
    if (raw === null) return;

    var trimmed = raw.trim();
    if (/^[0-9]+$/.test(trimmed) && parseInt(trimmed, 10) > 0) {
      el.textContent = trimmed;
    }
  }

  function init() {
    buildSignature();
    addAccessibleHeading();
    update();
    playLoadFade();
    initDetailsReveal();
    applySeatCountFromURL();
    initSeatCount();
    initLinkGenerator();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();