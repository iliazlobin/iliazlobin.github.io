const controllers = new WeakMap();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function bounded(view) {
  const maxX = Math.max(0, (view.width * view.scale - view.viewportWidth) / 2);
  const maxY = Math.max(0, (view.height * view.scale - view.viewportHeight) / 2);
  return { ...view, x: maxX ? clamp(view.x, -maxX, maxX) : 0, y: maxY ? clamp(view.y, -maxY, maxY) : 0 };
}

export function fitView(width, height, viewportWidth, viewportHeight) {
  const safe = value => Number.isFinite(value) && value > 0 ? value : 1;
  [width, height, viewportWidth, viewportHeight] = [width, height, viewportWidth, viewportHeight].map(safe);
  const scale = Math.min(1, viewportWidth / width, viewportHeight / height);
  return { width, height, viewportWidth, viewportHeight, scale, minScale: scale, maxScale: 8, x: 0, y: 0 };
}

// Anchor coordinates are relative to the center of the viewing area.
export function zoomView(view, factor, anchor = { x: 0, y: 0 }) {
  if (!Number.isFinite(factor) || factor <= 0) return view;
  const scale = clamp(view.scale * factor, view.minScale, view.maxScale);
  const ratio = scale / view.scale;
  return bounded({ ...view, scale, x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio });
}

export function panView(view, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return view;
  return bounded({ ...view, x: view.x + x, y: view.y + y });
}

export function gestureView(view, before, after) {
  if (before.length !== after.length || !after.length) return view;
  if (after.length === 1) return panView(view, after[0].x - before[0].x, after[0].y - before[0].y);
  const center = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
  const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  const previous = center(before), current = center(after), span = distance(before);
  const moved = panView(view, current.x - previous.x, current.y - previous.y);
  return span > 0 ? zoomView(moved, distance(after) / span,
    { x: current.x - view.viewportWidth / 2, y: current.y - view.viewportHeight / 2 }) : moved;
}

export function wheelScale(delta, mode = 0) {
  if (!Number.isFinite(delta)) return 1;
  return Math.exp(-clamp(delta * (mode === 1 ? 16 : mode === 2 ? 300 : 1), -100, 100) * .003);
}

export function isZoomableMedia(media) {
  if (media.closest('.media-zoom-dialog, .about-intro, .social-links, button')) return false;
  if (media.tagName.toLowerCase() === 'svg') return Boolean(media.closest('.post-content .mermaid'));
  return media.complete && media.naturalWidth >= 48 && media.naturalHeight >= 48;
}

// Linked portfolio thumbnails zoom on an ordinary click; their original links
// remain available without JS and for modified/middle-click navigation.
export function shouldOpenMediaZoom(media, event) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
  if (event.target.closest('button')) return false;
  return !event.target.closest('a') || Boolean(media.closest('.portfolio-item .thumb'));
}

function sizeOf(media) {
  if (media.tagName.toLowerCase() === 'svg') {
    const box = media.viewBox?.baseVal;
    if (box?.width > 0 && box.height > 0) return { width: box.width, height: box.height };
  } else if (media.naturalWidth > 0 && media.naturalHeight > 0) {
    return { width: media.naturalWidth, height: media.naturalHeight };
  }
  const bounds = media.getBoundingClientRect();
  return { width: bounds.width, height: bounds.height };
}

