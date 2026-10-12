import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkConceptPrerequisites, readingUnits } from "./check_design_concepts.mjs";

const signaling = {
  id: "signaling", aliases: ["signaling", "signaling_url"], prerequisites: ["media"],
  definition: { purpose: "before.*(?:send|receive).*(?:audio|video|media)", mechanism: "exchange.*(?:settings|addresses|credentials)" },
};
const ice = {
  id: "ice", aliases: ["ICE", "ice_candidate"], prerequisites: ["signaling"],
  definition: { purpose: "select.*working.*(?:path|pair)", mechanism: "test.*(?:address|candidate).*pairs" },
};
const ledger = { assumedKnown: ["media", "HTTP"], concepts: [signaling] };
const explanation = "Signaling exchanges connection settings and network addresses before devices send audio or video. The client and media server use these messages to establish their media connection.";

test("a name, acronym expansion, link or vague setup-message gloss is not a reviewed explanation", () => {
  for (const source of ["Signaling.", "Signaling is the exchange of setup messages.", "[Signaling](https://example.org/connection-settings-before-sending-audio)"]) {
    const result = checkConceptPrerequisites(source, ledger);
    assert.equal(result.diagnostics[0]?.code, "missing-definition", source);
  }
  const result = checkConceptPrerequisites("ICE stands for Interactive Connectivity Establishment.", {assumedKnown: ["signaling"], concepts: [ice]});
  assert.equal(result.diagnostics[0]?.code, "missing-definition");
});

test("a later definition cannot repair an earlier dependent paragraph", () => {
  const result = checkConceptPrerequisites(`Signaling controls the call.\n\n${explanation}`, ledger);
  assert.equal(result.diagnostics[0]?.code, "use-before-definition");
  assert.equal(result.diagnostics[0]?.line, 1);
  assert.equal(result.observations[0]?.definitionLine, 3);
});

test("first use is checked inside both models and API blocks", () => {
  for (const [language, surface] of [["protobuf", "model"], ["yaml", "api"], ["json", "api"]]) {
    const result = checkConceptPrerequisites(`\`\`\`${language}\n  signaling_url: string\n\`\`\`\n\n${explanation}`, ledger);
    assert.equal(result.diagnostics[0]?.code, "use-before-definition");
    assert.equal(result.diagnostics[0]?.surface, surface);
    assert.equal(result.diagnostics[0]?.line, 2);
  }
});

test("visible sequence, node, edge and implicit-node labels participate in reading order", () => {
  for (const body of [
    "sequenceDiagram\n participant S as Signaling\n S-->>C: Connection settings",
    "sequenceDiagram\n signaling->>Client: Begin",
    "sequenceDiagram\n participant C as Client\n alt Signaling needed\n C->>C: Begin\n end",
    'flowchart TB\n S["Signaling"] --> C["Client"]',
    'flowchart TB\n S["Server"] -->|"Signaling"| C["Client"]',
    "flowchart TB\n A -- Signaling --> B",
    "flowchart TB\n subgraph Signaling\n A --> B\n end",
    "flowchart TB\n A & signaling --> B",
    "flowchart TB; S[Signaling] --> C[Client]",
    "flowchart TB\n signaling --> Client",
  ]) {
    const result = checkConceptPrerequisites(`\`\`\`mermaid\n${body}\n\`\`\`\n\n${explanation}`, ledger);
    assert.equal(result.diagnostics[0]?.surface, "diagram", body);
    assert.equal(result.diagnostics[0]?.code, "use-before-definition", body);
  }
});

test("a valid local definition still requires its declared prerequisites", () => {
  const result = checkConceptPrerequisites(`ICE tests candidate address pairs and selects a working media path.\n\n${explanation}`, {assumedKnown: ["media"], concepts: [signaling, ice]});
  assert.equal(result.diagnostics[0]?.code, "missing-prerequisite");
  assert.equal(result.diagnostics[0]?.concept, "ice");
  assert.match(result.diagnostics[0]?.message, /signaling/);
});

test("the first-use paragraph may contain its own explanation but a later bullet may not", () => {
  assert.deepEqual(checkConceptPrerequisites(explanation, ledger).diagnostics, []);
  const laterBullet = checkConceptPrerequisites(`- Use signaling.\n- ${explanation}`, ledger);
  assert.equal(laterBullet.diagnostics[0]?.code, "use-before-definition");
  const laterQuotedParagraph = checkConceptPrerequisites(`> Signaling controls the call.\n>\n> ${explanation}`, ledger);
  assert.equal(laterQuotedParagraph.diagnostics[0]?.code, "use-before-definition");
  const wrapped = checkConceptPrerequisites(explanation.replace("before devices", "before\ndevices"), ledger);
  assert.deepEqual(wrapped.diagnostics, []);
});

