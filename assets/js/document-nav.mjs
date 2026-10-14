// Keep the library usable without JavaScript, with bounded desktop rail scrolling.
export function setupDocumentNav(root, view = window) {
  if (!root) return null;
  const panel = root.querySelector('details'), summary = panel?.querySelector('summary');
  const articles = root.querySelector('[data-document-nav-articles]');
  const current = articles?.querySelector('[data-article-link][aria-current="page"]');
  const categories = root.querySelector('[data-document-nav-categories]');
  const category = categories?.querySelector('[data-article-category][aria-current="true"]');
  if (!panel || !summary || !articles) return null;
  const desktop = view.matchMedia('(min-width: 960px)');
  let destroyed = false;
  function revealInRail(rail, currentLink) {
    if (!rail || !currentLink) return;
    const link = currentLink.getBoundingClientRect(), bounds = rail.getBoundingClientRect();
    if (link.top < bounds.top) rail.scrollTop -= bounds.top - link.top;
    else if (link.bottom > bounds.bottom) rail.scrollTop += link.bottom - bounds.bottom;
  }
  function revealCurrent() {
    if (destroyed || !panel.open) return;
    revealInRail(categories, category);
    revealInRail(articles, current);
  }
  function sync() {
    panel.open = desktop.matches;
    summary.tabIndex = desktop.matches ? -1 : 0;
    if (desktop.matches) summary.setAttribute('aria-disabled', 'true');
    else summary.removeAttribute('aria-disabled');
    revealCurrent();
  }
  function onToggle(event) { if (desktop.matches) event.preventDefault(); }
  sync();
  summary.addEventListener('click', onToggle);
  panel.addEventListener('toggle', revealCurrent);
  desktop.addEventListener('change', sync);
  view.addEventListener('resize', revealCurrent, { passive: true });
  root.ownerDocument.fonts?.ready.then(revealCurrent);
  return { destroy() {
    destroyed = true;
    summary.removeEventListener('click', onToggle);
    panel.removeEventListener('toggle', revealCurrent);
    desktop.removeEventListener('change', sync);
    view.removeEventListener('resize', revealCurrent);
  } };
}
