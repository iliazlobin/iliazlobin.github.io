import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const article = readFileSync(new URL("../_designs/tech-memcached.md", import.meta.url), "utf8");

test("Memcached headings follow a subject-specific hierarchy", () => {
  const sections = [...article.matchAll(/^## (.+)$/gm)]
    .map(([, heading]) => heading.replace(/ \{#[^}]+\}$/, ""));
  assert.deepEqual(sections, [
    "Overview",
    "Core concepts",
    "Internal architecture",
    "Usage patterns",
    "Scaling and failure recovery",
    "Suitability and constraints",
    "Deployment options and alternatives",
  ]);
  assert.match(article, /^### Cache eviction \(LRU\) \{#the-lru-eviction-system\}$/m);
  assert.match(article, /^### Connection handling and worker threads \{#the-event-loop\}$/m);
  assert.doesNotMatch(article, /^#+ (?:Where It's Heading|The Landscape|What You Build With It|When To Use It)/m);
});

test("Memcached retains useful operating caveats and sources without a generic closing section", () => {
  assert.match(article, /LRU stands for \*\*least recently used\*\*/);
  assert.match(article, /It is an eviction policy/);
  assert.ok(article.includes("https://github.com/memcached/memcached/blob/master/doc/new_lru.txt"));
  assert.ok(article.includes("https://memcached.org/blog/proxy-intro/"));
  assert.ok(article.includes("https://docs.memcached.org/serverguide/configuring/"));
  assert.match(article, /private networks/);
  assert.match(article, /Benchmark candidate caches with your own keys/);
  assert.match(article, /same stored data, request volume, and deployment requirements/);
  assert.match(article, /efficiency lock, not a correctness lock/);
});
