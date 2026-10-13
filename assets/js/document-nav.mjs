// Keep the library usable without JavaScript, with bounded desktop rail scrolling.
export function setupDocumentNav(root, view = window) {
  if (!root) return null;
  const panel = root.querySelector('details'), summary = panel?.querySelector('summary');
  const nav = root.querySelector('nav'), current = nav?.querySelector('[aria-current="page"]');
  if (!panel || !summary || !nav) return null;
  const desktop = view.matchMedia('(min-width: 960px)');
  let destroyed = false;
  function revealCurrent() {
    if (destroyed || !desktop.matches || !current) return;
    const link = current.getBoundingClientRect(), bounds = nav.getBoundingClientRect();
    if (link.top < bounds.top) nav.scrollTop -= bounds.top - link.top;
    else if (link.bottom > bounds.bottom) nav.scrollTop += link.bottom - bounds.bottom;
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
  desktop.addEventListener('change', sync);
  view.addEventListener('resize', revealCurrent, { passive: true });
  root.ownerDocument.fonts?.ready.then(revealCurrent);
  return { destroy() {
    destroyed = true;
    summary.removeEventListener('click', onToggle);
    desktop.removeEventListener('change', sync);
    view.removeEventListener('resize', revealCurrent);
  } };
}
