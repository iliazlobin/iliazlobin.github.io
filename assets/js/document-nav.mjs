// One native-scroll library of grouped articles. Keep the reader's scroll
// position instead of jumping automatically to the current article.
export function setupDocumentNav(root, view = window) {
  if (!root) return null;
  const panel = root.querySelector('details'), summary = panel?.querySelector('summary');
  if (!panel || !summary || !root.querySelector('nav')) return null;
  const desktop = view.matchMedia('(min-width: 960px)');
  function sync() {
    panel.open = desktop.matches;
    summary.tabIndex = desktop.matches ? -1 : 0;
    if (desktop.matches) summary.setAttribute('aria-disabled', 'true');
    else summary.removeAttribute('aria-disabled');
  }
  function onToggle(event) { if (desktop.matches) event.preventDefault(); }
  sync();
  summary.addEventListener('click', onToggle);
  desktop.addEventListener('change', sync);
  return { destroy() {
    summary.removeEventListener('click', onToggle);
    desktop.removeEventListener('change', sync);
  } };
}
