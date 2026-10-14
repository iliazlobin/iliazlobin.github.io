import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Advisory retains every headline phrase and its existing semantic relationship', () => {
  const page = read('advisory.md');
  const headline = page.match(/<h2 id="advisory-focus" class="advisory-headline">([\s\S]*?)<\/h2>/)[1];
  assert.deepEqual([...headline.matchAll(/<span>(.*?)<\/span>/g)].map(([, text]) => text), [
    'Technical Leadership &amp; Professional Growth',
    'Systems Designs &amp; Cloud Architecture',
    'AI/ML Engineering'
  ]);
  assert.match(page, /<section class="advisory" aria-labelledby="advisory-focus">/);
  assert.match(page, /^title: Advisory$/m);
});

test('Advisory headline is compact, naturally wrapping and untruncated', () => {
  const css = read('assets/css/advisory.css');
  const headline = css.match(/\.advisory \.advisory-headline\s*\{([^}]*)\}/)[1];
  assert.match(headline, /font-size:\s*clamp\(1\.125rem, calc\(1rem \+ \.75vw\), 1\.5rem\)/);
  assert.match(headline, /font-weight:\s*600/);
  assert.match(headline, /line-height:\s*1\.3/);
  assert.match(headline, /gap:\s*\.25rem/);
  assert.match(headline, /margin:\s*0 0 1\.1rem/);
  assert.match(css, /\.advisory-headline > span\s*\{[^}]*text-wrap:\s*balance;[^}]*overflow-wrap:\s*break-word;/);
  assert.doesNotMatch(css, /(?:^|[;{])\s*(?:height|white-space|overflow|line-clamp)\s*:/m);
});

test('Only Advisory owns the reduced top gap and its page stylesheet', () => {
  const css = read('assets/css/advisory.css');
  assert.match(css, /\.page-content:has\(\.advisory\)\s*\{\s*padding-top:\s*clamp\(1\.5rem, 3vw, 2rem\);\s*\}/);
  assert.match(css, /\.advisory\s*\{\s*max-width:\s*800px;\s*margin:\s*0 0 2rem;/);
  assert.match(read('advisory.md'), /assets\/css\/advisory\.css/);
  for (const page of ['index.md', 'resume.md', 'portfolio.md', 'designs.md', 'infrastructure.md']) {
    assert.doesNotMatch(read(page), /assets\/css\/advisory\.css/);
  }
  assert.doesNotMatch(css, /\.wrapper|\.site-header|\.site-nav/);
});
