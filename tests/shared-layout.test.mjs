import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("header, page and footer use one border-box shell and responsive gutter", () => {
  const css = read("assets/css/site.css");
  assert.match(css, /--site-shell-width:\s*1340px/);
  assert.match(css, /--site-gutter:\s*30px/);
  assert.match(css, /\.wrapper\s*\{\s*box-sizing: border-box;\s*width: 100%;\s*max-width: var\(--site-shell-width\);\s*margin-inline: auto;\s*padding-inline: var\(--site-gutter\);\s*\}/);
  assert.match(css, /@media \(max-width: 800px\)\s*\{\s*:root\s*\{ --site-gutter: 15px; \}/);
  const layout = read("_layouts/default.html");
  assert.match(layout, /<main class="page-content"[^>]*>\s*<div class="wrapper">/);
  assert.match(read("_includes/header.html"), /<div class="wrapper">/);
  assert.match(layout, /include footer\.html/);
});

test("listing and document styles cannot override shared shell widths or gutters", () => {
  assert.doesNotMatch(read("assets/css/article-toc.css"), /\.wrapper/);
  const portfolio = read("assets/css/portfolio.css");
  const rules = [...portfolio.matchAll(/[^{}]*\.wrapper[^{}]*\{([^{}]*)\}/g)];
  assert.ok(rules.length > 0);
  for (const [, rule] of rules) {
    assert.doesNotMatch(rule, /(?:max-width|width|box-sizing|padding)\s*:/);
  }
});

test("About reading blocks inherit the shared document width without changing text alignment", () => {
  const css = read("assets/css/about.css");
  const intro = css.match(/\.about-intro\s*\{([^}]*)\}/)[1];
  const section = css.match(/\.about-section\s*\{([^}]*)\}/)[1];
  assert.doesNotMatch(intro, /max-width:/);
  assert.match(intro, /margin:\s*0 0 1\.75rem/);
  assert.doesNotMatch(section, /max-width:/);
  assert.match(read("assets/css/article-toc.css"), /max-width:\s*var\(--site-reading-width\)/);
  assert.doesNotMatch(css, /\.wrapper|text-align:\s*center/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*grid-template-columns:\s*1fr/);
});

test("page listings avoid article card padding while article prose stays readable", () => {
  assert.match(read("_layouts/page.html"), /<article class="post post--page\{% if page\.toc %\} post--document/);
  const css = read("assets/css/blog.css");
  assert.doesNotMatch(css, /(?:^|\n)\.post\s*\{/);
  assert.match(css, /\.post:not\(\.post--page\)\s*\{[^}]*max-width: none;/);
  assert.match(css, /\.post:not\(\.post--page\):not\(\.post--document\) > :is\(\.post-header, \.post-content\)\s*\{\s*max-width: var\(--site-reading-width\); margin-inline: auto;/);
  assert.doesNotMatch(css.match(/\.post-footer\s*\{([^}]*)\}/)[1], /max-width/);
});
