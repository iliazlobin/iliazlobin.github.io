import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const header = read('_includes/header.html');

test('only design collection articles inherit their owning top-level section', () => {
  assert.match(header, /if site.header_pages contains page.path[\s\S]*?assign section_title = page.title/);
  assert.match(header, /elsif page.collection == 'designs'[\s\S]*?if page.category == 'infra' or page.category == 'tech'[\s\S]*?assign section_title = 'Infrastructure'[\s\S]*?assign section_url = '\/infrastructure\/'[\s\S]*?else[\s\S]*?assign section_title = 'Design'[\s\S]*?assign section_url = '\/designs\/'/);
  assert.match(header, /assign section_title = nil/);
  assert.match(header, /assign section_url = nil/);
});

test('article section context is plain text and leaves the article title as the H1', () => {
  assert.match(header, /if page.collection == 'designs'[\s\S]*?<span class="site-page-title">{{ section_title \| escape }}<\/span>[\s\S]*?else[\s\S]*?<h1 class="site-page-title">{{ section_title \| escape }}<\/h1>/);
  assert.doesNotMatch(header, /<a[^>]*class="site-page-title"/);
  assert.match(read('_layouts/post.html'), /<h1 class="post-title" itemprop="name headline">{{ page.title \| escape }}<\/h1>/);
});

test('exact pages and owning article sections have distinct current-navigation semantics', () => {
  assert.match(header, /if my_page.url == page.url %} aria-current="page"{% elsif page.collection == 'designs' and my_page.url == section_url %} aria-current="location"/);
  const css = read('assets/css/site.css');
  assert.match(css, /\.site-nav \.page-link\[aria-current="page"\],\s*\.site-nav \.page-link\[aria-current="location"\] \{ color: var\(--accent\); font-weight: 600; \}/);
});

test('the Resume PDF icon sits beside the page title, only on Resume', () => {
  const heading = header.split('<div class="site-page-heading">')[1].split('</div>')[0];
  assert.match(heading, /<h1 class="site-page-title">[^]*<\/h1>[^]*if page.url == '\/resume\/'[^]*include resume-download.html icon_only=true/);
  assert.doesNotMatch(heading.match(/<h1\b[^]*?<\/h1>/)[0], /include resume-download/);
  assert.equal((header.match(/include resume-download/g) || []).length, 1);
  assert.match(read('assets/css/site.css'), /\.site-page-heading \.resume-download\s*\{\s*align-self:\s*center;/);
  assert.doesNotMatch(read('assets/css/resume.css'), /\.resume-email \.resume-download/);
});
