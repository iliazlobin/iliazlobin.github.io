import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { normalizeDiagramStyles } from "../assets/js/diagram-palette.mjs";

const designs = new URL("../_designs/", import.meta.url);
const blocks = (name) => [...readFileSync(new URL(name, designs), "utf8")
  .matchAll(/```mermaid\r?\n([\s\S]*?)\r?\n```/g)].map((match) => match[1]);
const withoutStyles = (source) => source.split("\n")
  .filter((line) => !/^\s*(classDef|style|rect)\s/.test(line)).join("\n");

test("legacy groups keep distinct fills with neutral borders and readable labels", () => {
  const source = "classDef thread fill:#e8f4f8,color:#1A1A1A,stroke:#5B9BD5,stroke-width:2px\n"
    + "classDef store fill:#fff3cd,color:#1A1A1A,stroke:#FFC107,stroke-width:2px\n"
    + "classDef alloc fill:#d4edda,color:#1A1A1A,stroke:#28A745,stroke-width:2px";
  const normalized = normalizeDiagramStyles(source);
  for (const fill of ["#e4f7fb", "#fef7e0", "#e6f4ea"]) assert.ok(normalized.includes(`fill:${fill}`));
  assert.equal((normalized.match(/stroke:#9aa0a6/g) || []).length, 3);
  assert.equal((normalized.match(/color:#202124/g) || []).length, 3);
  assert.equal((normalized.match(/stroke-width:1px/g) || []).length, 3);
});

test("individual styles, case, semicolons and matching group borders are supported", () => {
  assert.equal(normalizeDiagramStyles("  style C fill:#81D4FA,stroke:#0288D1,stroke-width:1.5px,color:#1A1A1A;"),
    "  style C fill:#e8f0fe,stroke:#9aa0a6,stroke-width:1px,color:#202124;");
  assert.equal(normalizeDiagramStyles("style G fill:#d3f9d8,stroke:#d3f9d8"),
    "style G fill:#e6f4ea,stroke:#e6f4ea");
});

test("preferred Bitly and feature-flag diagrams remain byte-for-byte unchanged", () => {
  for (const name of ["system-design-bitly-url-shortener.md", "low-level-design-feature-flag-evaluator.md"]) {
    assert.ok(blocks(name).length > 0);
    for (const source of blocks(name)) assert.equal(normalizeDiagramStyles(source), source);
  }
});

test("Memcached groups the worker pool and shared memory without duplicate access paths", () => {
  const source = blocks("tech-memcached.md")[0];
  assert.match(source, /^flowchart TB\n/);
  assert.match(source, /accTitle: Memcached connections, worker threads and shared memory/);
  assert.match(source, /accDescr: /);
  for (const group of ["Connections", "Execution", "Memory"]) {
    assert.match(source, new RegExp(`subgraph ${group}\\[`));
  }
  for (const [lock, target] of [["Item locks", "HT"], ["LRU locks", "LRU"], ["slabs_lock", "SLAB"]]) {
    assert.ok(source.includes(`Workers -->|${lock}| ${target}`));
  }
  assert.equal((source.match(/-->/g) || []).length, 5);
  assert.doesNotMatch(source, /\b(?:W1|W2|WN)\b/);
  assert.equal(normalizeDiagramStyles(source), source);
});

test("unknown styling, labels, links, comments and SVG paths are not rewritten", () => {
  const source = 'flowchart TB\n  A["fill:#d0ebff"] --> B["#d3f9d8"]\n'
    + '  %% style A fill:#d0ebff\n  style B fill:#123456,stroke:#ff0000\n'
    + '  linkStyle 0 stroke:#ff0000,stroke-width:2px\n  style A fill:none,stroke:#fff';
  assert.equal(normalizeDiagramStyles(source), source);
});

test("sequence bands use the palette without changing messages", () => {
  const source = "sequenceDiagram\n  rect rgb(240, 248, 255)\n    A->>B: Commit\n  end\n"
    + "  rect rgb(255, 248, 240)\n    B-->>A: Done\n  end";
  const normalized = normalizeDiagramStyles(source);
  assert.ok(normalized.includes("rect rgb(232, 240, 254)"));
  assert.ok(normalized.includes("rect rgb(254, 239, 227)"));
  assert.equal(withoutStyles(normalized), withoutStyles(source));
});

test("all current article diagrams retain their topology and normalize idempotently", () => {
  let total = 0;
  let updated = 0;
  for (const name of readdirSync(designs).filter((name) => name.endsWith(".md"))) {
    for (const source of blocks(name)) {
      const normalized = normalizeDiagramStyles(source);
      assert.equal(withoutStyles(normalized), withoutStyles(source), name);
      assert.equal(normalizeDiagramStyles(normalized), normalized, name);
      assert.doesNotMatch(normalized, /^\s*(classDef|style)\s+.*fill:#(?:d0ebff|d3f9d8|fff3bf|ffe8cc)/im, name);
      total++;
      if (source !== normalized) updated++;
    }
  }
  assert.ok(total > 100, `Checked ${total} diagrams`);
  // Reviewed Notion diagrams increasingly use the shared palette already.
  // Exercise remaining legacy styles without pinning their corpus count.
  assert.ok(updated > 0, `Restyled ${updated} diagrams`);
});