test("baseline concepts and ordered prerequisite explanations pass", () => {
  const source = `${explanation}\n\nICE tests candidate address pairs and selects a working media path.\n\n\`\`\`yaml\nsignaling_url: string\nice_candidate: object\n\`\`\`\n\n\`\`\`mermaid\nflowchart TB\n S["Signaling"] --> I["ICE checks"]\n\`\`\``;
  const result = checkConceptPrerequisites(source, {assumedKnown: ["media"], concepts: [signaling, ice]});
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.observations.length, 2);
});

test("front matter, URL targets, comments and Mermaid styling cannot introduce or use a concept", () => {
  const source = `---\ntags: [SIGNALING, CSS]\n---\n\n<!-- Signaling uses future setup settings -->\n[Read the transport specification](https://example.org/signaling/ICE)\n\n\`\`\`mermaid\n%%{init: {'fontFamily':'SIGNALING'}}%%\nflowchart TB\n A["Browser"] --> B["Server"]\nclassDef signaling fill:#e8f0fe,color:#CSS;\nstyle A fill:#CSS\n\`\`\``;
  const result = checkConceptPrerequisites(source, ledger);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.advisory, []);
  const multiline = checkConceptPrerequisites("```mermaid\n%%{init: {\n'fontFamily':'SIGNALING'\n}}%%\nflowchart TB\nA[Browser] --> B[Server]\n```", ledger);
  assert.deepEqual(multiline.diagnostics, []);
  assert.deepEqual(multiline.advisory, []);
  const hiddenParagraph = checkConceptPrerequisites(`<!--\n\n${explanation}\n\n-->\n\nSignaling carries control.`, ledger);
  assert.equal(hiddenParagraph.diagnostics[0]?.code, "missing-definition");
  const trailingComment = checkConceptPrerequisites('```mermaid\nflowchart TB\nA[Browser] --> B[Server] %% "Signaling"\n```', ledger);
  assert.deepEqual(trailingComment.diagnostics, []);
});

test("angle-bracket types remain visible in model/API blocks and inline code", () => {
  for (const source of [
    `\`\`\`protobuf\nConnection<Signaling> connection;\n\`\`\`\n\n${explanation}`,
    `The \`Connection<Signaling>\` type configures a connection.\n\n${explanation}`,
  ]) assert.equal(checkConceptPrerequisites(source, ledger).diagnostics[0]?.code, "use-before-definition");
});

test("reviewed explanatory model comments can introduce their own field", () => {
  const source = "```protobuf\nint64 assignment_epoch; // Advance on reassignment; reject older commands\n```\n\nSend assignment_epoch with control commands.";
  const result = checkConceptPrerequisites(source, {concepts: [{
    id: "assignment", aliases: ["assignment_epoch"], definitionSurfaces: ["prose", "model"],
    definition: {purpose: "reject older commands", mechanism: "advance on reassignment"},
  }]});
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.observations[0]?.surface, "model");
});

test("unregistered acronyms are advisory and do not pretend to establish full coverage", () => {
  const result = checkConceptPrerequisites("RTCP supplies receiver feedback. HTTP carries meeting creation.", {assumedKnown: ["HTTP"], concepts: []});
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.advisory.map(item => item.acronym), ["RTCP"]);
});

test("invalid ledgers and unclosed fences fail clearly", () => {
  assert.throws(() => checkConceptPrerequisites(explanation, {concepts: [signaling]}), /unknown prerequisite media/);
  assert.throws(() => checkConceptPrerequisites(explanation, {assumedKnown: ["media"], concepts: [signaling, signaling]}), /Duplicate concept/);
  assert.throws(() => readingUnits("```protobuf\nmessage Missing {"), /Unclosed code fence/);
  assert.throws(() => readingUnits("```mermaid\nclassDiagram\nclass Signaling\n```"), /Unsupported Mermaid type/);
});

test("Zoom preserves the reviewed concept prerequisite contracts", () => {
  const article = readFileSync(new URL("../_designs/system-design-video-conferencing-zoom.md", import.meta.url), "utf8");
  const zoomLedger = JSON.parse(readFileSync(new URL("./design-concepts/zoom.json", import.meta.url), "utf8"));
  assert.deepEqual(checkConceptPrerequisites(article, zoomLedger).diagnostics, []);
});

test("the CLI rejects a different article instead of silently claiming ledger coverage", () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("./check_design_concepts.mjs", import.meta.url)),
    fileURLToPath(new URL("../_designs/system-design-bitly-url-shortener.md", import.meta.url)),
    fileURLToPath(new URL("./design-concepts/zoom.json", import.meta.url)),
  ], {encoding: "utf8"});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /reviewed ledger belonging to this article/);
});
