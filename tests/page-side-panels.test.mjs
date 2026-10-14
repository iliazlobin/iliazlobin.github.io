import assert from "node:assert/strict";
import test from "node:test";
import { setupArticleToc, setupSidePanels } from "../assets/js/article-toc.mjs";

function element() {
  return {
    attrs: {}, listeners: new Map(),
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(name, callback) { this.listeners.set(name, callback); },
    removeEventListener(name, callback) {
      if (this.listeners.get(name) === callback) this.listeners.delete(name);
    },
  };
}

function fixture({ desktop = false, count = 2, missingSummary = false, hash = "" } = {}) {
  const events = new Map();
  const mediaEvents = new Map();
  const summaries = Array.from({ length: count }, element);
  const targets = Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? "education" : index === 1 ? "professional-certifications" : `qualification-${index}`,
  }));
  const outsideTarget = { id: "outside-body" };
  const panels = summaries.map((summary, index) => ({
    open: true,
    contains(target) { return target === targets[index]; },
    querySelector(selector) {
      assert.equal(selector, "summary");
      return missingSummary && index === count - 1 ? null : summary;
    },
  }));
  const root = {
    ownerDocument: {
      getElementById(id) { return [...targets, outsideTarget].find(target => target.id === id) || null; },
    },
    querySelectorAll(selector) {
      assert.equal(selector, "details[data-side-panel]");
      return panels;
    },
  };
  const media = {
    matches: desktop,
    addEventListener(name, callback) { mediaEvents.set(name, callback); },
    removeEventListener(name, callback) {
      if (mediaEvents.get(name) === callback) mediaEvents.delete(name);
    },
  };
  const view = {
    location: { hash },
    matchMedia(query) {
      assert.equal(query, "(min-width: 1240px)");
      return media;
    },
    addEventListener(name, callback) { events.set(name, callback); },
    removeEventListener(name, callback) {
      if (events.get(name) === callback) events.delete(name);
    },
  };
  function click(index) {
    let prevented = false;
    summaries[index].listeners.get("click")?.({ preventDefault() { prevented = true; } });
    if (!prevented) panels[index].open = !panels[index].open;
    return prevented;
  }
  function breakpoint(matches) {
    media.matches = matches;
    mediaEvents.get("change")?.();
  }
  return { root, view, panels, summaries, targets, events, mediaEvents, click, breakpoint };
}

test("side panels are open and non-collapsible desktop details", () => {
  const dom = fixture({ desktop: true });
  setupSidePanels(dom.root, dom.view);
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, true]);
  for (const summary of dom.summaries) {
    assert.equal(summary.tabIndex, -1);
    assert.equal(summary.attrs["aria-disabled"], "true");
  }
  assert.equal(dom.click(0), true);
  assert.equal(dom.panels[0].open, true);
});

test("narrow side panels start collapsed and preserve independent native toggles until a breakpoint change", () => {
  const dom = fixture();
  setupSidePanels(dom.root, dom.view);
  assert.deepEqual(dom.panels.map(panel => panel.open), [false, false]);
  for (const summary of dom.summaries) {
    assert.equal(summary.tabIndex, 0);
    assert.equal(summary.attrs["aria-disabled"], undefined);
  }
  assert.equal(dom.click(0), false);
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, false]);
  assert.equal(dom.events.has("resize"), false, "ordinary narrow resizes must not reset a reader's choice");
  dom.breakpoint(true);
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, true]);
  assert.equal(dom.summaries[0].tabIndex, -1);
  assert.equal(dom.summaries[0].attrs["aria-disabled"], "true");
  dom.breakpoint(false);
  assert.deepEqual(dom.panels.map(panel => panel.open), [false, false]);
  assert.equal(dom.summaries[0].tabIndex, 0);
  assert.equal(dom.summaries[0].attrs["aria-disabled"], undefined);
  assert.equal(dom.click(1), false);
  assert.deepEqual(dom.panels.map(panel => panel.open), [false, true]);
});

test("printing exposes all qualifications and restores exact mixed mobile states afterward", () => {
  const dom = fixture({ count: 3 });
  setupSidePanels(dom.root, dom.view);
  dom.click(1);
  const before = dom.panels.map(panel => panel.open);
  assert.deepEqual(before, [false, true, false]);
  dom.events.get("beforeprint")();
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, true, true]);
  dom.events.get("beforeprint")();
  dom.events.get("afterprint")();
  assert.deepEqual(dom.panels.map(panel => panel.open), before, "repeated beforeprint must not overwrite saved states");
  dom.events.get("afterprint")();
  assert.deepEqual(dom.panels.map(panel => panel.open), before);
  dom.events.get("beforeprint")();
  dom.events.get("afterprint")();
  assert.deepEqual(dom.panels.map(panel => panel.open), before, "later print sessions must capture a fresh state");
});

