import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync(new URL("../_layouts/post.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../assets/css/documents.css", import.meta.url), "utf8");

test("compact document styling is loaded last and only for the design collection", () => {
  assert.match(layout, /if page\.collection == 'designs' %}\s*<link[^\n]+documents\.css[^\n]+\n\{%- endif %}/);
  assert.ok(layout.indexOf("documents.css") > layout.indexOf("diagrams.css"));
  assert.match(layout, /class="post post--google-diagrams\{% if page\.collection == 'designs' %} post--document\{% endif %}"/);
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\{)/g);
  for (const selector of selectors.filter(s => !s.trim().startsWith("@"))) {
    assert.ok(selector.split(",\n").every(s => s.trim().startsWith(".post--document")), selector);
  }
});

test("loose and tight bullets share compact spacing while paragraphs remain distinct", () => {
  assert.match(css, /\.post-content li \{ margin: 0; \}/);
  assert.match(css, /\.post-content li \+ li \{ margin-top: \.25rem; \}/);
  assert.match(css, /\.post-content li > p \{ margin: 0; \}/);
  assert.match(css, /\.post-content li > \* \+ p \{ margin-top: \.4rem; \}/);
  assert.match(css, /\.post-content li > :is\(ul, ol\) \{ margin: \.35rem 0 0; \}/);
});

test("formatting preserves text sizes, diagram labels and mobile overflow", () => {
  assert.doesNotMatch(css, /font-size\s*:|min-width\s*:|overflow(?:-x)?\s*:\s*hidden/);
  assert.doesNotMatch(css, /\.post-content p\s*\{/);
  assert.doesNotMatch(css, /\.mermaid\s+(?:svg|p|text|\.nodeLabel)/);
  assert.match(css, /:is\(h2, h3, h4\) \+ :is\(h3, h4\)/);
});

test("code wrappers have one outer margin and tables retain readable padding", () => {
  assert.match(css, /div\.highlighter-rouge \{ margin: \.85rem 0; \}/);
  assert.match(css, /div\.highlighter-rouge > \.highlight,\s*[^{}]+div\.highlighter-rouge pre \{ margin: 0; \}/);
  assert.match(css, /:is\(th, td\) \{ padding: \.45rem \.65rem; \}/);
});

test("News Feed SLO table keeps regex alternation inside the measurement cell", () => {
  const source = readFileSync(new URL("../_designs/infra-news-feed.md", import.meta.url), "utf8");
  const row = source.split("\n").find(line => line.startsWith("| Feed read availability |"));
  const cells = row.split(/(?<!\\)\|/).slice(1, -1);
  assert.equal(cells.length, 3);
  assert.ok(cells[1].includes('status=~"2.. &#124; 4.."'));
  assert.match(cells[1], /<code>[^<]+<\/code>/);
  assert.equal(cells[2].trim(), "99.95% monthly");
});
