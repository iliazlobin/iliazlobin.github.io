import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";

const root = new URL("../_designs/", import.meta.url);
// The checkout also contains user-owned duplicate exports, not canonical articles.
const designs = readdirSync(root).filter(name => name.endsWith(".md") && !name.endsWith(" 2.md"))
  .map(name => ({name, text: readFileSync(new URL(name, root), "utf8")}))
  .filter(({text}) => /^category: system-design(?:-ml)?$/m.test(text));

test("all 47 system/ML designs establish breadth before scenarios and depth", () => {
  assert.equal(designs.length, 47);
  for (const {name, text} of designs) {
    const titles = ["Problem", "Requirements", "Back-of-the-envelope calculations",
      "Core entities", "API", "High-level design", "Functional scenarios", "Deep dives"];
    const positions = titles.map(title => text.indexOf(`\n## ${title}\n`));
    assert.ok(positions.every(pos => pos >= 0), `${name}: missing top-level section`);
    assert.ok(positions.every((pos, i) => !i || pos > positions[i - 1]), `${name}: reading order`);
    assert.doesNotMatch(text, /^## (?:MVP|Open decisions|Validation)\b/m, name);
  }
});

test("functional visuals describe named workflows and retain explanations", () => {
  for (const {name, text} of designs) {
    const flows = text.split("\n## Functional scenarios\n")[1].split("\n## Deep dives\n")[0];
    assert.doesNotMatch(flows, /^### One end-to-end request\s*$/m, name);
    assert.ok((flows.match(/sequenceDiagram/g) || []).length >= 2, `${name}: distinct sequences`);
    for (const part of flows.split(/^### /m).slice(1)) {
      if (!part.includes("```mermaid")) continue;
      const prose = part.replace(/```[\s\S]*?```/g, "");
      assert.ok(prose.trim().split("\n").slice(1).join("\n").trim(), `${name}: explain the visual`);
    }
  }
});

test("deep dives expose problems, alternatives, workload choices and recovery", () => {
  for (const {name, text} of designs) {
    const deep = text.split("\n## Deep dives\n")[1];
    for (const section of deep.split(/^### /m).slice(1)) {
      const title = section.split("\n")[0];
      for (const marker of ["Problem", "Options and tradeoffs", "Choice and rationale", "Tradeoffs and recovery"]) {
        assert.match(section, new RegExp(`\\*\\*${marker}\\.`), `${name}: ${title}: ${marker}`);
      }
      assert.doesNotMatch(section, /\*\*Problem\.\*\*\s+\*\*Problem:/, `${name}: duplicate cue`);
    }
  }
});

// Structural regression checks supplement editorial review; they do not judge reasoning quality.

test("Bitly preserves one claim authority and composes freshness deadlines", () => {
  const bitly = designs.find(({name}) => name === "system-design-bitly-url-shortener.md").text;
  assert.match(bitly, /PRIMARY KEY \(domain, short_code\)/);
  assert.match(bitly, /ON CONFLICT \(domain, short_code\) DO NOTHING/);
  assert.match(bitly, /fence the old writer/);
  assert.match(bitly, /earliest of that deadline, link expiration and `last_scanned_at \+ 24h`/);
  assert.match(bitly, /old record.*cannot start another full browser TTL/);
  assert.match(bitly, /'warn'\)/);
  assert.match(bitly, /same deduplicated raw set.*newer absolute hourly total/);
  assert.doesNotMatch(bitly, /Bigtable|remain(?:s)? an open (?:choice|design choice)/);
});

test("Chess delivers accepted moves through the gateway that owns player connections", () => {
  const chess = designs.find(({name}) => name === "system-design-online-chess.md").text;
  const scenario = chess.split("\n### Accepting a move and updating both players\n")[1]
    .split("\n### ")[0];
  assert.match(scenario, /participant A as WebSocket gateway/);
  assert.match(scenario, /W-->>A:/);
  assert.match(scenario, /A-->>U:/);
  assert.match(scenario, /A-->>C:/);
  assert.doesNotMatch(scenario, /W-->>[UC]:/);
});
