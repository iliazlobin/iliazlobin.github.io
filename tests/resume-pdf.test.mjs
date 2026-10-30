import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));

test('download is the exact user-approved PDF and its URL version matches its bytes', () => {
  const pdf = read('assets/documents/ilia-zlobin-resume.pdf');
  const hash = createHash('sha256').update(pdf).digest('hex');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(pdf.byteLength, 99990);
  assert.equal(hash, '16f4ed50d745e9c90f7d07bd363141dc30b503cc379a5a836318b61a8b3c655f');
  assert.match(read('_config.yml').toString(), new RegExp(`^resume_pdf_version: "${hash.slice(0, 12)}"$`, 'm'));
  assert.match(read('_includes/resume-download.html').toString(), /\?v=\{\{ site\.resume_pdf_version \}\}/);
});
