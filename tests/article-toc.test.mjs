import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectActiveHeading, setupArticleToc } from "../assets/js/article-toc.mjs";

test("scrollspy follows the reading line, including short final sections", () => {
  const headings = [{ id: "overview", top: -100 }, { id: "flow", top: 31 }, { id: "details", top: 700 }];
  assert.equal(selectActiveHeading(headings), "flow");
  assert.equal(selectActiveHeading(headings, 32, true), "details");
  assert.equal(selectActiveHeading(headings.map(item => ({ ...item, top: item.top + 1000 }))), "overview");
  assert.equal(selectActiveHeading([]), null);
});

function fixture({ desktop = true, invalidLink = false, headerHeight = 0 } = {}) {
  const events = new Map();
  const frames = new Map();
  const mediaEvents = new Map();
  let frameCounter = 0;
  const makeElement = attrs => ({
    attrs: { ...attrs }, listeners: new Map(), scrollTop: 0,
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return this.attrs[name]; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(name, callback) { this.listeners.set(name, callback); },
    removeEventListener(name, callback) { if (this.listeners.get(name) === callback) this.listeners.delete(name); },
    getBoundingClientRect() { return this.box || { top: 0, bottom: 500 }; },
    focus(options) { this.focusOptions = options; },
  });
  const headings = [makeElement({ id: "overview" }), makeElement({ id: "custom:flow" }), makeElement({ id: "last" })];
  headings.forEach((heading, index) => { heading.id = heading.attrs.id; heading.box = { top: index * 200 - 10, bottom: index * 200 + 20 }; });
  const links = headings.map(heading => makeElement({ href: `#${encodeURIComponent(heading.id)}` }));
  links.forEach(link => { link.closest = () => link; });
  if (invalidLink) links.push(makeElement({ href: "#outside-article" }), makeElement({ href: "#%broken" }));
  const summary = makeElement({});
  const panel = { open: false, querySelector: () => summary };
  const nav = makeElement({});
  const toc = makeElement({});
  toc.querySelectorAll = () => links;
  toc.querySelector = selector => selector === "details" ? panel : selector === "nav" ? nav : null;
  const content = { contains: heading => headings.includes(heading) };
  const document = { documentElement: { scrollHeight: 1000 }, getElementById: id => headings.find(h => h.id === id) || {} };
  const media = { matches: desktop, addEventListener: (name, callback) => mediaEvents.set(name, callback), removeEventListener: name => mediaEvents.delete(name) };
  const view = {
    scrollY: 0, innerHeight: 500, matchMedia: () => media,
    getComputedStyle: () => ({ getPropertyValue: () => `${headerHeight}px` }),
    requestAnimationFrame(callback) { const id = ++frameCounter; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener: (name, callback) => events.set(name, callback),
    removeEventListener: name => events.delete(name),
  };
  const article = { ownerDocument: document, querySelector: selector => selector === "[data-article-toc]" ? toc : content };
  function flush() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } }
  return { article, view, toc, nav, panel, summary, headings, links, events, frames, media, mediaEvents, flush };
}

test("preserves custom heading IDs and sets only one active location", () => {
  const dom = fixture({ invalidLink: true });
  const controller = setupArticleToc(dom.article, dom.view);
  assert.equal(dom.links[0].attrs["aria-current"], "location");
  assert.equal(dom.panel.open, true);
  assert.equal(dom.summary.tabIndex, -1);
  assert.equal(dom.summary.attrs["aria-disabled"], "true");
  dom.headings[1].box.top = 0;
  controller.update();
  assert.equal(dom.links[1].attrs.href, "#custom%3Aflow");
  assert.equal(dom.headings[1].id, "custom:flow");
  assert.equal(dom.links[1].attrs["aria-current"], "location");
  assert.equal(dom.links[0].attrs["aria-current"], undefined);
  assert.equal(dom.links.filter(link => link.attrs["aria-current"]).length, 1);
});

test("scrollspy uses the visible reading line below the persistent header", () => {
  const dom = fixture({ headerHeight: 64 });
  dom.headings[1].box.top = 80;
  setupArticleToc(dom.article, dom.view);
  assert.equal(dom.links[1].attrs["aria-current"], "location");
  assert.equal(dom.links[0].attrs["aria-current"], undefined);
});

test("navigation keeps native fragments/history and focuses the target without heading clicks or clipboard writes", () => {
  const dom = fixture();
  setupArticleToc(dom.article, dom.view);
  const event = { target: dom.links[1], button: 0, preventDefault() { assert.fail("native anchor navigation must remain intact"); } };
  dom.toc.listeners.get("click")(event);
  dom.flush();
  assert.equal(dom.headings[1].attrs.tabindex, "-1");
  assert.deepEqual(dom.headings[1].focusOptions, { preventScroll: true });
  assert.equal(dom.panel.open, true);
  assert.equal(dom.headings[1].listeners.size, 0);
});

