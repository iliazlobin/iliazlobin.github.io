import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const resume = read('resume.md');

test('Google is the latest role, with a month-only start and no responsibilities', () => {
  const entries = [...resume.matchAll(/<article class="resume-role"[^>]*>([^]*?)<\/article>/g)];
  assert.equal(entries.length, 6);
  const google = entries[0][1];
  assert.match(google, /<h3 id="google--forward-deployed-engineer">Google<\/h3>/);
  assert.match(google, /<p class="resume-role-title">Forward Deployed Engineer<\/p>/);
  assert.match(google, /<p class="resume-role-location">Bay Area, CA<\/p>/);
  assert.match(google, /<time datetime="2026-10" title="October 2026">Oct 2026<\/time> <span aria-hidden="true">–<\/span> Present/);
  assert.doesNotMatch(google, /datetime="2026-10-\d|<li\b|^\s*- /m);
  assert.equal(google.split('</header>')[1].trim(), '');
});

test('Meta matches the approved résumé title and September end month', () => {
  const meta = resume.match(/aria-labelledby="meta--bay-area-ca-staff-software-engineer"[^>]*>([^]*?)<\/article>/)[1];
  assert.match(meta, /<p class="resume-role-title">Software Engineer<\/p>/);
  assert.match(meta, /<time datetime="2026-09" title="September 2026">Sep 2026<\/time>/);
  assert.doesNotMatch(meta, /Present/);
  assert.match(resume, /<p class="resume-role-title">Principal Software Engineer<\/p>/);
});

test('current-role copy is consistent across About, Resume and shared metadata', () => {
  for (const path of ['index.md', 'resume.md', '_config.yml']) {
    assert.match(read(path), /description: [^\n]*Forward Deployed Engineer at Google/);
  }
  assert.match(read('index.md'), />Forward Deployed Engineer at Google<\/a>/);
  assert.match(resume, /\*\*Forward Deployed Engineer at Google\*\* with \*\*14\+ years of experience\*\*/);
  assert.match(read('_includes/header.html'), /class="site-role">Forward Deployed Engineer · Google<\/p>/);
});
