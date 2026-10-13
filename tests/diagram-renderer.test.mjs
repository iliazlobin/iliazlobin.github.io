import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { assertGoogleDiagramStyles, collectDiagrams, extractDiagrams, thumbnailTargets } from "./render_diagrams.mjs";

const blue = "rgb(232, 240, 254)", green = "rgb(230, 244, 234)", white = "rgb(255, 255, 255)";
const appearance = (overrides = {}) => ({ nodes: [], clusters: [], actors: [], phases: [], ...overrides });
const example = source => ({ path: "_designs/example.md", index: 1, source });

test("the website hides pending source and shows a readable render failure", async () => {
  const layout = readFileSync(new URL("../_layouts/post.html", import.meta.url), "utf8");
  const script = [...layout.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(source => source.includes("import mermaid from"))
    .replace(/^\s*import .*;$/gm, "");
  const css = readFileSync(new URL("../assets/css/blog.css", import.meta.url), "utf8");
  assert.match(css, /\.post-content \.mermaid--pending\s*\{\s*visibility:\s*hidden/);
  const mounted = [];
  const blocks = ["flowchart TB\nA --> B", "invalid diagram", "flowchart TB\nC --> D"].map(textContent => ({
    textContent, querySelector: () => null, matches: () => false,
    parentNode: {replaceChild: div => mounted.push(div)},
  }));
  const createElement = () => {
    const div = {dataset: {}, attributes: {}, className: "", textContent: "",
      setAttribute(name, value) { this.attributes[name] = value; },
      querySelector() { return this.svg || null; }};
    div.classList = {remove(name) {
      div.className = div.className.split(" ").filter(token => token !== name).join(" ");
    }};
    return div;
  };
  let finishFirst;
  const firstReady = new Promise(resolve => { finishFirst = resolve; });
  let attempts = 0;
  const render = runInNewContext(`(async () => { ${script} })()`, {
    document: {createElement,
      querySelectorAll: selector => selector.includes("language-mermaid") ? blocks : mounted,
      querySelector: () => mounted[0]},
    normalizeDiagramStyles: source => source, createDiagramConfig: () => ({}),
    console: {error() {}},
    mermaid: {initialize() {}, async run({nodes: [div]}) {
      if (++attempts === 2) throw new Error("Parse failure");
      await firstReady;
      div.svg = {viewBox: {baseVal: {width: 800}}, style: {setProperty() {}}};
    }},
  });
  assert.equal(mounted.length, 3);
  for (const div of mounted) {
    assert.match(div.className, /mermaid--pending/);
    assert.equal(div.attributes["aria-busy"], "true");
  }
  finishFirst();
  await render;
  assert.ok(mounted[0].svg);
  assert.ok(mounted[2].svg, "a failed diagram must not prevent later renders");
  assert.equal(mounted[1].textContent, "Diagram unavailable. Please reload this page.");
  assert.equal(mounted[1].dataset.source, "invalid diagram");
  assert.equal(mounted[1].attributes.role, "status");
  for (const div of mounted) {
    assert.doesNotMatch(div.className, /mermaid--pending/);
    assert.equal(div.attributes["aria-busy"], "false");
  }
});

test("rendered flowcharts require pastel nodes or explicitly grouped white components", () => {
  const flow = example("flowchart TB\nA --> B");
  assertGoogleDiagramStyles(flow, appearance({nodes: [{id: "A", fills: [blue]}, {id: "B", fills: [green]}]}));
  for (const fills of [[white], ["rgb(129, 212, 250)"], []]) {
    assert.throws(() => assertGoogleDiagramStyles(flow, appearance({nodes: [{id: "A", fills}]})),
      /non-palette fill|no visible fill/);
  }
  const grouped = example("flowchart TB\nclassDef component fill:#ffffff,stroke:#9aa0a6;\nclass A component;");
  assertGoogleDiagramStyles(grouped, appearance({nodes: [{id: "A", fills: [white]}], clusters: [blue]}));
  assert.throws(() => assertGoogleDiagramStyles(grouped, appearance({nodes: [{id: "A", fills: [white]}]})), /non-palette fill/);
  assert.throws(() => assertGoogleDiagramStyles(flow, appearance({nodes: [{id: "A", fills: [white]}], clusters: [blue]})), /non-palette fill/);
});

test("rendered sequence actors and phases are checked independently", () => {
  const sequence = {...example("sequenceDiagram\nrect rgb(232,240,254)\nA->>B: Commit\nend"), systemDesign: true};
  const valid = appearance({actors: [blue, blue], phases: [green]});
  assertGoogleDiagramStyles(sequence, valid);
  for (const broken of [
    {...valid, actors: [white]}, {...valid, actors: []}, {...valid, phases: []},
    {...valid, phases: [white]}, {...valid, phases: ["rgb(129, 212, 250)"]},
  ]) assert.throws(() => assertGoogleDiagramStyles(sequence, broken));
  assertGoogleDiagramStyles(example("sequenceDiagram\nA->>B: Commit"), appearance({actors: [blue, blue]}));
});

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
  const diagram = { path: "_designs/example.md", systemDesign: true, heading: "Deep dives", source: "flowchart TB\n A --> B" };
  assert.throws(() => thumbnailTargets([diagram], "/repository"), /missing HLD/);
  assert.throws(() => thumbnailTargets([{ ...diagram, heading: "High-level design",
    thumbnail: "/images/posts/../../other.svg" }], "/repository"), /unsafe thumbnail/);
});

test("LD cards use the decision flowchart rather than its introductory sequence; tech cards are excluded", () => {
  const common = { path: "_designs/flag.md", lowLevelDesign: true,
    heading: "From flag to decision", thumbnail: "/images/posts/flag.svg" };
  const diagrams = [
    { ...common, index: 1, source: "sequenceDiagram\n A->>B: Capture" },
    { ...common, index: 2, source: "%%{init: {}}%%\nflowchart TB\n A --> B" },
    { path: "_designs/tech.md", heading: "High-level design", source: "flowchart TB\n A --> B",
      thumbnail: "/images/posts/tech.svg" },
  ];
  const targets = thumbnailTargets(diagrams, "/repository");
  assert.equal(targets.length, 1);
  assert.equal(targets[0].diagram.index, 2);
  assert.throws(() => thumbnailTargets([diagrams[0]], "/repository"), /missing HLD or decision-flow/);
});

test("LD cards prefer a component HLD when a legacy decision flow also exists", () => {
  const common = { path: "_designs/flag.md", lowLevelDesign: true,
    thumbnail: "/images/posts/flag.svg", source: "flowchart TB\n A --> B" };
  const diagrams = [
    { ...common, index: 1, heading: "From flag to decision" },
    { ...common, index: 2, heading: "High-level design" },
  ];
  assert.equal(thumbnailTargets(diagrams, "/repository")[0].diagram.index, 2);
});

test("offline collection covers every article diagram and preserves source bytes", () => {
  const root = new URL("../", import.meta.url).pathname;
  const all = collectDiagrams(root);
  const systems = collectDiagrams(root, true);
  assert.ok(all.length > systems.length);
  assert.equal(new Set(systems.map(diagram => diagram.path)).size, 47);
  assert.equal(thumbnailTargets(systems, root).length, 47);
  assert.equal(thumbnailTargets(all, root).length, 48);
  for (const diagram of systems) {
    const text = readFileSync(new URL(`../${diagram.path}`, import.meta.url), "utf8");
    assert.ok(text.includes(diagram.source));
    assert.match(diagram.sourceSha256, /^[a-f0-9]{64}$/);
  }
});