test("qualification fragments reveal only their containing panel on initial load, hashchange and breakpoint changes", () => {
  const dom = fixture({ hash: "#education" });
  const controller = setupSidePanels(dom.root, dom.view);
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, false]);
  assert.equal(dom.view.location.hash, "#education", "fragment navigation remains browser-owned");
  dom.click(0);
  assert.deepEqual(dom.panels.map(panel => panel.open), [false, false]);
  dom.view.location.hash = "#professional%2Dcertifications";
  dom.events.get("hashchange")();
  assert.deepEqual(dom.panels.map(panel => panel.open), [false, true]);
  assert.equal(dom.view.location.hash, "#professional%2Dcertifications");
  dom.breakpoint(true);
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, true]);
  dom.breakpoint(false);
  assert.deepEqual(dom.panels.map(panel => panel.open), [false, true], "a targeted qualification remains accessible when returning to narrow layout");
  controller.destroy();
  assert.equal(dom.events.has("hashchange"), false);
});

test("malformed, missing and outside qualification hashes do not open unrelated panels", () => {
  const dom = fixture({ hash: "#%broken" });
  const controller = setupSidePanels(dom.root, dom.view);
  assert.deepEqual(dom.panels.map(panel => panel.open), [false, false]);
  for (const hash of ["#outside-body", "#unknown", "#%broken", ""]) {
    dom.view.location.hash = hash;
    assert.doesNotThrow(() => dom.events.get("hashchange")());
    assert.deepEqual(dom.panels.map(panel => panel.open), [false, false], `unexpected disclosure for ${hash}`);
    dom.breakpoint(true);
    dom.breakpoint(false);
    assert.deepEqual(dom.panels.map(panel => panel.open), [false, false]);
  }
  controller.destroy();
});

test("cleanup unhooks every listener and restores an unfinished print session", () => {
  const dom = fixture();
  const controller = setupSidePanels(dom.root, dom.view);
  dom.click(0);
  dom.events.get("beforeprint")();
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, true]);
  controller.destroy();
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, false]);
  assert.equal(dom.mediaEvents.size, 0);
  assert.equal(dom.events.size, 0);
  assert.ok(dom.summaries.every(summary => summary.listeners.size === 0));
  controller.destroy();
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, false]);
});

test("empty roots remain no-ops and a panel without a summary still retains content and print state", () => {
  assert.equal(setupSidePanels(null, {}), null);
  assert.equal(setupSidePanels({ querySelectorAll() { return []; } }, {}), null);
  const dom = fixture({ missingSummary: true });
  const controller = setupSidePanels(dom.root, dom.view);
  dom.events.get("beforeprint")();
  assert.deepEqual(dom.panels.map(panel => panel.open), [true, true]);
  dom.events.get("afterprint")();
  assert.deepEqual(dom.panels.map(panel => panel.open), [false, false]);
  assert.equal(dom.summaries[1].listeners.size, 0);
  controller.destroy();
});

function tocFixture({ sharedRail = true, desktop = true, above = false } = {}) {
  const summary = element();
  const panel = { open: true, querySelector() { return summary; } };
  const link = Object.assign(element(), {
    getAttribute() { return "#summary"; },
    getBoundingClientRect() { return above ? { top: 10, bottom: 30 } : { top: 450, bottom: 480 }; },
  });
  const heading = { id: "summary", getBoundingClientRect() { return { top: 0 }; } };
  const rail = { scrollTop: 200, getBoundingClientRect() { return { top: 100, bottom: 400 }; } };
  const nav = { scrollTop: 75, getBoundingClientRect() { return { top: 200, bottom: 300 }; } };
  const toc = Object.assign(element(), {
    querySelectorAll() { return [link]; },
    querySelector(selector) { return selector === "details" ? panel : selector === "nav" ? nav : null; },
  });
  const content = { contains(candidate) { return candidate === heading; } };
  const document = {
    documentElement: { scrollHeight: 2000 },
    getElementById() { return heading; },
  };
  const media = { matches: desktop, addEventListener() {}, removeEventListener() {} };
  const view = {
    scrollY: 0, innerHeight: 600,
    matchMedia() { return media; },
    getComputedStyle() { return { getPropertyValue() { return "64px"; } }; },
    addEventListener() {}, removeEventListener() {},
  };
  const shell = {
    ownerDocument: document,
    querySelector(selector) {
      if (selector === "[data-article-toc]") return toc;
      if (selector === ".post-content") return content;
      if (selector === "[data-toc-scroll]") return sharedRail ? rail : null;
      return null;
    },
  };
  return { shell, view, rail, nav };
}

test("page TOC reveals entries by scrolling only the shared bounded right rail", () => {
  const below = tocFixture();
  const controller = setupArticleToc(below.shell, below.view);
  assert.equal(below.rail.scrollTop, 280);
  assert.equal(below.nav.scrollTop, 75);
  assert.equal(below.view.scrollY, 0);
  controller.destroy();
  const above = tocFixture({ above: true });
  setupArticleToc(above.shell, above.view).destroy();
  assert.equal(above.rail.scrollTop, 110);
  assert.equal(above.nav.scrollTop, 75);
});

test("article TOC keeps its existing nav scroll fallback; mobile scrolls neither rail", () => {
  const article = tocFixture({ sharedRail: false });
  setupArticleToc(article.shell, article.view).destroy();
  assert.equal(article.nav.scrollTop, 255);
  assert.equal(article.rail.scrollTop, 200);
  const mobile = tocFixture({ desktop: false });
  setupArticleToc(mobile.shell, mobile.view).destroy();
  assert.equal(mobile.rail.scrollTop, 200);
  assert.equal(mobile.nav.scrollTop, 75);
});
