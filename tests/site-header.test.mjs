import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readHeaderHeight, setupStickyHeader, setupInitialFragment } from '../assets/js/site-header.mjs';

function fixture({ observer = true, previous = '' } = {}) {
  const events = new Map(), values = new Map();
  let height = 51.25, writes = 0, onResize, observed, disconnected = false, fontsReady;
  if (previous) values.set('--site-header-height', previous);
  const style = {
    getPropertyValue: name => values.get(name) || '',
    getPropertyPriority: () => previous ? 'important' : '',
    setProperty(name, value, priority = '') { values.set(name, value); writes++; this.priority = priority; },
    removeProperty: name => values.delete(name),
  };
  const header = { getBoundingClientRect: () => ({ height }) };
  const doc = { querySelector: () => header, documentElement: { style },
    fonts: { ready: { then: callback => { fontsReady = callback; } } } };
  const view = {
    getComputedStyle: () => style,
    addEventListener: (name, callback) => events.set(name, callback),
    removeEventListener: name => events.delete(name),
    scrollTo() { assert.fail('header measurement must not move the page'); },
  };
  if (observer) view.ResizeObserver = class {
    constructor(callback) { onResize = callback; }
    observe(target) { observed = target; }
    disconnect() { disconnected = true; }
  };
  return { doc, view, header, style, events, values,
    setHeight: value => { height = value; }, resized: () => onResize(), fontsReady: () => fontsReady(),
    get observed() { return observed; }, get disconnected() { return disconnected; }, get writes() { return writes; } };
}

test('publishes measured height and initializes only once per document', () => {
  const dom = fixture();
  const controller = setupStickyHeader(dom.doc, dom.view);
  assert.equal(readHeaderHeight(dom.doc, dom.view), 52);
  assert.equal(dom.observed, dom.header);
  assert.equal(setupStickyHeader(dom.doc, dom.view), controller);
  assert.equal(dom.writes, 1);
  controller.measure();
  assert.equal(dom.writes, 1);
});

test('wrapping, viewport resize and loaded fonts update offsets without scrolling', () => {
  const dom = fixture();
  setupStickyHeader(dom.doc, dom.view);
  dom.setHeight(96.3); dom.resized();
  assert.equal(readHeaderHeight(dom.doc, dom.view), 97);
  dom.setHeight(82); dom.events.get('resize')();
  assert.equal(readHeaderHeight(dom.doc, dom.view), 82);
  dom.setHeight(86.1); dom.fontsReady();
  assert.equal(readHeaderHeight(dom.doc, dom.view), 87);
});

test('resize fallback works without ResizeObserver and missing headers are harmless', () => {
  assert.equal(setupStickyHeader({ querySelector: () => null }, {}), null);
  const dom = fixture({ observer: false });
  setupStickyHeader(dom.doc, dom.view);
  dom.setHeight(112); dom.events.get('resize')();
  assert.equal(readHeaderHeight(dom.doc, dom.view), 112);
});

test('invalid offsets are bounded and invalid measurements retain the last value', () => {
  const dom = fixture();
  const controller = setupStickyHeader(dom.doc, dom.view);
  dom.setHeight(NaN); controller.measure();
  assert.equal(readHeaderHeight(dom.doc, dom.view), 52);
  for (const invalid of ['garbage', '-10px']) {
    dom.values.set('--site-header-height', invalid);
    assert.equal(readHeaderHeight(dom.doc, dom.view), 0);
  }
  assert.equal(readHeaderHeight(dom.doc, {}), 0);
});

test('cleanup restores prior inline configuration and ignores late font completion', () => {
  const dom = fixture({ previous: '72px' });
  const controller = setupStickyHeader(dom.doc, dom.view);
  controller.destroy();
  assert.equal(dom.disconnected, true);
  assert.equal(dom.events.size, 0);
  assert.equal(dom.values.get('--site-header-height'), '72px');
  assert.equal(dom.style.priority, 'important');
  dom.setHeight(200); dom.fontsReady();
  assert.equal(dom.values.get('--site-header-height'), '72px');
  const unset = fixture();
  setupStickyHeader(unset.doc, unset.view).destroy();
  assert.equal(unset.values.has('--site-header-height'), false);
});

