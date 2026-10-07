import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collectDiagrams, extractDiagrams, thumbnailTargets } from "./render_diagrams.mjs";

test("thumbnail selection uses the HLD heading, not the first functional sequence", () => {
  const text = "## Functional scenarios\n\n```mermaid\nsequenceDiagram\n A->>B: Submit\n```\n"
    + "## High-level design\n\n```mermaid\nflowchart TB\n A --> B\n```\n";
  const blocks = extractDiagrams(text);
  assert.equal(blocks[0].heading, "Functional scenarios");
  assert.equal(blocks[1].heading, "High-level design");
  const diagrams = blocks.map((diagram, index) => ({ ...diagram, index: index + 1,
    path: "_designs/example.md", systemDesign: true, thumbnail: "/images/posts/example.svg" }));
  assert.equal(thumbnailTargets(diagrams, "/repository")[0].diagram.index, 2);
  assert.equal(thumbnailTargets(diagrams, "/repository")[0].destination, "/repository/images/posts/example.svg");
});

test("thumbnail replacement rejects missing HLDs and paths outside article assets", () => {
  const diagram = { path: "_designs/example.md", systemDesign: true, heading: "Deep dives" };
  assert.throws(() => thumbnailTargets([diagram], "/repository"), /missing HLD/);
  assert.throws(() => thumbnailTargets([{ ...diagram, heading: "High-level design",
    thumbnail: "/images/posts/../../other.svg" }], "/repository"), /unsafe thumbnail/);
});

test("offline collection covers every article diagram and preserves source bytes", () => {
  const root = new URL("../", import.meta.url).pathname;
  const all = collectDiagrams(root);
  const systems = collectDiagrams(root, true);
  assert.ok(all.length > systems.length);
  assert.equal(new Set(systems.map(diagram => diagram.path)).size, 47);
  assert.equal(thumbnailTargets(systems, root).length, 47);
  for (const diagram of systems) {
    const text = readFileSync(new URL(`../${diagram.path}`, import.meta.url), "utf8");
    assert.ok(text.includes(diagram.source));
    assert.match(diagram.sourceSha256, /^[a-f0-9]{64}$/);
  }
});
