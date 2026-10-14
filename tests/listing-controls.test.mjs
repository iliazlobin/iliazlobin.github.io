import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('assets/js/site.js').replace(
  'if (document.readyState === "loading") {',
  'window.listingTest = { setupBlogFilter: setupBlogFilter, setupContentBrowser: setupContentBrowser }; return; if (document.readyState === "loading") {'
);

class Node {
  constructor(tag = 'div', attributes = {}, text = '') {
    this.tag = tag; this.attrs = { ...attributes }; this.textContent = text;
    this.children = []; this.events = new Map(); this.style = { setProperty(name, value) { this[name] = value; } };
    this.hidden = false; this.value = ''; this.scrollTop = 0; this.clientTop = 0;
    this.clientHeight = 450; this.offsetHeight = 60; this.offsetTop = 1700;
    const classes = new Set((attributes.class || '').split(/\s+/).filter(Boolean));
    this.classList = { add: (...values) => values.forEach(value => classes.add(value)), remove: value => classes.delete(value),
      contains: value => classes.has(value), toggle: (value, force) => { if (force === undefined) force = !classes.has(value); force ? classes.add(value) : classes.delete(value); return force; } };
  }
  get id() { return this.attrs.id || ''; }
  set id(value) { this.attrs.id = value; }
  set className(value) { this.attrs.class = value; value.split(/\s+/).forEach(name => this.classList.add(name)); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  matches(selector) {
    return selector.split(',').some(part => {
      const selectors = part.trim().split(/\s+/); const leaf = selectors.at(-1);
      const attrs = [...leaf.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
      const classes = [...leaf.matchAll(/\.([\w-]+)/g)];
      const tag = leaf.match(/^\w+/)?.[0];
      return (!tag || tag === this.tag) && attrs.every(([, key, value]) => this.hasAttribute(key) && (value === undefined || this.getAttribute(key) === value)) && classes.every(([, name]) => this.classList.contains(name));
    });
  }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  addEventListener(name, callback) { const callbacks = this.events.get(name) || []; callbacks.push(callback); this.events.set(name, callbacks); }
  emit(name, event = {}) { for (const callback of this.events.get(name) || []) callback({ target: this, button: 0, preventDefault() {}, stopPropagation() {}, ...event }); }
  dispatchEvent(event) { this.emit(event.type, event); }
  focus(options) { this.focusOptions = options; this.doc.activeElement = this; }
  scrollTo(options) { this.scrollTop = options.top; this.lastScroll = options; }
  getBoundingClientRect() { return this.rect ? this.rect() : { top: 60, bottom: 120, left: 0, width: 100 }; }
  // Only creates fixture buttons from the controller's escaped authored markup.
  set innerHTML(html) {
    this._html = html; this.children = [];
    for (const [, attrs, content] of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const values = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
      const child = new Node('button', values, content.replace(/<[^>]*>/g, '')); child.doc = this.doc; this.appendChild(child);
    }
  }
  get innerHTML() { return this._html || ''; }
}

function fixture({ desktop = true, query = '', scrollY = 0, feedScroll = 0 } = {}) {
  const doc = new Node('document'); const body = new Node('body'); doc.body = body; doc.documentElement = new Node('html');
  doc.createElement = tag => { const node = new Node(tag); node.doc = doc; return node; };
  doc.getElementById = id => doc.querySelectorAll('[id]').find(node => node.id === id);
  const browser = doc.appendChild(new Node('section', { 'data-content-browser': '' }));
  const controls = browser.appendChild(new Node('div', { 'data-blog-filter': '', 'data-unified-search': '', 'data-count-noun': 'project', 'data-item-label': 'Project' }));
  const box = controls.appendChild(new Node('div', { 'data-tag-input': '' }));
  const tokens = box.appendChild(new Node('span', { class: 'ti-tokens' }));
  const field = box.appendChild(new Node('input', { class: 'ti-field', 'data-content-search': '' }));
  const clear = box.appendChild(new Node('button', { 'data-tag-clear': '' }));
  const suggestions = box.appendChild(new Node('div', { id: 'fixture-suggestions', class: 'ti-suggest' })); suggestions.hidden = true;
  const count = controls.appendChild(new Node('span', { 'data-result-count': '' }));
  doc.appendChild(new Node('script', { 'data-content-categories': '' }, JSON.stringify([{ name: 'ai-ml', label: 'AI/ML' }, { name: 'infra', label: 'Infra' }])));
  const feed = browser.appendChild(new Node('div', { 'data-blog-feed': '' })); feed.scrollTop = feedScroll;
  feed.rect = () => ({ top: 180, bottom: 630, left: 0, width: 600 });
  const rail = browser.appendChild(new Node('nav', { class: 'portfolio-rail' }));
  const cards = [
    ['hermes', 'ai-ml', 'AI Agents|Docker', 'Hermes Agent Fleet'],
    ['infra', 'infra', 'Docker|Networking', 'Infrastructure Platform'],
    ['swe', 'ai-ml', 'AI Agents|Developer Tools', 'SWE Agent'],
  ].map(([id, type, tags, title]) => {
    const card = feed.appendChild(new Node('article', { id, class: 'portfolio-item', 'data-type': type, 'data-tags': tags, 'data-search': title }, title));
    card.offsetHeight = 200;
    card.appendChild(new Node('h3', {}, title));
    const link = rail.appendChild(new Node('a', { href: `#${id}`, 'data-spy': '' }, title));
    card.rect = () => { const visible = cards.filter(node => node.style.display !== 'none');
      const position = visible.slice(0, visible.indexOf(card)).reduce((sum, node) => sum + node.offsetHeight + 20, 0);
      const top = desktop ? 186 + position - feed.scrollTop : 320 + position - view.scrollY;
      return { top, bottom: top + 200, left: 0, width: 600 }; };
    return card;
  });
  const contextEvents = new Map();
  const view = { location: new URL(`https://example.test/portfolio/${query}`), scrollY, matchMedia: value => ({ matches: value.includes('min-width') ? desktop : true }),
    addEventListener: (type, callback) => contextEvents.set(type, callback),
    scrollTo(options) { this.scrollY = options.top; this.lastScroll = options; } };
  view.ResizeObserver = class { constructor(callback) { view.observer = callback; } observe() {} };
  const callbacks = [];
  const context = vm.createContext({ window: view, document: doc, URL, Map, Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, values) { this.type = type; Object.assign(this, values); } },
    ResizeObserver: view.ResizeObserver,
    history: { replaceState(_state, _title, url) { view.location = new URL(url, view.location); } },
    requestAnimationFrame: callback => { callbacks.push(callback); return callbacks.length; }, setTimeout: callback => callback(),
    getComputedStyle: node => ({ paddingTop: '6px', getPropertyValue: name => name === '--site-header-height' ? '60px' : '' }) });
  doc.querySelectorAll('[data-blog-filter], [data-tag-input], .ti-field, .ti-tokens, .ti-suggest, [data-tag-clear], [data-content-search], [data-result-count]').forEach(node => { node.doc = doc; });
  vm.runInContext(source, context);
  return { view, doc, browser, controls, feed, rail, cards, field, tokens, suggestions, clear, count, contextEvents,
    setupFilter: view.listingTest.setupBlogFilter, setupBrowser: view.listingTest.setupContentBrowser,
    frame() { const pending = callbacks.splice(0); pending.forEach(callback => callback()); } };
}