test('compact identity, normal-flow sticky header and one fragment offset are shared', () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const header = read('_includes/header.html'), css = read('assets/css/site.css');
  assert.match(header, /<div class="site-details">\s*<p class="site-role">Forward Deployed Engineer · Google/);
  assert.match(css, /\.site-header \{ position: sticky; top: 0; z-index: 100;/);
  assert.match(css, /\.site-identity \{[^}]*display: flex;[^}]*flex-wrap: wrap;/);
  assert.match(css, /scroll-padding-top: var\(--site-header-height\)/);
  assert.match(css, /@media print[^]*\.site-header \{ position: static; \}/);
  assert.doesNotMatch(css, /position: fixed|scroll-margin-top/);
  assert.match(read('_layouts/default.html'), /setupStickyHeader\(document\)/);
  assert.match(read('assets/js/site.js'), /card\.getBoundingClientRect\(\)\.top - headerHeight - controls\.offsetHeight - 16/);
  for (const file of ['assets/css/blog.css', 'assets/css/portfolio.css']) {
    assert.match(read(file), /position: sticky; top: var\(--site-header-height\)/);
  }
});

function fragmentFixture({ pending = true, fonts = true, loaded = false, hash = '#custom%3Aflow', panel = false } = {}) {
  const events = new Map(), docEvents = new Map();
  let onFonts, scrolled = [];
  const target = { isConnected: true, closest: () => panel,
    scrollIntoView: options => scrolled.push(options) };
  const doc = { readyState: loaded ? 'complete' : 'loading',
    getElementById: id => id === 'custom:flow' ? target : null,
    querySelector: () => pending ? {} : null,
    addEventListener: (name, callback) => docEvents.set(name, callback),
    removeEventListener: name => docEvents.delete(name) };
  if (fonts) doc.fonts = { ready: { then: callback => { onFonts = callback; } } };
  const view = { location: { hash },
    addEventListener: (name, callback) => events.set(name, callback),
    removeEventListener: name => events.delete(name) };
  return { doc, view, target, events, docEvents, scrolled, fontsReady: () => onFonts() };
}

test('direct fragments align once after fonts, load and all diagrams settle', () => {
  const dom = fragmentFixture();
  setupInitialFragment(dom.doc, dom.view);
  dom.events.get('load')(); dom.fontsReady();
  assert.equal(dom.scrolled.length, 0);
  dom.docEvents.get('site:diagrams-ready')();
  assert.deepEqual(dom.scrolled, [{ block: 'start', behavior: 'instant' }]);
  assert.equal(dom.events.size, 0);
  assert.equal(dom.docEvents.size, 0);
  dom.fontsReady();
  assert.equal(dom.scrolled.length, 1);
});

test('reader input, a changed fragment or a disconnected target prevents initial correction', () => {
  for (const input of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    const dom = fragmentFixture({ loaded: true, pending: false });
    setupInitialFragment(dom.doc, dom.view);
    dom.events.get(input)(); dom.fontsReady();
    assert.equal(dom.scrolled.length, 0);
    assert.equal(dom.events.size, 0);
  }
  for (const change of [dom => { dom.view.location.hash = '#elsewhere'; }, dom => { dom.target.isConnected = false; }]) {
    const dom = fragmentFixture({ loaded: true, pending: false });
    setupInitialFragment(dom.doc, dom.view); change(dom); dom.fontsReady();
    assert.equal(dom.scrolled.length, 0);
  }
});

test('ready simple documents align immediately; malformed, missing and panel-owned fragments are untouched', () => {
  const ready = fragmentFixture({ loaded: true, pending: false, fonts: false });
  setupInitialFragment(ready.doc, ready.view);
  assert.equal(ready.scrolled.length, 1);
  for (const options of [{ hash: '' }, { hash: '#%bad' }, { hash: '#missing' }, { panel: true }]) {
    const dom = fragmentFixture(options);
    setupInitialFragment(dom.doc, dom.view);
    assert.equal(dom.events.size, 0);
    assert.equal(dom.scrolled.length, 0);
  }
});
