import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { setupDocumentNav } from '../assets/js/document-nav.mjs';

function fixture({ desktop = true, current = true } = {}) {
  const events = new Map(), mediaEvents = new Map(), clicks = new Map();
  let fontsReady;
  const summary = { attrs: {}, tabIndex: 0,
    setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; },
    addEventListener: (name, callback) => clicks.set(name, callback), removeEventListener: name => clicks.delete(name) };
  const panel = { open: false, querySelector: () => summary };
  const active = { box: { top: 650, bottom: 680 }, getBoundingClientRect() { return this.box; },
    scrollIntoView() { assert.fail('library reveal must not scroll the document'); } };
  const nav = { scrollTop: 0, box: { top: 100, bottom: 500 },
    getBoundingClientRect() { return this.box; }, querySelector: () => current ? active : null };
  const media = { matches: desktop,
    addEventListener: (name, callback) => mediaEvents.set(name, callback), removeEventListener: name => mediaEvents.delete(name) };
  const root = { ownerDocument: { fonts: { ready: { then: callback => { fontsReady = callback; } } } },
    querySelector: selector => selector === 'details' ? panel : nav };
  const view = { matchMedia: () => media,
    addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) };
  return { root, view, media, panel, summary, nav, active, events, mediaEvents, clicks, fontsReady: () => fontsReady() };
}

test('desktop library stays open and reveals the current article only inside its rail', () => {
  const dom = fixture(); setupDocumentNav(dom.root, dom.view);
  assert.equal(dom.panel.open, true);
  assert.equal(dom.summary.tabIndex, -1);
  assert.equal(dom.summary.attrs['aria-disabled'], 'true');
  assert.equal(dom.nav.scrollTop, 180);
  let prevented = false; dom.clicks.get('click')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
});

test('mobile preserves a native disclosure and a breakpoint restores desktop navigation', () => {
  const dom = fixture({ desktop: false }); setupDocumentNav(dom.root, dom.view);
  assert.equal(dom.panel.open, false);
  assert.equal(dom.summary.tabIndex, 0);
  assert.equal(dom.summary.attrs['aria-disabled'], undefined);
  assert.equal(dom.nav.scrollTop, 0);
  dom.clicks.get('click')({ preventDefault() { assert.fail('mobile disclosure must toggle natively'); } });
  dom.media.matches = true; dom.mediaEvents.get('change')();
  assert.equal(dom.panel.open, true);
  assert.equal(dom.nav.scrollTop, 180);
});

test('resizing and fonts reveal active links without changing page focus or position', () => {
  const dom = fixture(); setupDocumentNav(dom.root, dom.view);
  dom.nav.scrollTop = 0; dom.nav.box.bottom = 400; dom.events.get('resize')();
  assert.equal(dom.nav.scrollTop, 280);
  dom.active.box = { top: 80, bottom: 100 }; dom.fontsReady();
  assert.equal(dom.nav.scrollTop, 260);
});

test('missing rails/current articles and late font resolution after cleanup are harmless', () => {
  assert.equal(setupDocumentNav(null, {}), null);
  assert.equal(setupDocumentNav({ querySelector: () => null }, {}), null);
  const absent = fixture({ current: false }); setupDocumentNav(absent.root, absent.view);
  assert.equal(absent.nav.scrollTop, 0);
  const dom = fixture(), controller = setupDocumentNav(dom.root, dom.view);
  controller.destroy(); const scroll = dom.nav.scrollTop; dom.fontsReady();
  assert.equal(dom.nav.scrollTop, scroll);
  assert.equal(dom.events.size + dom.clicks.size + dom.mediaEvents.size, 0);
});

test('only documents gain three native-scroll regions, complete canonical links and print isolation', () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const layout = read('_layouts/post.html'), css = read('assets/css/article-toc.css'), include = read('_includes/document-nav.html');
  assert.match(layout, /if page\.collection == 'designs' %}\s*<div class="document-shell" data-document-shell>/);
  assert.match(layout, /include document-nav.html/);
  assert.match(layout, /id="document-article" tabindex="-1"/);
  assert.match(include, /class="document-skip" href="#document-article"/);
  assert.match(include, /<details class="document-nav-panel" open>/);
  assert.match(include, /<nav aria-label="Article navigation">/);
  assert.match(include, /entry.url == page.url %} aria-current="page"/);
  assert.match(include, /site.designs \| where: 'category', group.category \| sort: 'title'/);
  assert.doesNotMatch(include, /\| uniq/);
  assert.match(css, /grid-template-columns: 210px minmax\(0, 1fr\) 220px/);
  assert.match(css, /@media \(min-width: 960px\)/);
  assert.match(css, /@media \(min-width: 1240px\)/);
  assert.match(css, /\.document-shell > :is\(\.document-nav, \.article-toc\) \{ display: none; \}/);
  assert.doesNotMatch(css, /position: fixed|overflow: hidden[^}]*\.document-shell/);
});