test('listing introductions and redundant category button rows are absent, with SEO descriptions retained', () => {
  for (const name of ['designs.md', 'infrastructure.md', 'portfolio.md']) {
    const content = read(name);
    assert.match(content, /\ndescription:/);
    assert.doesNotMatch(content, /portfolio-intro|class="type-filters"/);
  }
  assert.doesNotMatch(read('_includes/design-list.html'), /class="type-filters"/);
  for (const path of ['_includes/design-list.html', 'portfolio.md']) {
    assert.match(read(path), /data-content-categories/);
    assert.match(read(path), /data-result-count/);
    assert.match(read(path), /categories or tags/);
  }
  assert.match(read('assets/css/portfolio.css'), /overflow-anchor:\s*none/);
});

test('desktop controls clear the inherited sticky top offset and controlled cards have stable geometry', () => {
  const css = read('assets/css/portfolio.css');
  const sticky = css.match(/\.blog-controls\s*\{([^}]+)\}/)[1];
  const desktop = css.match(/body\.design-browser-page \.design-controls\s*\{([^}]+)\}/)[1];
  assert.match(sticky, /position:\s*sticky/); assert.match(sticky, /top:\s*var\(--site-header-height\)/);
  assert.match(desktop, /position:\s*relative/); assert.match(desktop, /top:\s*auto/);
  // The desktop selector has two classes, overriding the shared one-class
  // sticky rule for BOTH properties, while mobile retains that sticky rule.
  const declarations = rule => Object.fromEntries([...rule.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
  const computed = { ...declarations(sticky), ...declarations(desktop) };
  assert.equal(computed.position, 'relative'); assert.equal(computed.top, 'auto');
  const mediaStart = css.indexOf('@media (min-width: 901px)');
  assert.ok(mediaStart >= 0 && css.indexOf('body.design-browser-page .design-controls') > mediaStart);
  const cards = css.match(/\.js \.design-browser \.portfolio-item\s*\{([^}]+)\}/)[1];
  assert.match(cards, /opacity:\s*1/); assert.match(cards, /transform:\s*none/);
  assert.doesNotMatch(cards, /transition:\s*[^;]*(?:transform|opacity)/);
  assert.match(read('assets/css/site.css'), /\.js \.reveal\s*\{[^}]*transform:\s*translateY\(14px\)/);
});

