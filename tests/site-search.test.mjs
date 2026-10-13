import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isSearchShortcut, removeQueryFilter, highlightSegments, setupSiteSearch } from '../assets/js/site-search.mjs';

class Node {
  constructor(doc, tag = 'div') { this.doc = doc; this.tagName = tag; this.dataset = {}; this.children = []; this.events = new Map(); this.attributes = {}; this.hidden = false; this.value = ''; this.isConnected = true; this.tabIndex = 0; }
  append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  get firstChild() { return this.children[0]; }
  addEventListener(name, callback) { this.events.set(name, callback); }
  removeEventListener(name) { this.events.delete(name); }
  emit(name, event = {}) { return this.events.get(name)?.({ target: this, ...event }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  matches(selector) { return selector.split(',').some(part => { const data = part.trim().match(/^\[data-([^\]]+)\]$/)?.[1]; return data && Object.hasOwn(this.dataset, data.replace(/-([a-z])/g, (_, c) => c.toUpperCase())); }); }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus(options) { this.doc.activeElement = this; this.focusOptions = options; }
  click() { this.clicked = true; for (let parent = this.parent; parent; parent = parent.parent) parent.emit('click', { target: this }); }
  getBoundingClientRect() { return { left: 10, right: 100, top: 10, bottom: 100 }; }
  getClientRects() { return [{}]; }
}
const corpus = [
  { url: '/designs/cache/', title: 'Distributed Cache', description: 'Shared cache design', category: 'sd', categoryLabel: 'System design', tags: ['Caching'], html: '<h2 id="recovery">Recovery</h2><p>Cache recovery after failure</p>' },
  { url: '/designs/redis/', title: 'Redis', description: 'In-memory key-value storage', category: 'tech', categoryLabel: 'Technology', tags: ['Caching'], html: '<p>Redis cache</p>' },
];
function fixture({ fetcher, overflow = 'auto', otherDialog = false } = {}) {
  const doc = { activeElement: null, createElement: tag => new Node(doc, tag), createTextNode: text => Object.assign(new Node(doc, '#text'), { textContent: text }) };
  const dialog = new Node(doc, 'dialog'); dialog.dataset.siteSearch = ''; dialog.dataset.searchIndex = '/search-index.json?v=1';
  dialog.open = false; dialog.showModal = () => { dialog.open = true; }; dialog.close = () => { dialog.open = false; dialog.emit('close'); };
  const nodes = {};
  for (const key of ['query', 'close', 'category', 'tag', 'reset', 'filters', 'status', 'retry', 'results']) {
    const node = new Node(doc, key === 'query' ? 'input' : 'div'); node.dataset[`search${key[0].toUpperCase() + key.slice(1)}`] = ''; nodes[key] = node; dialog.append(node);
  }
  const trigger = new Node(doc, 'button'); trigger.dataset.openSiteSearch = ''; trigger.hidden = true;
  const shortcut = new Node(doc, 'kbd'); shortcut.dataset.searchShortcut = ''; trigger.append(shortcut);
  const values = new Map([['overflow', overflow]]);
  doc.body = { style: { getPropertyValue: key => values.get(key) || '', getPropertyPriority: () => 'important', setProperty: (key, value, priority) => { values.set(key, value); doc.priority = priority; }, removeProperty: key => values.delete(key) } };
  doc.querySelector = selector => selector === '[data-site-search]' ? dialog : selector === 'dialog[open]' ? (otherDialog ? {} : dialog.open ? dialog : null) : null;
  doc.querySelectorAll = selector => selector === '[data-open-site-search]' ? [trigger] : [];
  doc.activeElement = trigger;
  const events = new Map(), requests = [];
  const view = { navigator: { platform: 'MacIntel' }, location: { href: 'https://example.test/designs/cache/', origin: 'https://example.test' },
    addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name),
    fetch: async (...args) => { requests.push(args); return fetcher ? fetcher(...args) : { ok: true, json: async () => corpus }; },
    scrollTo: () => assert.fail('search must not scroll the page'), };
  return { doc, view, dialog, trigger, shortcut, nodes, events, requests, values };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Ctrl/Cmd+K is deliberate and leaves composition, modified or handled keys untouched', () => {
  assert.ok(isSearchShortcut({ key: 'K', ctrlKey: true }));
  assert.ok(isSearchShortcut({ key: 'k', metaKey: true }));
  for (const flag of ['defaultPrevented', 'isComposing', 'altKey', 'shiftKey']) assert.equal(isSearchShortcut({ key: 'k', ctrlKey: true, [flag]: true }), false);
  assert.equal(isSearchShortcut({ key: 'k' }), false);
});

