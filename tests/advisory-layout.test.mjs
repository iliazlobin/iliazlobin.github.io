import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Advisory retains every headline phrase and its existing semantic relationship', () => {
  const page = read('advisory.md');
  const headline = page.match(/<h2 id="advisory-focus" class="advisory-headline" data-toc-label="Overview">([\s\S]*?)<\/h2>/)[1];
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

test('Advisory inherits the shared reading width and owns only its top gap and stylesheet', () => {
  const css = read('assets/css/advisory.css');
  assert.match(css, /\.page-content:has\(\.advisory\)\s*\{\s*padding-top:\s*clamp\(1\.5rem, 3vw, 2rem\);\s*\}/);
  assert.match(css, /\.advisory\s*\{\s*margin:\s*0 0 2rem;/);
  assert.doesNotMatch(css, /max-width:/);
  assert.match(read('assets/css/article-toc.css'), /max-width:\s*var\(--site-reading-width\)/);
  assert.doesNotMatch(css, /text-align:\s*center/);
  assert.match(read('advisory.md'), /assets\/css\/advisory\.css/);
  for (const page of ['index.md', 'resume.md', 'portfolio.md', 'designs.md', 'infrastructure.md']) {
    assert.doesNotMatch(read(page), /assets\/css\/advisory\.css/);
  }
  assert.doesNotMatch(css, /\.wrapper|\.site-header|\.site-nav/);
});

test('Advisory uses the shared left contact card without a Contact heading or duplicated footer actions', () => {
  const page = read('advisory.md');
  assert.match(page, /^left_rail: advisory-contact\.html$/m);
  assert.match(page, /^left_rail_label: Connect with Ilia$/m);
  assert.doesNotMatch(page, /<h[1-6][^>]*>Contact<\/h[1-6]>|class="[^"]*\badvisory-contact\b|include social-links|include resume-download/);
  const card = read('_includes/advisory-contact.html');
  assert.match(card, /<details class="profile-panel advisory-contact-panel" data-side-panel open>/);
  assert.match(card, /<summary>Connect<\/summary>/);
  assert.match(card, /class="profile-card"/);
  assert.match(card, /include profile-contact\.html booking=true gmail_subject="Technical advisory"/);
  assert.doesNotMatch(card, /work_status=|resume_download=|qualifications|education|certifications|resume\.css/);
});

test('one contact component preserves the native copy, Gmail, booking and profile actions', () => {
  const contact = read('_includes/profile-contact.html');
  assert.match(contact, /<section class="resume-section" id="contact" aria-label="Contact details">/);
  assert.match(contact, /San Francisco Bay Area, CA/);
  assert.match(contact, /<button type="button"[^>]*data-copy-email="\{\{ site.email \| escape \}\}"/);
  assert.match(contact, /role="status"/);
  assert.match(contact, /site.email \| uri_escape/);
  assert.match(contact, /if include.gmail_subject.*&amp;su=\{\{ include.gmail_subject \| uri_escape \}\}/);
  assert.match(contact, /if include.work_status[\s\S]*Green Card[\s\S]*endif/);
  assert.match(contact, /if include.resume_download[\s\S]*include resume-download.html icon_only=true[\s\S]*endif/);
  assert.match(contact, /include social-links.html booking=include.booking/);
  const socials = read('_includes/social-links.html');
  assert.match(socials, /if include.booking and site.advisory_booking_url/);
  assert.match(socials, /aria-label="Schedule a call"/);
  for (const label of ['LinkedIn', 'GitHub', 'LeetCode', 'YouTube', 'Instagram', 'X']) {
    assert.ok(socials.includes(`aria-label="${label}"`));
  }
});

test('contact cards share styles and responsive disclosure behavior, not Resume-only layout', () => {
  const layout = read('_layouts/page.html');
  assert.match(layout, /if page.left_rail.*profile-contact.css/);
  const css = read('assets/css/profile-contact.css');
  assert.match(css, /\.profile-card\s*\{[^}]*border: 1px solid var\(--line\);[^}]*border-radius: var\(--radius\);/);
  assert.match(css, /\.resume-email\s*\{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.resume-email-copy\s*\{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.resume-email-copy:focus-visible/);
  assert.match(css, /@media \(min-width: 1240px\)\s*\{\s*\.profile-panel > summary \{ display: none; \}/);
  assert.match(css, /@media print\s*\{\s*\.profile-panel > summary \{ display: none; \}/);
  assert.doesNotMatch(css, /grid-template-columns|max-height|position:\s*sticky/);
  assert.doesNotMatch(read('assets/css/resume.css'), /\.resume-email-copy\s*\{|\.resume-profile\s*\{/);
});
