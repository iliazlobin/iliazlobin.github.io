import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const asset = 'images/og-ilia-zlobin-staff-portrait-v1.png';

test('social preview uses the approved company-free portrait without changing page content', () => {
  const config = read('_config.yml').toString();
  assert.match(config, /defaults:\s*\n\s*- scope:\s*\n\s*path: ""\s*\n\s*values:\s*\n\s*image:\s*\n\s*path: \/images\/og-ilia-zlobin-staff-portrait-v1\.png\s*\n\s*width: 1730\s*\n\s*height: 909\s*\n\s*alt: "Ilia Zlobin — Staff Software Engineer"/);
  assert.match(config, /card: summary_large_image/);
  assert.match(read('_layouts/default.html').toString(), /seo/);
});

test('versioned PNG is the exact approved non-company image with metadata-matching dimensions', () => {
  const png = read(asset);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.subarray(12, 16).toString(), 'IHDR');
  assert.equal(png.readUInt32BE(16), 1730);
  assert.equal(png.readUInt32BE(20), 909);
  assert.ok(png.byteLength < 5 * 1024 * 1024);
  assert.equal(createHash('sha256').update(png).digest('hex'),
    'fff6ec34a2d60b812d563c11310be3eaef42775fb97162fbb82932183b53cadb');
});
