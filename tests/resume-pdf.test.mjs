import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));

test('download is the exact user-approved PDF and its URL version matches its bytes', () => {
  const pdf = read('assets/documents/ilia-zlobin-resume.pdf');
  const hash = createHash('sha256').update(pdf).digest('hex');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(pdf.byteLength, 168358);
  assert.equal(hash, '39a56a7e7337129acab8e0388a850a22050d3a19956dfe35fa9ab39f796c7021');
  assert.match(read('_config.yml').toString(), new RegExp(`^resume_pdf_version: "${hash.slice(0, 12)}"$`, 'm'));
  assert.match(read('_includes/resume-download.html').toString(), /\?v=\{\{ site\.resume_pdf_version \}\}/);
});
