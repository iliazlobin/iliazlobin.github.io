/* =========================================================================
   site.js — progressive reveal ("infinite scroll") + Notion-style callouts
   No dependencies. Safe to load with `defer` on every page.
   ========================================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var browserSelector = "[data-design-browser], [data-content-browser]";

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
    if (document.querySelector(browserSelector)) return;
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

  // Keep list navigation and filters still; move only the desktop card panel.
  function setupContentBrowser() {
    var browser = document.querySelector(browserSelector);
    if (!browser) return;
    var feed = browser.querySelector("[data-blog-feed]");
    var controls = browser.querySelector("[data-blog-filter]");
    var links = Array.prototype.slice.call(browser.querySelectorAll("[data-spy]"));
    var cards = Array.prototype.slice.call(feed.querySelectorAll(".portfolio-item"));
    var desktop = window.matchMedia("(min-width: 901px)");
    var frame = 0;
    var anchoredCard = null;
    document.body.classList.add("design-browser-page");

    function visibleCards() {
      return cards.filter(function (card) { return card.style.display !== "none"; });
    }
    function markActive(card) {
      links.forEach(function (link) {
        var active = !!card && link.getAttribute("href") === "#" + card.id;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }
    function updateActive() {
      frame = 0;
      var visible = visibleCards();
      var top = desktop.matches ? feed.getBoundingClientRect().top + 8 : controls.getBoundingClientRect().bottom + 16;
      var active = visible[0];
      visible.forEach(function (card) {
        if (card.getBoundingClientRect().top <= top) active = card;
      });
      markActive(active);
    }
    function queueActive() {
      if (!frame) frame = requestAnimationFrame(updateActive);
    }
    function alignCard(card) {
      var padding = parseFloat(getComputedStyle(feed).paddingTop) || 0;
      feed.scrollTo({ top: card.offsetTop - padding, behavior: "instant" });
    }
    function measure() {
      browser.style.setProperty("--design-controls-height", controls.offsetHeight + "px");
      var visible = visibleCards();
      var last = visible[visible.length - 1];
      // Leave enough room to align even the final card with the panel's top.
      var tail = desktop.matches && last ? Math.max(16, feed.clientHeight - last.offsetHeight - 8) : 16;
      feed.style.setProperty("--design-feed-tail", tail + "px");
      // Lazy diagrams can change earlier card heights after a selection.
      if (desktop.matches && anchoredCard) alignCard(anchoredCard);
      queueActive();
    }
    function findCard(id) {
      return visibleCards().find(function (card) {
        return card.id === id || card.getAttribute("data-legacy-id") === id;
      });
    }
    function navigate(card) {
      if (!card) return;
      anchoredCard = desktop.matches ? card : null;
      if (desktop.matches) {
        alignCard(card);
      } else {
        window.scrollTo({ top: window.scrollY + card.getBoundingClientRect().top - controls.offsetHeight - 16,
          behavior: reduceMotion ? "auto" : "smooth" });
      }
      markActive(card);
      var url = new URL(window.location);
      url.hash = card.id;
      history.replaceState(null, "", url);
    }
    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(findCard(link.getAttribute("href").slice(1)));
      });
    });
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach(function (type) {
      feed.addEventListener(type, function () { anchoredCard = null; }, { passive: true });
    });
    feed.addEventListener("scroll", queueActive, { passive: true });
    feed.addEventListener("content:navigate", function (event) { navigate(findCard(event.detail)); });
    window.addEventListener("scroll", function () { if (!desktop.matches) queueActive(); }, { passive: true });
    window.addEventListener("hashchange", function () { navigate(findCard(decodeURIComponent(window.location.hash.slice(1)))); });
    window.addEventListener("resize", measure);
    feed.addEventListener("design:filter", function () {
      anchoredCard = null;
      feed.scrollTop = 0;
      measure();
      markActive(visibleCards()[0]);
    });
    if ("ResizeObserver" in window) {
      var observer = new ResizeObserver(measure);
      observer.observe(feed); observer.observe(controls);
      cards.forEach(function (card) { observer.observe(card); });
    }
    measure();
    requestAnimationFrame(function () {
      var card = findCard(decodeURIComponent(window.location.hash.slice(1)));
      if (card) navigate(card); else updateActive();
    });
  }

  /* ---------------------------------------------------------------------
     5) Topic tags use OR matching. On content lists, type and text
        search further narrow the results (AND). State syncs to the URL.
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
    var searchField = root.querySelector("[data-content-search]");
    var unifiedSearch = root.hasAttribute("data-unified-search");
    var typeButtons = Array.prototype.slice.call(root.querySelectorAll("[data-type-filter]"));
    // Blog timelines and card lists share filtering; rail entries follow their cards.
    var cards = Array.prototype.slice.call(feed.querySelectorAll(".tl-item, .portfolio-item"));
    var itemLabel = root.getAttribute("data-item-label") || "Article";
    var articles = cards.map(function (card) {
      var link = card.querySelector(".card-link");
      var title = link || card.querySelector("h3");
      return title ? { card: card, title: title.textContent.trim(), url: link ? link.getAttribute("href") : "#" + card.id } : null;
    }).filter(Boolean);
    var dividers = Array.prototype.slice.call(feed.querySelectorAll(".year-divider"));
    var railLinks = Array.prototype.slice.call(document.querySelectorAll(".portfolio-rail a[data-spy]"));
    var noun = root.getAttribute("data-count-noun") || "post";
    var noRes = document.querySelector(".no-results");
    var isPanelBrowser = !!feed.closest(browserSelector);

    var allTags = [];
    var dataEl = document.querySelector("[data-blog-tags]");
    if (dataEl) { try { allTags = JSON.parse(dataEl.textContent); } catch (e) {} }
    else {
      // Portfolio tags are authored once on each card, not in a second index.
      var tagCounts = new Map();
      cards.forEach(function (card) {
        (card.getAttribute("data-tags") || "").split("|").filter(Boolean).forEach(function (name) {
          tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
        });
      });
      tagCounts.forEach(function (count, name) { allTags.push({ name: name, count: count }); });
    }
    allTags.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var selected = [];
    var selectedType = "";
    var searchWords = [];

    function normalize(text) {
      return String(text).toLowerCase().replace(/[-_]+/g, " ").trim();
    }
    function isType(type) {
      return cards.some(function (card) { return cardTypes(card).indexOf(type) > -1; });
    }
    function cardTypes(card) {
      return (card.getAttribute("data-types") || card.getAttribute("data-type") || "").split("|");
    }

    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
      });
    }
    function isTag(name) {
      for (var i = 0; i < allTags.length; i++) { if (allTags[i].name === name) return true; }
      return false;
    }
    function tagLabel(name) {
      for (var i = 0; i < allTags.length; i++) { if (allTags[i].name === name) return allTags[i].label || name; }
      return name;
    }
    function matches(card) {
      if (selectedType && cardTypes(card).indexOf(selectedType) < 0) return false;
      var text = normalize(card.getAttribute("data-search") || card.textContent);
      if (!searchWords.every(function (word) { return text.indexOf(word) > -1; })) return false;
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
        if (isPanelBrowser) {
          card.style.display = show ? "" : "none";
          card.classList.remove("is-filtered");
          return;
        }
        var hidden = card.style.display === "none";
        if (show && hidden) {
          card.style.display = "";
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { if (matches(card)) card.classList.remove("is-filtered"); });
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
      railLinks.forEach(function (a) {
        var card = document.getElementById(a.getAttribute("href").slice(1));
        a.style.display = card && matches(card) ? "" : "none";
      });
      if (noRes) noRes.hidden = visible > 0;
      if (countEl) countEl.textContent = visible + " " + noun + (visible === 1 ? "" : "s");
      if (clearBtn) clearBtn.hidden = selected.length === 0 && !selectedType && !searchWords.length;
      typeButtons.forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.getAttribute("data-type-filter") === selectedType));
      });
      var url = new URL(window.location);
      if (selected.length) url.searchParams.set("tag", selected.join(",")); else url.searchParams.delete("tag");
      if (typeButtons.length) {
        if (selectedType) url.searchParams.set("type", selectedType); else url.searchParams.delete("type");
      }
      if (searchField) {
        if (searchWords.length) url.searchParams.set("q", searchField.value.trim()); else url.searchParams.delete("q");
      }
      history.replaceState(null, "", url);
      if (isPanelBrowser) feed.dispatchEvent(new Event("design:filter"));
    }

    function renderTokens() {
      tokensWrap.innerHTML = "";
      selected.forEach(function (name) {
        var tok = document.createElement("span");
        tok.className = "ti-token";
        var label = tagLabel(name);
        tok.innerHTML = "<span>" + esc(label) + "</span><button type=\"button\" aria-label=\"Remove " + esc(label) + "\">×</button>";
        tok.querySelector("button").addEventListener("click", function (e) { e.stopPropagation(); removeTag(name); });
        tokensWrap.appendChild(tok);
      });
    }
    function addTag(name) {
      if (!name || selected.indexOf(name) > -1 || !isTag(name)) return;
      selected.push(name);
      renderTokens(); field.value = "";
      if (unifiedSearch) searchWords = [];
      closeSuggest(); applyFilter(); field.focus();
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
    function openSuggest(showAll) {
      var q = (field.value || "").toLowerCase().trim();
      if (unifiedSearch && !q && !showAll) { closeSuggest(); return; }
      var tagOptions = allTags.filter(function (t) {
        return selected.indexOf(t.name) < 0 &&
          (normalize(t.name).indexOf(normalize(q)) > -1 || normalize(tagLabel(t.name)).indexOf(normalize(q)) > -1);
      }).map(function (t) {
        return { name: t.name, label: tagLabel(t.name), kind: "Tag", count: t.count };
      });
      var articleOptions = [];
      if (unifiedSearch && q) {
        var words = normalize(q).split(/\s+/);
        articleOptions = articles.filter(function (article) {
          var title = normalize(article.title);
          return matches(article.card) && words.every(function (word) { return title.indexOf(word) > -1; });
        }).map(function (article) {
          return { label: article.title, url: article.url, kind: itemLabel };
        }).sort(function (a, b) {
          // Ignore the type prefix when ranking starts-with matches.
          var aTitle = normalize(a.label.replace(/^[^:]+:\s*/, ""));
          var bTitle = normalize(b.label.replace(/^[^:]+:\s*/, ""));
          return Number(bTitle.indexOf(normalize(q)) === 0) - Number(aTitle.indexOf(normalize(q)) === 0) ||
            a.label.localeCompare(b.label);
        }).slice(0, 6);
      }
      var avail = articleOptions.concat(tagOptions);
      if (unifiedSearch) avail = avail.slice(0, 8);
      if (!avail.length) { closeSuggest(); return; }
      if (!suggest.id) suggest.id = "tag-suggestions";
      suggest.innerHTML = avail.map(function (option, i) {
        var active = !unifiedSearch && i === 0;
        return "<button type=\"button\" id=\"" + suggest.id + "-" + i + "\" class=\"ti-opt" + (active ? " active" : "") +
               "\" role=\"option\" aria-label=\"" + esc(option.label + (unifiedSearch ? ", " + option.kind.toLowerCase() : "")) +
               "\" aria-selected=\"" + active + "\"" +
               (option.url ? " data-url=\"" + esc(option.url) + "\"" : " data-name=\"" + esc(option.name) + "\"") + ">" +
               "<span>" + highlight(option.label, q) + "</span>" +
               " <span class=\"ti-c\">" + esc(unifiedSearch ? option.kind : option.count) + "</span></button>";
      }).join("");
      suggest.hidden = false;
      if (unifiedSearch) {
        field.setAttribute("aria-expanded", "true");
        field.removeAttribute("aria-activedescendant");
      }
      Array.prototype.slice.call(suggest.querySelectorAll(".ti-opt")).forEach(function (o) {
        o.addEventListener("mousedown", function (e) { e.preventDefault(); });
        o.addEventListener("click", function () { chooseOption(o); });
      });
    }
    function chooseOption(option) {
      var url = option.getAttribute("data-url");
      if (url) {
        closeSuggest();
        if (url.charAt(0) === "#" && isPanelBrowser) {
          feed.dispatchEvent(new CustomEvent("content:navigate", { detail: url.slice(1) }));
        } else window.location.assign(url);
      } else addTag(option.getAttribute("data-name"));
    }
    function closeSuggest() {
      suggest.hidden = true; suggest.innerHTML = "";
      if (unifiedSearch) {
        field.setAttribute("aria-expanded", "false");
        field.removeAttribute("aria-activedescendant");
      }
    }
    function moveActive(dir) {
      var opts = Array.prototype.slice.call(suggest.querySelectorAll(".ti-opt"));
      if (!opts.length) return;
      var i = -1; opts.forEach(function (o, idx) { if (o.classList.contains("active")) i = idx; });
      i = i < 0 ? (dir > 0 ? 0 : opts.length - 1) : (i + dir + opts.length) % opts.length;
      opts.forEach(function (o, idx) {
        o.classList.toggle("active", idx === i);
        o.setAttribute("aria-selected", String(idx === i));
      });
      if (unifiedSearch) field.setAttribute("aria-activedescendant", opts[i].id);
      suggest.scrollTop += Math.max(0, opts[i].offsetTop + opts[i].offsetHeight - suggest.scrollTop - suggest.clientHeight);
      if (opts[i].offsetTop < suggest.scrollTop) suggest.scrollTop = opts[i].offsetTop;
    }

    function updateSearch() {
      var query = normalize(searchField.value);
      searchWords = query ? query.split(/\s+/) : [];
      applyFilter();
    }
    field.addEventListener("input", function () {
      if (unifiedSearch) updateSearch();
      openSuggest(false);
    });
    field.addEventListener("focus", function () { openSuggest(false); });
    field.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var a = suggest.querySelector(".ti-opt.active");
        var exact = allTags.find(function (t) {
          return normalize(t.name) === normalize(field.value) || normalize(tagLabel(t.name)) === normalize(field.value);
        });
        if (a) chooseOption(a);
        else if (unifiedSearch && exact) addTag(exact.name);
        else closeSuggest();
      }
      else if (e.key === "Backspace" && field.value === "" && selected.length) { removeTag(selected[selected.length - 1]); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (suggest.hidden) openSuggest(true);
        moveActive(e.key === "ArrowDown" ? 1 : -1);
      }
      else if (e.key === "Escape") {
        // Search inputs otherwise clear their value on Escape in Chrome/Safari.
        e.preventDefault();
        closeSuggest();
      }
    });
    box.addEventListener("click", function (e) { if (!e.target.closest("button")) field.focus(); });
    document.addEventListener("click", function (e) { if (!box.contains(e.target)) closeSuggest(); });
    function clearFilters() {
      selected = []; selectedType = ""; searchWords = [];
      field.value = "";
      if (searchField) searchField.value = "";
      closeSuggest(); renderTokens(); applyFilter();
      (searchField || field).focus();
    }
    if (clearBtn) clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      clearFilters();
    });

    // "Clear filter" button inside the no-results message — wire it to the same clear action
    var filterClearBtn = document.querySelector("[data-filter-clear]");
    if (filterClearBtn) filterClearBtn.addEventListener("click", function (e) {
      e.preventDefault();
      clearFilters();
    });

    if (searchField && searchField !== field) searchField.addEventListener("input", updateSearch);
    function selectType(type) {
      selectedType = isType(type) ? type : "";
      closeSuggest(); applyFilter();
    }
    typeButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectType(button.getAttribute("data-type-filter")); });
    });
    Array.prototype.slice.call(feed.querySelectorAll("[data-type-filter]")).forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        selectType(link.getAttribute("data-type-filter"));
        if (!isPanelBrowser) window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });

    // in-card tag chips add to the filter instead of navigating away
    Array.prototype.slice.call(feed.querySelectorAll(".tag[data-tag]")).forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        addTag(a.getAttribute("data-tag"));
        if (!isPanelBrowser) window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });

    // Restore shared links and reloads, ignoring unknown tags/types.
    var params = new URL(window.location).searchParams;
    var initial = params.get("tag");
    if (initial) {
      initial.split(",").forEach(function (n) {
        n = n.trim();
        if (isTag(n) && selected.indexOf(n) < 0) selected.push(n);
      });
    }
    var initialType = params.get("type");
    if (typeButtons.length && isType(initialType)) selectedType = initialType;
    if (searchField) {
      searchField.value = params.get("q") || "";
      var query = normalize(searchField.value);
      searchWords = query ? query.split(/\s+/) : [];
    }
    renderTokens(); applyFilter();
  }

  // The email stays plain text visually; clicking it copies the address.
  function setupEmailCopy() {
    var button = document.querySelector("[data-copy-email]");
    if (!button) return;
    var status = button.parentElement.querySelector("[role='status']");
    var timer;

    function report(copied) {
      clearTimeout(timer);
      status.textContent = copied ? "Copied" : "Couldn't copy. Select the address to copy it.";
      timer = setTimeout(function () { status.textContent = ""; }, copied ? 2500 : 6000);
    }

    function copyFallback(address) {
      var field = document.createElement("textarea");
      field.value = address;
      field.readOnly = true;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      var copied = false;
      try { copied = document.execCommand("copy"); } catch (e) { /* Show manual-copy help. */ }
      field.remove();
      button.focus({ preventScroll: true });
      report(copied);
    }

    button.addEventListener("click", function () {
      var address = button.getAttribute("data-copy-email");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(function () { report(true); }, function () { copyFallback(address); });
      } else {
        copyFallback(address);
      }
    });
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
    setupContentBrowser();
    setupEmailCopy();
    setupHeadingAnchors();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