test('removing an inline chip respects aliases, casing and quoted tags', () => {
  assert.equal(removeQueryFilter('redis type:TECH tag:"Data Pipelines"', 'categories', 'tech'), 'redis tag:"Data Pipelines"');
  assert.equal(removeQueryFilter("redis tag:'Caching' type:sd", 'tags', 'caching'), 'redis type:sd');
  assert.equal(removeQueryFilter('type:unknown cache', 'categories', 'tech'), 'type:unknown cache');
  assert.equal(removeQueryFilter('"before tag:caching after"', 'tags', 'caching'), '"before tag:caching after"');
  assert.equal(removeQueryFilter('foo-type:tech', 'categories', 'tech'), 'foo-type:tech');
});

test('highlighting shares word-prefix and quoted-phrase boundaries without inserting markup', () => {
  const matched = (text, query) => highlightSegments(text, query).filter(part => part.match).map(part => part.text);
  assert.deepEqual(matched('service restarts; ICE restart', '"ICE restart"'), ['ICE restart']);
  assert.deepEqual(matched('Redis credits', 'red'), ['Red']);
  assert.deepEqual(matched('Redis credits', 'edis'), []);
  assert.deepEqual(matched('v[1] <safe>', 'v[1]'), ['v[1]']);
  assert.equal(highlightSegments('<img src=x>', 'nothing').map(part => part.text).join(''), '<img src=x>');
});

test('initialization is idempotent, loads lazily and keeps requests local and query-free', async () => {
  const dom = fixture(); const controller = setupSiteSearch(dom.doc, dom.view);
  assert.equal(setupSiteSearch(dom.doc, dom.view), controller);
  assert.equal(dom.trigger.hidden, false); assert.equal(dom.shortcut.textContent, '⌘ K');
  assert.equal(dom.requests.length, 0);
  controller.open(); await settle();
  assert.equal(dom.doc.activeElement, dom.nodes.query); assert.equal(dom.values.get('overflow'), 'hidden');
  assert.equal(dom.requests[0][0], 'https://example.test/search-index.json?v=1');
  assert.equal(dom.nodes.results.children.length, 2);
  dom.nodes.query.value = 'redis'; dom.nodes.query.emit('input');
  assert.equal(dom.requests.length, 1);
  dom.dialog.close(); controller.open(); await settle(); assert.equal(dom.requests.length, 1);
});

test('close restores focus and prior scroll-lock ownership without moving the page', async () => {
  const dom = fixture(); const controller = setupSiteSearch(dom.doc, dom.view);
  controller.open(); await settle(); dom.nodes.close.emit('click'); dom.dialog.emit('click', { target: dom.nodes.close });
  assert.equal(dom.dialog.open, false); assert.equal(dom.doc.activeElement, dom.trigger);
  assert.deepEqual(dom.trigger.focusOptions, { preventScroll: true }); assert.equal(dom.values.get('overflow'), 'auto'); assert.equal(dom.doc.priority, 'important');
});

