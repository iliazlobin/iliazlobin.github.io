import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fitView, zoomView, panView, gestureView, wheelScale, isZoomableMedia, shouldOpenMediaZoom } from '../assets/js/media-zoom.mjs';

// A small ancestor fixture distinguishes actual portfolio thumbnails from
// unrelated article links, rather than returning the same node for every selector.
class ClickTarget {
  constructor(tag, classes = [], parent = null) { this.tag = tag; this.classes = new Set(classes); this.parent = parent; }
  matches(selector) {
    return selector.split(',').some(part => {
      const ancestors = part.trim().split(/\s+/);
      const leaf = ancestors.pop();
      const tag = leaf.match(/^[a-z]+/i)?.[0];
      if (tag && tag.toLowerCase() !== this.tag) return false;
      if ([...leaf.matchAll(/\.([\w-]+)/g)].some(([, name]) => !this.classes.has(name))) return false;
      let parent = this.parent;
      for (const ancestor of ancestors.reverse()) {
        while (parent && !parent.matches(ancestor)) parent = parent.parent;
        if (!parent) return false;
        parent = parent.parent;
      }
      return true;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
}

const primaryClick = (target, overrides = {}) => ({ target, button: 0, ctrlKey: false, metaKey: false,
  altKey: false, shiftKey: false, defaultPrevented: false, ...overrides });

function clickableMedia({ linked = false, thumbnail = false, portfolio = false } = {}) {
  const card = new ClickTarget('article', portfolio ? ['portfolio-item'] : []);
  const host = new ClickTarget(linked ? 'a' : 'div', thumbnail ? ['thumb'] : [], card);
  return new ClickTarget('img', [], host);
}

test('fit preserves aspect ratio, avoids unnecessary enlargement and recenters', () => {
  const view = fitView(1600, 800, 800, 600);
  assert.equal(view.scale, .5);
  assert.deepEqual([view.x, view.y], [0, 0]);
  assert.equal(fitView(200, 100, 800, 600).scale, 1);
  assert.equal(fitView(400, 1600, 800, 600).scale, .375);
});

test('unavailable dimensions remain finite', () => {
  const view = fitView(0, NaN, Infinity, -10);
  assert.ok(Object.values(view).every(Number.isFinite));
  assert.equal(view.scale, 1);
});

test('zoom keeps the point under the cursor in place while there is pan room', () => {
  const view = zoomView(fitView(1600, 800, 800, 400), 2);
  const next = zoomView(view, 2, { x: 100, y: 50 });
  assert.equal(next.scale, 2);
  assert.equal((100 - view.x) / view.scale, (100 - next.x) / next.scale);
  assert.equal((50 - view.y) / view.scale, (50 - next.y) / next.scale);
});

test('zoom and pan are bounded, and zooming back to fit removes blank-edge offsets', () => {
  const fit = fitView(1600, 800, 800, 400);
  const large = panView(zoomView(fit, 10000), 100000, -100000);
  assert.equal(large.scale, 8);
  assert.equal(large.x, 6000);
  assert.equal(large.y, -3000);
  const small = zoomView(large, .000001);
  assert.equal(small.scale, fit.scale);
  assert.deepEqual([small.x, small.y], [0, 0]);
});

test('invalid input and non-overflowing axes cannot move the picture', () => {
  const fit = fitView(200, 100, 800, 600);
  assert.deepEqual(panView(fit, 40, 60), fit);
  assert.equal(zoomView(fit, NaN), fit);
  assert.equal(zoomView(fit, -1), fit);
  assert.equal(panView(fit, Infinity, 0), fit);
});

test('single-pointer drag and two-pointer pinch use the same bounded view', () => {
  const view = zoomView(fitView(1000, 1000, 500, 500), 2);
  assert.deepEqual(gestureView(view, [{ x: 100, y: 100 }], [{ x: 140, y: 120 }]), panView(view, 40, 20));
  const pinched = gestureView(view, [{ x: 200, y: 250 }, { x: 300, y: 250 }], [{ x: 150, y: 250 }, { x: 350, y: 250 }]);
  assert.equal(pinched.scale, 2);
  assert.deepEqual([pinched.x, pinched.y], [0, 0]);
  assert.equal(gestureView(view, [], []), view);
  assert.equal(gestureView(view, [{ x: 1, y: 1 }], []), view);
});

test('pinch also follows movement of the gesture center', () => {
  const view = zoomView(fitView(1000, 1000, 500, 500), 2);
  const next = gestureView(view, [{ x: 200, y: 250 }, { x: 300, y: 250 }], [{ x: 250, y: 270 }, { x: 350, y: 270 }]);
  assert.deepEqual([next.scale, next.x, next.y], [1, 50, 20]);
});

test('wheel units normalize and extreme events have a limited zoom step', () => {
  assert.ok(wheelScale(-50) > 1);
  assert.ok(wheelScale(50) < 1);
  assert.equal(wheelScale(1, 1), wheelScale(16));
  assert.equal(wheelScale(1, 2), wheelScale(100));
  assert.ok(wheelScale(-100000) < 1.4);
  assert.equal(wheelScale(NaN), 1);
});

test('discovery excludes decorative, broken and not-yet-loaded media', () => {
  const media = overrides => ({ tagName: 'IMG', complete: true, naturalWidth: 800, naturalHeight: 400,
    closest: () => null, ...overrides });
  assert.equal(isZoomableMedia(media({})), true);
  assert.equal(isZoomableMedia(media({ complete: false })), false);
  assert.equal(isZoomableMedia(media({ naturalWidth: 0 })), false);
  assert.equal(isZoomableMedia(media({ naturalWidth: 16, naturalHeight: 16 })), false);
  assert.equal(isZoomableMedia(media({ closest: () => ({}) })), false);
  assert.equal(isZoomableMedia(media({ tagName: 'svg', closest: selector => selector === '.post-content .mermaid' ? {} : null })), true);
});

test('ordinary picture clicks share zoom for unlinked media and linked portfolio thumbnails', () => {
  for (const options of [{}, { thumbnail: true, portfolio: true }, { linked: true, thumbnail: true, portfolio: true }]) {
    const media = clickableMedia(options);
    assert.equal(shouldOpenMediaZoom(media, primaryClick(media)), true, JSON.stringify(options));
  }
});

test('article links and unrelated anchors retain their native primary-click navigation', () => {
  for (const options of [{ linked: true }, { linked: true, thumbnail: true }, { linked: true, portfolio: true }]) {
    const media = clickableMedia(options);
    assert.equal(shouldOpenMediaZoom(media, primaryClick(media)), false, JSON.stringify(options));
  }
});

test('modified and non-primary clicks retain native behavior for every zoomable picture kind', () => {
  for (const options of [{}, { linked: true, thumbnail: true, portfolio: true }]) {
    const media = clickableMedia(options);
    for (const button of [1, 2]) assert.equal(shouldOpenMediaZoom(media, primaryClick(media, { button })), false);
    for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'defaultPrevented']) {
      assert.equal(shouldOpenMediaZoom(media, primaryClick(media, { [flag]: true })), false, flag);
    }
  }
});

test('button descendants are not intercepted as picture clicks', () => {
  const media = clickableMedia({ linked: true, thumbnail: true, portfolio: true });
  const button = new ClickTarget('button', [], media.parent);
  const icon = new ClickTarget('svg', [], button);
  assert.equal(shouldOpenMediaZoom(media, primaryClick(button)), false);
  assert.equal(shouldOpenMediaZoom(media, primaryClick(icon)), false);
});

test('shared setup preserves link navigation, asynchronous diagrams and modal cleanup', () => {
  const source = readFileSync(new URL('../assets/js/media-zoom.mjs', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/css/media-zoom.css', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../_layouts/default.html', import.meta.url), 'utf8');
  assert.match(layout, /media-zoom\.css/);
  assert.match(layout, /setupMediaZoom\(document\)/);
  assert.match(source, /createElement\('dialog'\)/);
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /aria-labelledby/);
  assert.match(source, /if \(!shouldOpenMediaZoom\(media, event\)\) return;\s*event\.preventDefault\(\);\s*open\(media, trigger, label\);/);
  assert.match(source, /event\.target\.closest\('button'\)/);
  assert.match(source, /revokeObjectURL/);
  assert.match(source, /new win\.XMLSerializer/);
  assert.doesNotMatch(source, /innerHTML|fetch\(|\.onclick\s*=/);
  assert.match(source, /new win\.MutationObserver/);
  assert.match(source, /if \(controllers\.has\(root\)\)/);
  assert.match(source, /opener\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(css, /\.media-zoom-trigger\s*\{[^}]*z-index: 3;/);
  assert.match(css, /touch-action: none/);
  assert.match(css, /@media print/);
});

test('linked thumbnails retain the original anchor and place independent zoom controls outside it', () => {
  const source = readFileSync(new URL('../assets/js/media-zoom.mjs', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/css/media-zoom.css', import.meta.url), 'utf8');
  assert.match(source, /host\?\.tagName\.toLowerCase\(\) === 'a'/);
  assert.match(source, /host\.className = 'media-zoom-host media-zoom-card'/);
  assert.match(source, /linkedThumb\.before\(host\); host\.append\(linkedThumb\);/);
  assert.match(source, /host\.append\(trigger\)/);
  assert.doesNotMatch(source, /(?:media|linkedThumb)\.href\s*=/);
  assert.doesNotMatch(source, /(?:media|linkedThumb)\.setAttribute\(['"]href/);
  assert.match(source, /if \(linkedThumb \|\| host\.classList\.contains\('media-zoom-inline'\)\) host\.replaceWith\(\.\.\.host\.childNodes\)/);
  assert.match(css, /\.media-zoom-card\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.media-zoom-card > \.thumb\s*\{[^}]*height:\s*100%/);
});