test("mobile collapses before native navigation and restores disclosure focus", () => {
  const dom = fixture({ desktop: false });
  setupArticleToc(dom.article, dom.view);
  assert.equal(dom.panel.open, false);
  assert.equal(dom.summary.tabIndex, 0);
  assert.equal(dom.summary.attrs["aria-disabled"], undefined);
  dom.panel.open = true;
  dom.toc.listeners.get("click")({ target: dom.links[1], button: 0 });
  assert.equal(dom.panel.open, false);
  dom.flush();
  assert.ok(dom.headings[1].focusOptions.preventScroll);
  dom.media.matches = true;
  dom.mediaEvents.get("change")();
  assert.equal(dom.panel.open, true);
});

test("modifier/middle clicks are untouched and scroll updates are frame-batched", () => {
  const dom = fixture();
  setupArticleToc(dom.article, dom.view);
  dom.toc.listeners.get("click")({ target: dom.links[1], button: 0, ctrlKey: true });
  dom.toc.listeners.get("click")({ target: dom.links[1], button: 1 });
  assert.equal(dom.frames.size, 0);
  dom.events.get("scroll")();
  dom.events.get("scroll")();
  dom.events.get("resize")();
  assert.equal(dom.frames.size, 1);
  dom.flush();
  assert.equal(dom.frames.size, 0);
});

test("scrolls only the bounded desktop outline to reveal an active entry", () => {
  const dom = fixture();
  dom.links[0].box = { top: 650, bottom: 680 };
  setupArticleToc(dom.article, dom.view);
  assert.equal(dom.nav.scrollTop, 180);
  assert.equal(dom.view.scrollY, 0);
});

test("viewport resize reveals an unchanged active entry in the shorter outline", () => {
  const dom = fixture();
  setupArticleToc(dom.article, dom.view);
  assert.equal(dom.nav.scrollTop, 0);
  dom.links[0].box = { top: 250, bottom: 280 };
  dom.nav.box = { top: 0, bottom: 200 };
  dom.events.get("resize")();
  dom.flush();
  assert.equal(dom.links[0].attrs["aria-current"], "location");
  assert.equal(dom.nav.scrollTop, 80);
  assert.equal(dom.view.scrollY, 0);
});

test("cleanup cancels pending work and missing outlines remain a no-op", () => {
  assert.equal(setupArticleToc(null, {}), null);
  const dom = fixture();
  const controller = setupArticleToc(dom.article, dom.view);
  dom.events.get("scroll")();
  controller.destroy();
  assert.equal(dom.frames.size, 0);
  assert.equal(dom.events.size, 0);
  assert.equal(dom.toc.listeners.size, 0);
  assert.equal(dom.summary.listeners.size, 0);
});

test("collection-scoped markup provides nested plain anchors with a responsive sticky rail", () => {
  const layout = readFileSync(new URL("../_layouts/post.html", import.meta.url), "utf8");
  const include = readFileSync(new URL("../_includes/article-toc.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../assets/css/article-toc.css", import.meta.url), "utf8");
  assert.match(layout, /if page\.collection == 'designs' %}\s*<link[^\n]+article-toc\.css/);
  assert.match(layout, /if page\.collection == 'designs' %}\s*<div class="document-shell" data-document-shell>\s*\{% include document-nav.html %}\s*\{% include article-toc.html content=content %}/);
  assert.match(layout, /setupArticleToc\(document\.querySelector\("\[data-document-shell\]"\)\)/);
  assert.match(include, /<nav aria-label="On this page">/);
  assert.match(include, /<details class="article-toc-panel" open>/);
  assert.match(include, /<ol class="article-toc-list" role="list">/);
  assert.match(include, /<ol role="list">/);
  assert.match(include, /href="#\{\{ toc_id \| url_encode \| replace: '\+', '%20' \| escape \}\}"/);
  assert.doesNotMatch(include, /slugify|<script|<h[234]/);
  assert.match(css, /@media \(min-width: 1240px\)/);
  assert.doesNotMatch(css, /\.wrapper/);
  assert.match(css, /grid-template-columns: 210px minmax\(0, 1fr\) 220px/);
  assert.match(css, /position: sticky; top: calc\(var\(--site-header-height\) \+ 1\.25rem\)/);
  assert.match(css, /max-height: calc\(100dvh - var\(--site-header-height\) - 5rem\)/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css.match(/\.document-shell \{([^}]*)\}/)[1], /overflow(?:-x)?\s*:\s*hidden/);
});