export function setupMediaZoom(root = document) {
  if (controllers.has(root)) return controllers.get(root);
  const doc = root.ownerDocument || root, win = doc.defaultView;
  const dialog = doc.createElement('dialog');
  if (typeof dialog.showModal !== 'function') return null;
  dialog.className = 'media-zoom-dialog';
  dialog.setAttribute('aria-labelledby', 'media-zoom-title');
  dialog.setAttribute('aria-describedby', 'media-zoom-help');
  const toolbar = doc.createElement('div'); toolbar.className = 'media-zoom-toolbar';
  const title = doc.createElement('strong'); title.id = 'media-zoom-title';
  const controls = doc.createElement('div'); controls.className = 'media-zoom-controls';
  const output = doc.createElement('output'); output.setAttribute('aria-label', 'Zoom level');
  const button = (text, label, action) => {
    const item = doc.createElement('button'); item.type = 'button'; item.textContent = text;
    item.setAttribute('aria-label', label); item.title = label; item.addEventListener('click', action);
    return item;
  };
  let view, opener, objectURL, picture, sourceSize;
  const points = new Map(), enhanced = new WeakSet(), cleanups = [];
  const viewport = doc.createElement('div'); viewport.className = 'media-zoom-viewport';
  viewport.tabIndex = 0; viewport.setAttribute('aria-label', 'Zoomable image. Arrow keys pan; plus and minus zoom.');
  const help = doc.createElement('p'); help.id = 'media-zoom-help'; help.className = 'media-zoom-help';
  help.textContent = 'Drag to pan · Scroll or pinch to zoom · +/− and arrow keys · Esc to close';
  const render = () => {
    if (!view || !picture) return;
    picture.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    output.textContent = `${Math.round(view.scale * 100)}%`;
    zoomOut.disabled = view.scale <= view.minScale + .00001;
    zoomIn.disabled = view.scale >= view.maxScale;
  };
  const fit = () => {
    if (!sourceSize || !dialog.open) return;
    const bounds = viewport.getBoundingClientRect();
    view = fitView(sourceSize.width, sourceSize.height, bounds.width, bounds.height); render();
  };
  const zoom = factor => { if (view) { view = zoomView(view, factor); render(); } };
  const zoomOut = button('−', 'Zoom out', () => zoom(1 / 1.25));
  const zoomIn = button('+', 'Zoom in', () => zoom(1.25));
  const fitButton = button('Fit', 'Fit image to viewer', fit);
  const actual = button('100%', 'Actual size', () => zoom(1 / view.scale));
  const close = button('Close', 'Close image viewer', () => dialog.close());
  controls.append(zoomOut, output, zoomIn, fitButton, actual, close);
  toolbar.append(title, controls); dialog.append(toolbar, viewport, help); doc.body.append(dialog);

  const release = () => {
    if (objectURL) { win.URL.revokeObjectURL(objectURL); objectURL = null; }
    picture?.remove(); picture = null; view = null; sourceSize = null; points.clear();
    viewport.classList.remove('is-dragging'); doc.documentElement.classList.remove('media-zoom-open');
    if (opener?.isConnected) opener.focus({ preventScroll: true }); opener = null;
  };
  dialog.addEventListener('close', release);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || !view) return;
    let handled = true;
    if (event.key === '+' || event.key === '=') zoom(1.25);
    else if (event.key === '-') zoom(1 / 1.25);
    else if (event.key.toLowerCase() === 'f') fit();
    else if (event.key === '0') zoom(1 / view.scale);
    else if (event.target === viewport && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const dx = event.key === 'ArrowLeft' ? 50 : event.key === 'ArrowRight' ? -50 : 0;
      const dy = event.key === 'ArrowUp' ? 50 : event.key === 'ArrowDown' ? -50 : 0;
      view = panView(view, dx, dy); render();
    } else handled = false;
    if (handled) event.preventDefault();
  });
  viewport.addEventListener('wheel', event => {
    if (!view || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const box = viewport.getBoundingClientRect();
    view = zoomView(view, wheelScale(event.deltaY, event.deltaMode),
      { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 }); render();
  }, { passive: false });
  const position = event => { const b = viewport.getBoundingClientRect(); return { x: event.clientX - b.left, y: event.clientY - b.top }; };
  viewport.addEventListener('pointerdown', event => {
    if (!view || event.button !== 0) return;
    points.set(event.pointerId, position(event)); viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging'); viewport.focus({ preventScroll: true });
  });
  viewport.addEventListener('pointermove', event => {
    if (!view || !points.has(event.pointerId)) return;
    const before = [...points.values()]; points.set(event.pointerId, position(event));
    view = gestureView(view, before, [...points.values()]); render();
  });
  const pointerEnd = event => { points.delete(event.pointerId); if (!points.size) viewport.classList.remove('is-dragging'); };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(name, pointerEnd);
  win.addEventListener('resize', fit);

  const open = (media, trigger, label) => {
    if (dialog.open || !isZoomableMedia(media)) return;
    sourceSize = sizeOf(media); opener = trigger;
    picture = doc.createElement('img'); picture.alt = label; picture.draggable = false;
    picture.className = 'media-zoom-picture';
    picture.style.width = `${sourceSize.width}px`; picture.style.height = `${sourceSize.height}px`;
    if (media.tagName.toLowerCase() === 'svg') {
      // Render a copy in an inert image: no duplicate live SVG IDs or script execution.
      const copy = media.cloneNode(true);
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', sourceSize.width); copy.setAttribute('height', sourceSize.height);
      copy.style.maxWidth = 'none'; copy.style.width = `${sourceSize.width}px`; copy.style.height = `${sourceSize.height}px`;
      for (const script of copy.querySelectorAll('script')) script.remove();
      for (const element of [copy, ...copy.querySelectorAll('*')]) {
        for (const attribute of [...element.attributes]) if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
      }
      objectURL = win.URL.createObjectURL(new win.Blob([new win.XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
      picture.src = objectURL;
    } else picture.src = media.currentSrc || media.src;
    title.textContent = label; viewport.append(picture); dialog.showModal();
    doc.documentElement.classList.add('media-zoom-open'); fit(); close.focus();
  };
  const enhance = media => {
    if (enhanced.has(media) || !isZoomableMedia(media)) return;
    let host = media.closest('.mermaid, .thumb');
    let linkedThumb = null;
    if (host?.tagName.toLowerCase() === 'a') {
      // Keep the link intact, but place the independent zoom button outside it.
      linkedThumb = host;
      host = doc.createElement('span'); host.className = 'media-zoom-host media-zoom-card';
      linkedThumb.before(host); host.append(linkedThumb);
    }
    if (!host) {
      host = doc.createElement('span'); host.className = 'media-zoom-host media-zoom-inline';
      const original = media.closest('a') || media;
      original.before(host); host.append(original);
    } else host.classList.add('media-zoom-host');
    const label = media.getAttribute('alt') || media.getAttribute('aria-label') || media.querySelector?.('title')?.textContent || 'Diagram';
    const trigger = button('Zoom', `Zoom: ${label}`, () => open(media, trigger, label));
    trigger.className = 'media-zoom-trigger'; trigger.setAttribute('aria-haspopup', 'dialog'); host.append(trigger);
    media.classList.add('media-zoom-target');
    const click = event => {
      if (!shouldOpenMediaZoom(media, event)) return;
      event.preventDefault();
      open(media, trigger, label);
    };
    media.addEventListener('click', click); enhanced.add(media);
    cleanups.push(() => { media.removeEventListener('click', click); media.classList.remove('media-zoom-target'); trigger.remove();
      if (linkedThumb || host.classList.contains('media-zoom-inline')) host.replaceWith(...host.childNodes); else host.classList.remove('media-zoom-host'); });
  };
  const scan = () => root.querySelectorAll('.post-content .mermaid > svg, .post-content img, .portfolio-item .thumb img').forEach(enhance);
  const observer = new win.MutationObserver(records => {
    if (records.some(record => !dialog.contains(record.target))) scan();
  });
  observer.observe(root === doc ? doc.body : root, { childList: true, subtree: true });
  root.addEventListener('load', scan, true); scan();
  const controller = { scan, destroy() { observer.disconnect(); root.removeEventListener('load', scan, true);
    win.removeEventListener('resize', fit); if (dialog.open) dialog.close(); release();
    for (const cleanup of cleanups) cleanup(); dialog.remove(); controllers.delete(root); } };
  controllers.set(root, controller); return controller;
}