test('one Escape closes search without clearing text and leaves IME composition alone', async () => {
  const dom = fixture(); setupSiteSearch(dom.doc, dom.view).open(); await settle();
  dom.nodes.query.value = 'redis'; let prevented = false;
  dom.dialog.emit('keydown', { target: dom.nodes.query, key: 'Escape', isComposing: true });
  assert.equal(dom.dialog.open, true);
  dom.dialog.emit('keydown', { target: dom.nodes.query, key: 'Escape', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true); assert.equal(dom.dialog.open, false); assert.equal(dom.nodes.query.value, 'redis');
});

test('keyboard results remain native links and arrows move focus predictably', async () => {
  const dom = fixture(); setupSiteSearch(dom.doc, dom.view).open(); await settle();
  const links = dom.nodes.results.querySelectorAll('[data-search-result]'); let prevented = 0;
  const key = (target, value) => dom.dialog.emit('keydown', { target, key: value, preventDefault: () => prevented++ });
  key(dom.nodes.query, 'ArrowDown'); assert.equal(dom.doc.activeElement, links[0]);
  key(links[0], 'ArrowDown'); assert.equal(dom.doc.activeElement, links[1]);
  key(links[1], 'Home'); assert.equal(dom.doc.activeElement, links[0]);
  key(links[0], 'ArrowUp'); assert.equal(dom.doc.activeElement, dom.nodes.query);
  key(links[0], 'Enter'); assert.equal(prevented, 4);
  assert.equal(links[0].tagName, 'a'); assert.ok(links[0].href.startsWith('/'));
});

test('Tab wraps modal controls and results without moving focus into browser chrome', async () => {
  const dom = fixture(); setupSiteSearch(dom.doc, dom.view).open(); await settle();
  const last = dom.nodes.results.querySelectorAll('[data-search-result]').at(-1); let prevented = 0;
  dom.dialog.emit('keydown', { target: dom.nodes.query, key: 'Tab', shiftKey: true, preventDefault: () => prevented++ });
  assert.ok(dom.doc.activeElement === last, 'reverse Tab should wrap to the final result');
  dom.dialog.emit('keydown', { target: last, key: 'Tab', preventDefault: () => prevented++ });
  assert.ok(dom.doc.activeElement === dom.nodes.query, 'forward Tab should wrap to search'); assert.equal(prevented, 2);
});

test('Enter from the query follows the best result through its ordinary link', async () => {
  const dom = fixture(); setupSiteSearch(dom.doc, dom.view).open(); await settle();
  const first = dom.nodes.results.querySelectorAll('[data-search-result]')[0]; let prevented = false;
  dom.dialog.emit('keydown', { target: dom.nodes.query, key: 'Enter', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true); assert.equal(first.clicked, true); assert.equal(dom.dialog.open, false);
});

test('manual and inline filters are visible/removable, and Reset is scoped to search', async () => {
  const dom = fixture(); setupSiteSearch(dom.doc, dom.view).open(); await settle();
  dom.nodes.category.value = 'tech'; dom.nodes.category.emit('change');
  dom.nodes.tag.value = 'Caching'; dom.nodes.tag.emit('change');
  assert.equal(dom.nodes.filters.children.length, 2); assert.equal(dom.nodes.results.children.length, 1);
  dom.dialog.emit('click', { target: dom.nodes.filters.children[0] }); assert.equal(dom.nodes.filters.children.length, 1);
  dom.nodes.query.value = 'type:sd'; dom.nodes.query.emit('input'); assert.equal(dom.nodes.filters.children.length, 2);
  dom.nodes.reset.emit('click'); assert.equal(dom.nodes.query.value, ''); assert.equal(dom.nodes.filters.hidden, true); assert.equal(dom.nodes.results.children.length, 2);
});

test('failed loading can retry and another open dialog keeps its shortcut/focus', async () => {
  let attempts = 0;
  const dom = fixture({ fetcher: async () => ++attempts === 1 ? { ok: false } : { ok: true, json: async () => corpus } });
  setupSiteSearch(dom.doc, dom.view).open(); await settle(); assert.equal(dom.nodes.retry.hidden, false);
  dom.nodes.retry.emit('click'); await settle(); assert.equal(dom.nodes.results.children.length, 2); assert.equal(dom.nodes.retry.hidden, true);
  const blocked = fixture({ otherDialog: true }); setupSiteSearch(blocked.doc, blocked.view);
  blocked.events.get('keydown')({ key: 'k', ctrlKey: true, preventDefault: () => assert.fail('do not steal another modal shortcut') });
  assert.equal(blocked.dialog.open, false);
});

test('cleanup ignores late loads, restores focus and removes listeners', async () => {
  let resolve; const promise = new Promise(done => { resolve = done; });
  const dom = fixture({ fetcher: () => promise }); const controller = setupSiteSearch(dom.doc, dom.view);
  controller.open(); controller.destroy(); resolve({ ok: true, json: async () => corpus }); await settle();
  assert.equal(dom.nodes.results.children.length, 0); assert.equal(dom.events.size, 0); assert.equal(dom.trigger.hidden, true); assert.equal(dom.values.get('overflow'), 'auto');
  assert.equal(setupSiteSearch({ querySelector: () => null, querySelectorAll: () => [] }, {}), null);
});

test('all layouts use the named native modal, compact header control and responsive safe text UI', () => {
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.match(read('_layouts/default.html'), /include site-search\.html/);
  assert.match(read('_includes/header.html'), /data-open-site-search aria-haspopup="dialog"/);
  assert.match(read('_includes/site-search.html'), /<dialog[^>]+aria-labelledby="site-search-title"/);
  assert.match(read('assets/css/site-search.css'), /@media \(max-width: 600px\)/);
  assert.match(read('assets/css/site-search.css'), /\.site-search-input-row:focus-within \{ box-shadow: inset 0 -2px var\(--accent\)/);
  assert.doesNotMatch(read('assets/js/site-search.mjs'), /innerHTML|localStorage|history\.replaceState|location\.assign/);
});
