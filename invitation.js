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

  // ---- generic fade/slide-in on scroll (IntersectionObserver) ----
  // Used for SECTION 3 (#details) and SECTION 4 (#credits): each section
  // fades in via its own .is-visible class once it enters the viewport.
  function initSectionReveal(sectionId) {
    var section = document.getElementById(sectionId);
    if (!section || !window.IntersectionObserver) {
      if (section) section.classList.add("is-visible");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            section.classList.add("is-visible");
            observer.unobserve(section);
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(section);
  }

  // ---- seat count from URL (?seats=N) ----
  // When a guest opens a link that already has ?seats=N (generated via
  // the button below), show that number immediately instead of the
  // default. Returns true if a valid seats param was found, so the
  // caller can treat this as "guest view" and hide the generator UI.
  function applySeatCountFromURL() {
    var el = document.getElementById("seat-count");
    if (!el) return false;

    var params = new URLSearchParams(window.location.search);
    var raw = params.get("seats");
    if (raw === null) return false;

    var trimmed = raw.trim();
    if (/^[0-9]+$/.test(trimmed) && parseInt(trimmed, 10) > 0) {
      el.textContent = trimmed;
      return true;
    }
    return false;
  }

  // ---- editable seat count (details section) ----
  // Digits only, and if the guest clears it entirely we restore the
  // original value on blur instead of leaving the sentence broken.
  // Only wired up in "host view" (no ?seats= in the URL) — see init().
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
  // shareable link (current page URL + ?seats=N). Only wired up in
  // "host view" — see init().
  function initLinkGenerator() {
    var btn = document.getElementById("generate-link-btn");
    var resultBox = document.getElementById("generated-link-box");
    var input = document.getElementById("generated-link-input");
    var copyBtn = document.getElementById("copy-link-btn");
    var copiedMsg = document.getElementById("link-copied-msg");
    var seatEl = document.getElementById("seat-count");
    if (!btn || !resultBox || !input || !copyBtn || !seatEl) return;

    btn.addEventListener("click", function () {
      seatEl.blur();

      var seats = seatEl.textContent.trim() || "2";
      var url = new URL(window.location.href);
      url.search = "";
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

  // ---- typewriter effect for the personal letter (SECTION 7 / #piece) ----
  // Blanks each <p> in .piece__letter, then types its real text back in
  // character by character, one paragraph at a time — the next paragraph
  // only starts once the current one is fully typed. Toggles the
  // .is-typing class (used by the existing CSS blinking-cursor ::after)
  // on whichever paragraph is currently being typed. Starts once #piece
  // scrolls into view; skipped entirely under prefers-reduced-motion,
  // leaving the real text in place immediately.
  // ---- Add to Calendar (Google Calendar link + downloadable .ics) ----
  // Both links are generated here from one set of event details, using
  // encodeURIComponent() so nothing needs to be hand-encoded — safer
  // than baking a pre-encoded URL/data-URI directly into the HTML.
  function initAddToCalendar(googleId, icsId) {
    var googleLink = document.getElementById(googleId);
    var icsLink = document.getElementById(icsId);
    if (!googleLink && !icsLink) return;

    var title = "An Evening of Elegance \u2014 Aika's 18th Birthday";
    var location = "PMS Prime Private Resort and Events Place";
    var description =
      "Join us for An Evening of Elegance as we celebrate Aika's " +
      "18th birthday. Semi-formal attire, please refrain from wearing pink.";
    // October 24, 2026, 5:00 PM\u201311:00 PM Philippine Time (UTC+8)
    // = 09:00\u201315:00 UTC. Adjust here if the actual end time differs.
    var startUTC = "20261024T090000Z";
    var endUTC = "20261024T150000Z";

    if (googleLink) {
      var googleURL = "https://calendar.google.com/calendar/render" +
        "?action=TEMPLATE" +
        "&text=" + encodeURIComponent(title) +
        "&dates=" + startUTC + "/" + endUTC +
        "&details=" + encodeURIComponent(description) +
        "&location=" + encodeURIComponent(location);
      googleLink.href = googleURL;
    }

    if (icsLink) {
      var icsLines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Aika 18th Birthday//Invitation//EN",
        "BEGIN:VEVENT",
        "UID:aika-18th-birthday-2026@invitation.local",
        "DTSTAMP:" + startUTC,
        "DTSTART:" + startUTC,
        "DTEND:" + endUTC,
        "SUMMARY:" + title,
        "DESCRIPTION:" + description.replace(/,/g, "\\,"),
        "LOCATION:" + location,
        "END:VEVENT",
        "END:VCALENDAR"
      ];
      var icsContent = icsLines.join("\r\n");
      icsLink.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsContent);
    }
  }

  // ---- Save the Date gate — mandatory first screen ----
  // Adds .is-active (making the gate visible/fixed) only when JS can also
  // wire up the Continue button, so a guest is never trapped if something
  // goes wrong. Clicking a calendar button does NOT dismiss the gate —
  // only the explicit "View the Invitation" button does.
  function initSaveTheDateGate() {
    var gate = document.getElementById("save-the-date");
    var continueBtn = document.getElementById("std-continue");
    var hint = document.getElementById("std-continue-hint");
    var googleBtn = document.getElementById("std-calendar-google");
    var icsBtn = document.getElementById("std-calendar-ics");
    if (!gate || !continueBtn) return;

    gate.classList.add("is-active");
    document.body.classList.add("gate-active");

    // Continue starts disabled (also set in HTML as a no-JS-safe default).
    // Clicking EITHER calendar option unlocks it — the guest only needs
    // to save the date on whichever platform they actually use.
    function unlockContinue() {
      continueBtn.disabled = false;
      if (hint) hint.classList.add("is-hidden");
    }

    if (googleBtn) googleBtn.addEventListener("click", unlockContinue);
    if (icsBtn) icsBtn.addEventListener("click", unlockContinue);

    continueBtn.addEventListener("click", function () {
      if (continueBtn.disabled) return;
      gate.classList.add("is-dismissing");
      document.body.classList.remove("gate-active");
      // wait for the opacity transition (0.6s in CSS) before fully
      // removing the gate from layout/interaction
      window.setTimeout(function () {
        gate.classList.remove("is-active", "is-dismissing");
      }, 650);
    });
  }

  function initLetterTypewriter() {
    var letter = document.querySelector(".piece__letter");
    if (!letter) return;

    var paragraphs = Array.prototype.slice.call(letter.querySelectorAll("p"));
    if (!paragraphs.length) return;

    var reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return; // real text already in place — nothing to do

    var originalTexts = paragraphs.map(function (p) { return p.textContent; });
    paragraphs.forEach(function (p) { p.textContent = ""; });

    var CHAR_DELAY = 8; // ms per character

    function typeParagraph(index) {
      if (index >= paragraphs.length) return;
      var p = paragraphs[index];
      var text = originalTexts[index];
      var i = 0;

      p.classList.add("is-typing");

      function step() {
        p.textContent = text.slice(0, i);
        i++;
        if (i <= text.length) {
          window.setTimeout(step, CHAR_DELAY);
        } else {
          p.classList.remove("is-typing");
          typeParagraph(index + 1);
        }
      }

      step();
    }

    var piece = document.getElementById("piece");
    if (!piece || !window.IntersectionObserver) {
      typeParagraph(0);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            typeParagraph(0);
            observer.unobserve(piece);
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(piece);
  }

  // ---- host view vs guest view ----
  // A link with ?seats=N in it is what you send to a guest — on that
  // link, the seat number is filled in automatically and the "Generate
  // Link" tool (and the ability to edit the number) is hidden, so the
  // guest only ever sees their invitation, never the editing controls.
  // The plain link (no ?seats=) is your own "host view" where you can
  // still edit the number and generate new links for other guests.
  function initSeatFeature() {
    var isGuestView = applySeatCountFromURL();

    var generatorEl = document.querySelector(".link-generator");

    if (isGuestView) {
      if (generatorEl) {
        generatorEl.hidden = true;
        generatorEl.style.display = "none"; // belt-and-suspenders: guarantees hiding even if a CSS rule targets .link-generator directly
      }
      // seat number stays visible but not editable for guests
      var seatEl = document.getElementById("seat-count");
      if (seatEl) {
        seatEl.removeAttribute("contenteditable");
        seatEl.classList.remove("seat-count");
      }
    } else {
      initSeatCount();
      initLinkGenerator();
    }
  }

  function init() {
    buildSignature();
    addAccessibleHeading();
    update();
    playLoadFade();
    initSaveTheDateGate();
    initSectionReveal("details");
    initSectionReveal("credits");
    initSectionReveal("treasures");
    initSectionReveal("shots");
    initSectionReveal("piece");
    initAddToCalendar("std-calendar-google", "std-calendar-ics");
    initLetterTypewriter();
    initSeatFeature();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
