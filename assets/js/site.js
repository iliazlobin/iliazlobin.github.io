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
            // keep the active item visible in a horizontal (mobile) rail.
            // Scroll the nav strip HORIZONTALLY only via scrollLeft — never
            // scrollIntoView, which also scrolls the page vertically and yanks
            // the viewport back up to the rail as you read down the feed.
            var nav = link.parentNode;
            if (nav && nav.scrollWidth > nav.clientWidth) {
              var navRect = nav.getBoundingClientRect();
              var linkRect = link.getBoundingClientRect();
              var delta = (linkRect.left + linkRect.width / 2) -
                          (navRect.left + navRect.width / 2);
              nav.scrollLeft += delta;
            }
          }
        }
      });
    }, { rootMargin: "-15% 0px -75% 0px", threshold: 0 });

    document.querySelectorAll(".portfolio-feed .portfolio-item").forEach(function (s) { io.observe(s); });
  }

  /* ---------------------------------------------------------------------
     5) Blog tag filtering: a token/autocomplete input. Type to search tags,
        Enter/click to add a token, Backspace to remove. Filtering is applied
        in place with a fade animation; selection syncs to the URL (?tag=a,b).
        Semantics: OR — a post shows if it has ANY selected tag.
     --------------------------------------------------------------------- */
  function setupBlogFilter() {
    var root = document.querySelector("[data-blog-filter]");
    var feed = document.querySelector("[data-blog-feed]");
    if (!root || !feed) return;
    var box = root.querySelector("[data-tag-input]");
    if (!box) return;
    var field = box.querySelector(".ti-field");
    var tokensWrap = box.querySelector(".ti-tokens");
    var suggest = box.querySelector(".ti-suggest");
    var countEl = root.querySelector("[data-result-count]");
    var clearBtn = root.querySelector("[data-tag-clear]");
    // Works for BOTH layouts: the blog timeline (.tl-item) and the design/category
    // pages (.portfolio-item). Design pages have no year dividers (the loop no-ops) and a
    // sticky rail whose entries must hide alongside their filtered-out cards.
    var cards = Array.prototype.slice.call(feed.querySelectorAll(".tl-item, .portfolio-item"));
    var dividers = Array.prototype.slice.call(feed.querySelectorAll(".year-divider"));
    var railLinks = Array.prototype.slice.call(document.querySelectorAll(".portfolio-rail a[data-tags]"));
    var noun = root.getAttribute("data-count-noun") || "post";
    var noRes = document.querySelector(".no-results");

    var allTags = [];
    var dataEl = document.querySelector("[data-blog-tags]");
    if (dataEl) { try { allTags = JSON.parse(dataEl.textContent); } catch (e) {} }
    allTags.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var selected = [];

    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
      });
    }
    function isTag(name) {
      for (var i = 0; i < allTags.length; i++) { if (allTags[i].name === name) return true; }
      return false;
    }
    function matches(card) {
      if (!selected.length) return true;
      var tags = (card.getAttribute("data-tags") || "").split("|");
      for (var i = 0; i < selected.length; i++) { if (tags.indexOf(selected[i]) > -1) return true; }
      return false;
    }

    function applyFilter() {
      var visible = 0;
      cards.forEach(function (card) {
        var show = matches(card);
        if (show) visible++;
        var hidden = card.style.display === "none";
        if (show && hidden) {
          card.style.display = "";
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { card.classList.remove("is-filtered"); });
          });
        } else if (show) {
          card.classList.remove("is-filtered");
        } else if (!card.classList.contains("is-filtered")) {
          card.classList.add("is-filtered");
          setTimeout(function () { if (!matches(card)) card.style.display = "none"; }, 240);
        }
      });
      dividers.forEach(function (d) {
        var n = d.nextElementSibling, has = false;
        while (n && !n.classList.contains("year-divider")) {
          if (n.classList.contains("tl-item") && matches(n)) { has = true; break; }
          n = n.nextElementSibling;
        }
        d.style.display = has ? "" : "none";
      });
      railLinks.forEach(function (a) { a.style.display = matches(a) ? "" : "none"; });
      if (noRes) noRes.hidden = visible > 0;
      if (countEl) countEl.textContent = visible + " " + noun + (visible === 1 ? "" : "s");
      if (clearBtn) clearBtn.hidden = selected.length === 0;
      var url = new URL(window.location);
      if (selected.length) url.searchParams.set("tag", selected.join(",")); else url.searchParams.delete("tag");
      history.replaceState(null, "", url);
    }

    function renderTokens() {
      tokensWrap.innerHTML = "";
      selected.forEach(function (name) {
        var tok = document.createElement("span");
        tok.className = "ti-token";
        tok.innerHTML = "<span>" + esc(name) + "</span><button type=\"button\" aria-label=\"Remove " + esc(name) + "\">×</button>";
        tok.querySelector("button").addEventListener("click", function (e) { e.stopPropagation(); removeTag(name); });
        tokensWrap.appendChild(tok);
      });
    }
    function addTag(name) {
      if (!name || selected.indexOf(name) > -1 || !isTag(name)) return;
      selected.push(name);
      renderTokens(); field.value = ""; closeSuggest(); applyFilter(); field.focus();
    }
    function removeTag(name) {
      selected = selected.filter(function (s) { return s !== name; });
      renderTokens(); applyFilter(); field.focus();
    }

    function highlight(name, q) {
      if (!q) return esc(name);
      var idx = name.toLowerCase().indexOf(q);
      if (idx < 0) return esc(name);
      return esc(name.slice(0, idx)) + "<strong>" + esc(name.slice(idx, idx + q.length)) + "</strong>" + esc(name.slice(idx + q.length));
    }
    function openSuggest() {
      var q = (field.value || "").toLowerCase().trim();
      var avail = allTags.filter(function (t) { return selected.indexOf(t.name) < 0 && t.name.toLowerCase().indexOf(q) > -1; });
      if (!avail.length) { closeSuggest(); return; }
      suggest.innerHTML = avail.map(function (t, i) {
        return "<button type=\"button\" class=\"ti-opt" + (i === 0 ? " active" : "") + "\" role=\"option\" data-name=\"" + esc(t.name) + "\">" +
               highlight(t.name, q) + " <span class=\"ti-c\">" + t.count + "</span></button>";
      }).join("");
      suggest.hidden = false;
      Array.prototype.slice.call(suggest.querySelectorAll(".ti-opt")).forEach(function (o) {
        o.addEventListener("mousedown", function (e) { e.preventDefault(); addTag(o.getAttribute("data-name")); });
      });
    }
    function closeSuggest() { suggest.hidden = true; suggest.innerHTML = ""; }
    function moveActive(dir) {
      var opts = Array.prototype.slice.call(suggest.querySelectorAll(".ti-opt"));
      if (!opts.length) return;
      var i = -1; opts.forEach(function (o, idx) { if (o.classList.contains("active")) i = idx; });
      if (i > -1) opts[i].classList.remove("active");
      i = (i + dir + opts.length) % opts.length;
      opts[i].classList.add("active"); opts[i].scrollIntoView({ block: "nearest" });
    }

    field.addEventListener("input", openSuggest);
    field.addEventListener("focus", openSuggest);
    field.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); var a = suggest.querySelector(".ti-opt.active"); if (a) addTag(a.getAttribute("data-name")); }
      else if (e.key === "Backspace" && field.value === "" && selected.length) { removeTag(selected[selected.length - 1]); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Escape") { closeSuggest(); }
    });
    box.addEventListener("click", function () { field.focus(); });
    document.addEventListener("click", function (e) { if (!box.contains(e.target)) closeSuggest(); });
    if (clearBtn) clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!selected.length) return;
      selected = [];
      renderTokens(); applyFilter(); field.focus();
    });

    // "Clear filter" button inside the no-results message — wire it to the same clear action
    var filterClearBtn = document.querySelector("[data-filter-clear]");
    if (filterClearBtn) filterClearBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (!selected.length) return;
      selected = [];
      renderTokens(); applyFilter(); field.focus();
    });

    // in-card tag chips add to the filter instead of navigating away
    Array.prototype.slice.call(feed.querySelectorAll(".tag[data-tag]")).forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        addTag(a.getAttribute("data-tag"));
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });

    if (countEl) countEl.textContent = cards.length + " " + noun + (cards.length === 1 ? "" : "s");

    // initial selection from ?tag=a,b (e.g. arriving from a single post's tag link)
    var initial = new URL(window.location).searchParams.get("tag");
    if (initial) {
      initial.split(",").forEach(function (n) {
        n = n.trim();
        if (isTag(n) && selected.indexOf(n) < 0) selected.push(n);
      });
      if (selected.length) { renderTokens(); applyFilter(); }
    }
  }

  /* ---------------------------------------------------------------------
     6) Heading anchors: hover a post heading to reveal a # link; click it to
        copy a deep link to that section to the clipboard.
     --------------------------------------------------------------------- */
  function setupHeadingAnchors() {
    var content = document.querySelector(".post-content");
    if (!content) return;
    var heads = Array.prototype.slice.call(content.querySelectorAll("h2[id], h3[id], h4[id]"));
    heads.forEach(function (h) {
      h.classList.add("anchored-heading");
      h.setAttribute("title", "Click to copy link to this section");
      h.addEventListener("click", function () {
        var url = window.location.origin + window.location.pathname + "#" + h.id;
        if (history.replaceState) history.replaceState(null, "", "#" + h.id);
        var done = function () { h.classList.add("copied"); setTimeout(function () { h.classList.remove("copied"); }, 1300); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, done);
        } else { done(); }
      });
    });
  }

  function init() {
    setupCallouts();   // before reveal, so callouts can also animate
    setupInfinite();
    setupReveal();
    setupScrollspy();
    setupBlogFilter();
    setupHeadingAnchors();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
