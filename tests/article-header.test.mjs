import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const layout = read("_layouts/post.html");
const header = layout.match(/<header class="post-header">([\s\S]*?)<\/header>/)[1];
const meta = header.match(/<div class="meta">([\s\S]*?)<\/div>/)[1];
const title = header.match(/<h1 class="post-title"[^>]*>[\s\S]*?<\/h1>/)[0];
const tags = header.match(/<div class="post-tags">([\s\S]*?)<\/div>/)[0];

test("article header separates owning category metadata from topic tags below the title", () => {
  assert.ok(header.indexOf('class="meta"') < header.indexOf(title));
  assert.ok(header.indexOf(title) < header.indexOf(tags));
  assert.match(meta, /<time datetime="{{ page\.date \| date_to_xmlschema }}" itemprop="datePublished">/);
  assert.match(meta, /<span class="reading-time">{{ minutes }} min read<\/span>/);
  assert.match(meta, /if type_label %}\s*<a class="type-label post-category" data-type-filter="{{ page\.category \| escape }}"/);
  assert.doesNotMatch(meta, /post-tags|for tag in page\.tags/);
  assert.doesNotMatch(tags, /type_label|\?type=/);
  assert.match(header, /<\/h1>\s*{%- if page\.tags\.size > 0 %}\s*<div class="post-tags">/);
});

test("category and tag filters retain their owning routes, encoding and existing display mapping", () => {
  const categoryLink = meta.match(/<a class="type-label post-category"[^>]+>/)[0];
  assert.ok(categoryLink.includes('href="{{ tag_base | relative_url }}?type={{ page.category | url_encode }}"'));
  assert.ok(tags.includes('href="{{ tag_base | relative_url }}?tag={{ tag | url_encode }}"'));
  assert.ok(tags.includes("{% if tag == 'System Design' %}SD{% else %}{{ tag | escape }}{% endif %}"));
  const routing = new Map([...meta.matchAll(/{%- when '([^']+)' %}{%- assign tag_base = '([^']+)' %}/g)]
    .map(([, category, base]) => [category, base]));
  assert.deepEqual([...routing], [
    ["tech", "/infrastructure/"], ["infra", "/infrastructure/"],
    ["system-design-ml", "/designs/"], ["low-level-design", "/designs/"],
    ["ai", "/designs/"], ["research", "/research/"], ["system-design", "/designs/"],
  ]);
  assert.match(meta, /{%- else %}{%- assign tag_base = '\/blog\/' %}/);
  assert.ok(header.indexOf("endcase") < header.indexOf("if type_label"));
  assert.ok(header.indexOf("endcase") < header.indexOf(tags));
});

test("header retains BlogPosting semantics, ordinary blog navigation and optional repository action", () => {
  assert.match(layout, /itemscope itemtype="https:\/\/schema\.org\/BlogPosting"/);
  assert.match(title, /itemprop="name headline">{{ page\.title \| escape }}/);
  assert.match(layout, /<div class="post-content" itemprop="articleBody">/);
  assert.match(header, /if page\.mvp_repo %}\s*<div class="post-actions">/);
  assert.ok(header.indexOf(tags) < header.indexOf('class="post-actions"'));
  assert.match(header, /href="{{ page\.mvp_repo }}" target="_blank" rel="noopener"/);
  assert.match(layout, /unless page\.collection == 'designs' %}\s*<nav class="post-footer">/);
  assert.match(layout, /{{ '\/blog\/' \| relative_url }}">← All posts/);
});

test("header tag row wraps compactly and category badge uses the same styling as cards", () => {
  const css = read("assets/css/blog.css");
  assert.match(css, /\.post-tags \{ display: flex; flex-wrap: wrap; gap: \.35rem; \}/);
  assert.match(css, /\.post-header \.post-tags \{ margin-top: \.65rem; \}/);
  assert.match(css, /\.post-header \.post-tags \.tag \{ box-sizing: border-box; max-width: 100%; overflow-wrap: anywhere; \}/);
  assert.match(css, /\.post-header \.post-category \{ align-self: center; margin-bottom: 0; \}/);
  assert.match(read("_layouts/default.html"), /content-labels\.css/);
  const badgeCss = read("assets/css/content-labels.css");
  for (const category of ["system-design", "system-design-ml", "low-level-design", "ai", "infra", "tech"]) {
    assert.ok(badgeCss.includes(`.type-label[data-type-filter="${category}"]`));
  }
  assert.match(read("_includes/design-list.html"), /class="type-label" data-type-filter="{{ d\.category \| escape }}"/);
});