test('category and tag chips restore URL state, remain distinct, and reset without losing unrelated parameters', () => {
  const dom = fixture({ query: '?type=ai-ml&tag=Docker&keep=yes' }); dom.setupFilter();
  assert.equal(dom.count.textContent, '1 project');
  assert.equal(dom.cards[0].style.display, ''); assert.equal(dom.cards[1].style.display, 'none');
  assert.equal(dom.tokens.children.length, 2);
  assert.match(dom.tokens.children[0].innerHTML, /Category: AI\/ML/);
  assert.match(dom.tokens.children[1].innerHTML, /Tag: Docker/);
  dom.tokens.children[0].querySelector('button').emit('click');
  assert.equal(dom.view.location.searchParams.has('type'), false);
  assert.equal(dom.view.location.searchParams.get('tag'), 'Docker');
  assert.equal(dom.count.textContent, '2 projects');
  assert.equal(dom.field.focusOptions.preventScroll, true);
  dom.clear.emit('click');
  assert.equal(dom.view.location.search, '?keep=yes'); assert.equal(dom.count.textContent, '3 projects'); assert.equal(dom.tokens.children.length, 0);
});

test('category autocomplete uses the existing query input and replaces only the single category', () => {
  const dom = fixture({ query: '?tag=Docker' }); dom.setupFilter();
  dom.field.value = 'AI/ML'; dom.field.emit('input');
  const category = dom.suggestions.querySelector('[data-category]');
  assert.ok(category); assert.equal(category.getAttribute('data-category'), 'ai-ml');
  category.emit('click');
  assert.equal(dom.field.value, ''); assert.equal(dom.view.location.searchParams.get('type'), 'ai-ml');
  assert.equal(dom.view.location.searchParams.get('tag'), 'Docker'); assert.equal(dom.view.location.searchParams.has('q'), false);
  assert.equal(dom.count.textContent, '1 project');
  dom.field.value = 'Infra'; dom.field.emit('keydown', { key: 'Enter' });
  assert.equal(dom.view.location.searchParams.get('type'), 'infra'); assert.equal(dom.count.textContent, '1 project');
  dom.field.emit('keydown', { key: 'Backspace' });
  assert.equal(dom.view.location.searchParams.has('tag'), false);
  dom.field.emit('keydown', { key: 'Backspace' });
  assert.equal(dom.view.location.searchParams.has('type'), false); assert.equal(dom.count.textContent, '3 projects');
});

test('unknown categories/tags are ignored while text queries keep count, rail and cards synchronized', () => {
  const dom = fixture({ query: '?type=unknown&tag=unknown&q=agent' }); dom.setupFilter();
  assert.equal(dom.count.textContent, '2 projects'); assert.equal(dom.cards[1].style.display, 'none');
  assert.equal(dom.rail.children[1].style.display, 'none');
  assert.equal(dom.view.location.search, '?q=agent');
  dom.field.value = 'no match'; dom.field.emit('input');
  assert.equal(dom.count.textContent, '0 projects');
  dom.clear.emit('click'); assert.equal(dom.count.textContent, '3 projects');
});

