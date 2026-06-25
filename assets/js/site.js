/* =========================================================================
   site.js — progressive reveal ("infinite scroll") + Notion-style callouts
   No dependencies. Safe to load with `defer` on every page.
   ========================================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------------
     1) Reveal-on-scroll for any [.reveal] element.
     --------------------------------------------------------------------- */
  function setupReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!items.length) return;
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------------
     2) Infinite scroll: containers marked [data-infinite] reveal their
        children in batches as a sentinel scrolls into view. Content stays
        in the DOM (good for SEO) — only display is toggled.
     --------------------------------------------------------------------- */
  function setupInfinite() {
    var containers = Array.prototype.slice.call(document.querySelectorAll("[data-infinite]"));
    containers.forEach(function (container) {
      var items = Array.prototype.slice.call(container.children);
      var batch = parseInt(container.getAttribute("data-batch"), 10) || 6;
      var initial = parseInt(container.getAttribute("data-initial"), 10) || batch;
      var shown = 0;

      function showNext(count) {
        var end = Math.min(shown + count, items.length);
        for (; shown < end; shown++) {
          var el = items[shown];
          el.style.display = "";
          el.classList.add("reveal");
          // next frame so the transition fires
          (function (node) {
            requestAnimationFrame(function () {
              requestAnimationFrame(function () { node.classList.add("is-visible"); });
            });
          })(el);
        }
        return shown >= items.length;
      }

      if (items.length <= initial || !("IntersectionObserver" in window)) {
        items.forEach(function (el) { el.style.display = ""; el.classList.add("is-visible"); });
        return;
      }

      // hide everything beyond the initial set
      items.forEach(function (el, i) { if (i >= initial) el.style.display = "none"; });
      shown = initial;

      var sentinel = document.createElement("div");
      sentinel.className = "load-sentinel";
      container.parentNode.insertBefore(sentinel, container.nextSibling);

      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          var done = showNext(batch);
          if (done) { io.disconnect(); sentinel.remove(); }
        }
      }, { rootMargin: "240px 0px" });
      io.observe(sentinel);
    });
  }

  /* ---------------------------------------------------------------------
     3) Notion-style callouts from GitHub alert blockquotes:
          > [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION]
     --------------------------------------------------------------------- */
  var CALLOUTS = {
    NOTE:      { cls: "callout-note",      icon: "ℹ️", label: "Note" },
    TIP:       { cls: "callout-tip",       icon: "💡", label: "Tip" },
    IMPORTANT: { cls: "callout-important", icon: "📌", label: "Important" },
    WARNING:   { cls: "callout-warning",   icon: "⚠️", label: "Warning" },
    CAUTION:   { cls: "callout-caution",   icon: "🛑", label: "Caution" }
  };

  function setupCallouts() {
    var quotes = document.querySelectorAll(".post-content blockquote");
    Array.prototype.forEach.call(quotes, function (bq) {
      var first = bq.querySelector("p");
      if (!first) return;
      var m = first.innerHTML.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br\s*\/?>)?/i);
      if (!m) return;
      var type = CALLOUTS[m[1].toUpperCase()];
      if (!type) return;

      // strip the marker token from the first paragraph
      first.innerHTML = first.innerHTML.replace(m[0], "");
      if (!first.innerHTML.trim()) first.parentNode.removeChild(first);

      var box = document.createElement("div");
      box.className = "callout " + type.cls;
      box.setAttribute("role", "note");
      box.innerHTML =
        '<div class="callout-icon" aria-hidden="true">' + type.icon + '</div>' +
        '<div class="callout-body"><div class="callout-title">' + type.label + '</div></div>';
      var body = box.querySelector(".callout-body");
      while (bq.firstChild) body.appendChild(bq.firstChild);
      bq.parentNode.replaceChild(box, bq);
    });
  }

  /* ---------------------------------------------------------------------
     4) Scrollspy: highlight the portfolio rail link for the project
        currently in view.
     --------------------------------------------------------------------- */
  function setupScrollspy() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".portfolio-rail [data-spy]"));
    if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {};
    links.forEach(function (l) { map[l.getAttribute("href").slice(1)] = l; });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove("active"); });
          var link = map[e.target.id];
          if (link) {
            link.classList.add("active");
            // keep the active item visible in a horizontal (mobile) rail
            if (link.scrollIntoView) {
              var nav = link.parentNode;
              if (nav && nav.scrollWidth > nav.clientWidth) {
                link.scrollIntoView({ block: "nearest", inline: "center" });
              }
            }
          }
        }
      });
    }, { rootMargin: "-15% 0px -75% 0px", threshold: 0 });

    document.querySelectorAll(".portfolio-feed .portfolio-item").forEach(function (s) { io.observe(s); });
  }

  /* ---------------------------------------------------------------------
     5) Blog tag filtering: filter the post feed by topic in place, sync
        the chosen tag to the URL (?tag=), and hide empty year dividers.
     --------------------------------------------------------------------- */
  function setupBlogFilter() {
    var root = document.querySelector("[data-blog-filter]");
    var feed = document.querySelector("[data-blog-feed]");
    if (!root || !feed) return;

    var chips = Array.prototype.slice.call(root.querySelectorAll(".chip-filter"));
    var cards = Array.prototype.slice.call(feed.querySelectorAll(".post-card"));
    var dividers = Array.prototype.slice.call(feed.querySelectorAll(".year-divider"));
    var inCardTags = Array.prototype.slice.call(feed.querySelectorAll(".pc-tags .tag"));
    var noRes = document.querySelector(".no-results");
    var clearBtn = document.querySelector("[data-filter-clear]");

    function apply(filter, scroll) {
      filter = filter || "*";
      var anyVisible = false;
      cards.forEach(function (c) {
        var tags = (c.getAttribute("data-tags") || "").split("|");
        var show = filter === "*" || tags.indexOf(filter) > -1;
        c.style.display = show ? "" : "none";
        if (show) anyVisible = true;
      });
      // hide a year divider when none of the cards under it are visible
      dividers.forEach(function (d) {
        var n = d.nextElementSibling, has = false;
        while (n && !n.classList.contains("year-divider")) {
          if (n.classList.contains("post-card") && n.style.display !== "none") { has = true; break; }
          n = n.nextElementSibling;
        }
        d.style.display = has ? "" : "none";
      });
      chips.forEach(function (ch) {
        ch.classList.toggle("is-active", (ch.getAttribute("data-filter") || "*") === filter);
      });
      if (noRes) noRes.hidden = anyVisible;

      var url = new URL(window.location);
      if (filter === "*") url.searchParams.delete("tag"); else url.searchParams.set("tag", filter);
      history.replaceState(null, "", url);

      if (scroll && root.scrollIntoView) root.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    chips.forEach(function (ch) {
      ch.addEventListener("click", function () { apply(ch.getAttribute("data-filter")); });
    });
    inCardTags.forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); apply(a.getAttribute("data-tag"), true); });
    });
    if (clearBtn) clearBtn.addEventListener("click", function () { apply("*"); });

    // initial filter from ?tag= (e.g. arriving from a single post's tag link)
    var initial = new URL(window.location).searchParams.get("tag");
    if (initial) {
      var match = chips.some(function (ch) { return ch.getAttribute("data-filter") === initial; });
      if (match) apply(initial);
    }
  }

  function init() {
    setupCallouts();   // before reveal, so callouts can also animate
    setupInfinite();
    setupReveal();
    setupScrollspy();
    setupBlogFilter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
