import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { setupDocumentNav } from '../assets/js/document-nav.mjs';

function fixture({ desktop = true, navPresent = true, summaryPresent = true, scrollTop = 0 } = {}) {
  const events = new Map(), mediaEvents = new Map(), clicks = new Map();
  const summary = { attrs: {}, tabIndex: 0,
    setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; },
    addEventListener: (name, callback) => clicks.set(name, callback), removeEventListener: name => clicks.delete(name) };
  const panel = { open: false, querySelector: () => summaryPresent ? summary : null };
  const nav = { scrollTop };
  const media = { matches: desktop,
    addEventListener: (name, callback) => mediaEvents.set(name, callback), removeEventListener: name => mediaEvents.delete(name) };
  const root = { querySelector(selector) {
    assert.ok(['details', 'nav'].includes(selector), 'no category/article auto-reveal');
    return selector === 'details' ? panel : navPresent ? nav : null;
  } };
  const view = { matchMedia: () => media,
    addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) };
  return { root, view, media, panel, summary, nav, events, mediaEvents, clicks };
}

test('desktop library stays open at the top without skipping categories', () => {
  const dom = fixture(); setupDocumentNav(dom.root, dom.view);
  assert.equal(dom.panel.open, true);
  assert.equal(dom.summary.tabIndex, -1);
  assert.equal(dom.summary.attrs['aria-disabled'], 'true');
  assert.equal(dom.nav.scrollTop, 0);
  assert.equal(dom.events.size, 0);
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
  assert.equal(dom.nav.scrollTop, 0);
});

test('breakpoints preserve the readers shared sidebar scroll position', () => {
  const dom = fixture({ scrollTop: 350 }); setupDocumentNav(dom.root, dom.view);
  assert.equal(dom.nav.scrollTop, 350);
  dom.media.matches = false; dom.mediaEvents.get('change')();
  assert.equal(dom.panel.open, false);
  assert.equal(dom.nav.scrollTop, 350);
  dom.media.matches = true; dom.mediaEvents.get('change')();
  assert.equal(dom.panel.open, true);
  assert.equal(dom.nav.scrollTop, 350);
});

test('resize and font changes cannot force an automatic sidebar jump', () => {
  const dom = fixture({ scrollTop: 350 });
  dom.root.ownerDocument = { fonts: { ready: { then() { assert.fail('fonts must not trigger auto-reveal'); } } } };
  setupDocumentNav(dom.root, dom.view);
  assert.equal(dom.events.has('resize'), false);
  assert.equal(dom.nav.scrollTop, 350);
});

test('mobile opens the shared rail at its existing position', () => {
  const dom = fixture({ desktop: false, scrollTop: 150 });
  setupDocumentNav(dom.root, dom.view);
  assert.equal(dom.nav.scrollTop, 150);
  dom.panel.open = true;
  assert.equal(dom.nav.scrollTop, 150);
});

test('missing markup is harmless and cleanup removes all controller listeners', () => {
  assert.equal(setupDocumentNav(null, {}), null);
  assert.equal(setupDocumentNav({ querySelector: () => null }, {}), null);
  const missing = fixture({ navPresent: false });
  assert.equal(setupDocumentNav(missing.root, missing.view), null);
  const noSummary = fixture({ summaryPresent: false });
  assert.equal(setupDocumentNav(noSummary.root, noSummary.view), null);
  const dom = fixture({ scrollTop: 350 }), controller = setupDocumentNav(dom.root, dom.view);
  controller.destroy();
  assert.equal(dom.nav.scrollTop, 350);
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

test('category links have one distinct owner per article and point to their scoped canonical listing', () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const groups = read('_data/document_navigation.yml').split(/(?=^- category: )/m).filter(Boolean).map(record => ({
    category: record.match(/^- category: (.+)$/m)?.[1],
    index: record.match(/^  index: (.+)$/m)?.[1],
  }));
  assert.deepEqual(groups, [
    { category: 'system-design', index: '/designs/' },
    { category: 'system-design-ml', index: '/designs/' },
    { category: 'low-level-design', index: '/designs/' },
    { category: 'ai', index: '/designs/' },
    { category: 'infra', index: '/infrastructure/' },
    { category: 'tech', index: '/infrastructure/' },
  ]);
  assert.equal(new Set(groups.map(group => group.category)).size, groups.length);
  const categories = new Set(groups.map(group => group.category));
  for (const name of readdirSync(new URL('../_designs/', import.meta.url)).filter(name => name.endsWith('.md'))) {
    const frontmatter = read(`_designs/${name}`).split('---')[1];
    const owners = [...frontmatter.matchAll(/^category:\s*(.+)$/gm)];
    assert.equal(owners.length, 1, `${name} must have one category`);
    assert.ok(categories.has(owners[0][1].trim()), `${name} must have a known category`);
  }
  const include = read('_includes/document-nav.html');
  assert.match(include, /<ul class="document-nav-categories" data-document-nav-categories aria-label="Article categories">/);
  assert.match(include, /group.index \| relative_url }}\?type={{ group.category \| url_encode/);
  assert.match(include, /group.category == page.category %} aria-current="true"/);
  assert.doesNotMatch(include, /All designs|Infrastructure &amp; tech|document-nav-indexes|page.tags/);
});

test('categories start one bounded sidebar scroll region shared with all articles', () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const include = read('_includes/document-nav.html'), css = read('assets/css/article-toc.css');
  assert.match(include, /class="document-nav-categories"[\s\S]*?<\/ul>\s*<div class="document-nav-articles" data-document-nav-articles>/);
  assert.match(include, /<li><a href="{{ group.index/);
  assert.match(css, /\.document-shell \.document-nav nav\s*\{[^}]*display: block; overflow-y: auto;/);
  assert.match(css, /\.document-nav \.document-nav-categories\s*\{[^}]*display: block;/);
  assert.doesNotMatch(css, /\.document-nav-categories\s*\{[^}]*display: grid|grid-template-columns: repeat\(2/);
  assert.doesNotMatch(css, /\.document-nav-(?:categories|articles)\s*\{[^}]*(?:overflow|max-height|position:\s*(?:sticky|fixed))/);
  assert.match(css, /max-height: min\(55vh, 28rem\)/);
  assert.match(css, /--document-nav-height: max\(0px, calc\(100dvh - var\(--site-header-height\) - 3rem\)\)/);
  assert.match(css, /\.document-shell \.document-nav summary \{ display: none; \}/);
  assert.match(include, /<summary>Articles<\/summary>/);
  assert.doesNotMatch(include, /Browse articles/);
});