test('multiple tags consistently narrow results with AND, and removing a chip broadens the same query', () => {
  const dom = fixture({ query: '?type=ai-ml&tag=AI%20Agents,Docker&q=agent' }); dom.setupFilter();
  assert.equal(dom.count.textContent, '1 project');
  assert.equal(dom.cards[0].style.display, '');
  assert.equal(dom.cards[1].style.display, 'none'); assert.equal(dom.cards[2].style.display, 'none');
  dom.tokens.children[2].querySelector('button').emit('click');
  assert.equal(dom.view.location.searchParams.get('tag'), 'AI Agents');
  assert.equal(dom.view.location.searchParams.get('type'), 'ai-ml');
  assert.equal(dom.view.location.searchParams.get('q'), 'agent');
  assert.equal(dom.count.textContent, '2 projects'); assert.equal(dom.cards[2].style.display, '');
  const empty = fixture({ query: '?tag=Networking,Developer%20Tools' }); empty.setupFilter();
  assert.equal(empty.count.textContent, '0 projects');
  assert.equal(empty.tokens.children.length, 2);
  empty.clear.emit('click'); assert.equal(empty.count.textContent, '3 projects');
});

test('listing input leaves Ctrl/Cmd+K unhandled for the global search shortcut', () => {
  const dom = fixture({ query: '?type=ai-ml&tag=Docker&q=agent' }); dom.setupFilter();
  const initial = dom.view.location.href;
  for (const modifier of ['ctrlKey', 'metaKey']) {
    let prevented = false;
    dom.field.emit('keydown', { key: 'k', [modifier]: true, preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    assert.equal(dom.view.location.href, initial); assert.equal(dom.field.value, 'agent');
  }
});

test('desktop rail navigation derives scroll position from panel geometry rather than a positioned ancestor', () => {
  const dom = fixture({ feedScroll: 80 }); dom.setupBrowser(); dom.frame();
  dom.rail.children[2].emit('click');
  assert.equal(dom.feed.scrollTop, 440);
  assert.equal(dom.cards[2].getBoundingClientRect().top, dom.feed.getBoundingClientRect().top + 6);
  assert.equal(dom.view.location.hash, '#swe');
  assert.equal(dom.rail.children[2].getAttribute('aria-current'), 'location');
});

test('filter changes reset a scrolled desktop panel to the full first matching card, after lazy layout changes', () => {
  const dom = fixture(); dom.setupFilter(); dom.setupBrowser(); dom.frame();
  dom.rail.children[2].emit('click'); assert.equal(dom.feed.scrollTop, 440);
  dom.cards[0].offsetHeight = 300; dom.view.observer();
  assert.equal(dom.feed.scrollTop, 540); assert.equal(dom.cards[2].getBoundingClientRect().top, 186);
  dom.field.value = 'agent'; dom.field.emit('input');
  assert.equal(dom.feed.scrollTop, 0);
  assert.equal(dom.cards[0].getBoundingClientRect().top, 186);
  assert.equal(dom.rail.children[0].getAttribute('aria-current'), 'location');
  dom.clear.emit('click'); assert.equal(dom.feed.scrollTop, 0); assert.equal(dom.count.textContent, '3 projects');
});

test('mobile rail navigation and obscured filtered results account for the measured sticky stack', () => {
  const dom = fixture({ desktop: false, scrollY: 300 }); dom.setupFilter(); dom.setupBrowser(); dom.frame();
  assert.equal(dom.cards[0].getBoundingClientRect().top, 136);
  dom.rail.children[2].emit('click');
  assert.equal(dom.cards[2].getBoundingClientRect().top, 136);
  dom.field.value = 'agent'; dom.field.emit('input');
  assert.equal(dom.cards[0].getBoundingClientRect().top, 136);
  assert.equal(dom.view.lastScroll.behavior, 'auto');
});

test('filtering at the top of a mobile listing does not scroll past visible controls or rail', () => {
  const dom = fixture({ desktop: false }); dom.setupFilter(); dom.setupBrowser(); dom.frame();
  dom.field.value = 'agent'; dom.field.emit('input');
  assert.equal(dom.view.scrollY, 0); assert.equal(dom.view.lastScroll, undefined);
});
