const controllers = new WeakMap();

// Initial links wait for fonts and diagram layout; later scrolling stays native.
// A reader's first input cancels this correction, so rendering never pulls them back.
export function setupInitialFragment(doc = document, view = doc.defaultView) {
  const hash = view.location?.hash;
  if (!hash) return { destroy() {} };
  let id;
  try { id = decodeURIComponent(hash.slice(1)); } catch { return { destroy() {} }; }
  const target = doc.getElementById(id);
  if (!target || target.closest?.('[data-design-browser], [data-content-browser]')) return { destroy() {} };
  let done = false, loaded = doc.readyState === 'complete', fontsReady = !doc.fonts;
  let diagramsReady = !doc.querySelector('.post-content .language-mermaid, .post-content .mermaid--pending');
  const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  function destroy() {
    done = true;
    view.removeEventListener('load', onLoad);
    doc.removeEventListener('site:diagrams-ready', onDiagrams);
    inputs.forEach(name => view.removeEventListener(name, destroy));
  }
  function align() {
    if (done || !loaded || !fontsReady || !diagramsReady) return;
    destroy();
    if (view.location.hash === hash && target.isConnected) target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function onLoad() { loaded = true; align(); }
  function onDiagrams() { diagramsReady = true; align(); }
  inputs.forEach(name => view.addEventListener(name, destroy, { passive: true }));
  view.addEventListener('load', onLoad);
  doc.addEventListener('site:diagrams-ready', onDiagrams);
  doc.fonts?.ready.then(() => { fontsReady = true; align(); });
  align();
  return { destroy };
}

// Shared by the outline reading line and CSS sticky/fragment offsets.
export function readHeaderHeight(doc = document, view = doc.defaultView) {
  const value = parseFloat(view?.getComputedStyle?.(doc.documentElement)
    .getPropertyValue('--site-header-height'));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function setupStickyHeader(doc = document, view = doc.defaultView) {
  if (controllers.has(doc)) return controllers.get(doc);
  const header = doc.querySelector('.site-header');
  if (!header) return null;
  const root = doc.documentElement;
  const previous = root.style.getPropertyValue('--site-header-height');
  const priority = root.style.getPropertyPriority('--site-header-height');
  let destroyed = false;
  let height = null;
  function measure() {
    if (destroyed) return;
    const next = Math.ceil(header.getBoundingClientRect().height);
    if (!Number.isFinite(next) || next < 0 || next === height) return;
    height = next;
    root.style.setProperty('--site-header-height', `${height}px`);
  }
  const observer = view.ResizeObserver ? new view.ResizeObserver(measure) : null;
  observer?.observe(header);
  view.addEventListener('resize', measure, { passive: true });
  doc.fonts?.ready.then(measure);
  measure();
  const initialFragment = setupInitialFragment(doc, view);
  const controller = { measure, destroy() {
    destroyed = true;
    initialFragment.destroy();
    observer?.disconnect();
    view.removeEventListener('resize', measure);
    if (previous) root.style.setProperty('--site-header-height', previous, priority);
    else root.style.removeProperty('--site-header-height');
    controllers.delete(doc);
  } };
  controllers.set(doc, controller);
  return controller;
}
