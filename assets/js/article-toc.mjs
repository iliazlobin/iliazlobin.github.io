import { readHeaderHeight } from './site-header.mjs';

/** Pick the latest section above the reading line, including a short final section. */
export function selectActiveHeading(positions, readingLine = 32, atBottom = false) {
  if (!positions.length) return null;
  if (atBottom) return positions.at(-1).id;
  let active = positions[0].id;
  for (const heading of positions) {
    if (heading.top > readingLine) break;
    active = heading.id;
  }
  return active;
}

/** Enhance the already-rendered anchors; navigation never dispatches heading clicks. */
export function setupArticleToc(article, view = window) {
  const toc = article?.querySelector("[data-article-toc]");
  const content = article?.querySelector(".post-content");
  if (!toc || !content) return null;
  const links = Array.from(toc.querySelectorAll('a[href^="#"]'));
  const document = article.ownerDocument;
  const entries = links.map(link => {
    let id;
    try { id = decodeURIComponent(link.getAttribute("href").slice(1)); }
    catch { return null; }
    const heading = document.getElementById(id);
    return heading && content.contains(heading) ? { link, heading, id } : null;
  }).filter(Boolean);
  if (!entries.length) return null;

  let activeId = null;
  let frame = null;
  let destroyed = false;
  const panel = toc.querySelector("details");
  const summary = panel?.querySelector("summary");
  const desktop = view.matchMedia("(min-width: 1240px)");
  function syncPanel() {
    if (panel) panel.open = desktop.matches;
    if (summary) {
      summary.tabIndex = desktop.matches ? -1 : 0;
      if (desktop.matches) summary.setAttribute("aria-disabled", "true");
      else summary.removeAttribute("aria-disabled");
    }
  }
  function update() {
    if (destroyed) return;
    frame = null;
    const height = document.documentElement.scrollHeight;
    const atBottom = view.scrollY + view.innerHeight >= height - 2;
    const next = selectActiveHeading(entries.map(({ heading, id }) => ({ id, top: heading.getBoundingClientRect().top })), readHeaderHeight(document, view) + 32, atBottom);
    if (next !== activeId) {
      activeId = next;
      for (const { link, id } of entries) {
        if (id === activeId) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    }
    const current = entries.find(entry => entry.id === activeId)?.link;
    const nav = article.querySelector("[data-toc-scroll]") || toc.querySelector("nav");
    if (desktop.matches && current && nav) {
      const linkBox = current.getBoundingClientRect();
      const navBox = nav.getBoundingClientRect();
      if (linkBox.top < navBox.top) nav.scrollTop -= navBox.top - linkBox.top;
      else if (linkBox.bottom > navBox.bottom) nav.scrollTop += linkBox.bottom - navBox.bottom;
    }
  }
  function schedule() {
    if (destroyed) return;
    if (frame === null) frame = view.requestAnimationFrame(update);
  }
  function onToggle(event) {
    // Desktop is a persistent outline, not a disclosure control.
    if (desktop.matches) event.preventDefault();
  }
  function onNavigate(event) {
    if (event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    const link = event.target.closest('a[href^="#"]');
    const entry = entries.find(item => item.link === link);
    if (!entry) return;
    // Collapse before the browser computes the fragment's scroll position.
    if (!desktop.matches && panel) panel.open = false;
    // Keep native fragment navigation/history. Focus the destination without
    // clicking the heading (whose existing click handler copies a permalink).
    view.requestAnimationFrame(() => {
      entry.heading.setAttribute("tabindex", "-1");
      entry.heading.focus({ preventScroll: true });
      schedule();
    });
  }

  syncPanel();
  update();
  view.addEventListener("scroll", schedule, { passive: true });
  view.addEventListener("resize", schedule, { passive: true });
  view.addEventListener("hashchange", schedule);
  desktop.addEventListener("change", syncPanel);
  summary?.addEventListener("click", onToggle);
  toc.addEventListener("click", onNavigate);
  // Images, fonts and Mermaid can move headings without a scroll event.
  const observer = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
  observer?.observe(content);
  document.fonts?.ready.then(schedule);

  return { update, destroy() {
    destroyed = true;
    if (frame !== null) view.cancelAnimationFrame(frame);
    view.removeEventListener("scroll", schedule);
    view.removeEventListener("resize", schedule);
    view.removeEventListener("hashchange", schedule);
    desktop.removeEventListener("change", syncPanel);
    summary?.removeEventListener("click", onToggle);
    toc.removeEventListener("click", onNavigate);
    observer?.disconnect();
  } };
}

/** Keep optional sidebar details usable without JS and compact on narrow screens. */
export function setupSidePanels(root, view = window) {
  const panels = Array.from(root?.querySelectorAll("details[data-side-panel]") || []);
  if (!panels.length) return null;
  const desktop = view.matchMedia("(min-width: 1240px)");
  const summaries = panels.map(panel => panel.querySelector("summary")).filter(Boolean);
  function revealFragment() {
    let id;
    try { id = decodeURIComponent((view.location?.hash || "").slice(1)); }
    catch { return; }
    const target = id && root.ownerDocument?.getElementById(id);
    if (target) for (const panel of panels) if (panel.contains(target)) panel.open = true;
  }
  function sync() {
    for (const panel of panels) panel.open = desktop.matches;
    revealFragment();
    for (const summary of summaries) {
      summary.tabIndex = desktop.matches ? -1 : 0;
      if (desktop.matches) summary.setAttribute("aria-disabled", "true");
      else summary.removeAttribute("aria-disabled");
    }
  }
  function onToggle(event) { if (desktop.matches) event.preventDefault(); }
  let printState = null;
  function beforePrint() {
    if (printState) return;
    printState = panels.map(panel => panel.open);
    for (const panel of panels) panel.open = true;
  }
  function afterPrint() {
    if (!printState) return;
    panels.forEach((panel, index) => { panel.open = printState[index]; });
    printState = null;
  }
  sync();
  desktop.addEventListener("change", sync);
  view.addEventListener("beforeprint", beforePrint);
  view.addEventListener("afterprint", afterPrint);
  view.addEventListener("hashchange", revealFragment);
  for (const summary of summaries) summary.addEventListener("click", onToggle);
  return { destroy() {
    desktop.removeEventListener("change", sync);
    view.removeEventListener("beforeprint", beforePrint);
    view.removeEventListener("afterprint", afterPrint);
    view.removeEventListener("hashchange", revealFragment);
    afterPrint();
    for (const summary of summaries) summary.removeEventListener("click", onToggle);
  } };
}
