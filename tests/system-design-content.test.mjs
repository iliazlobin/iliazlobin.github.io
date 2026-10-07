import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const directory = new URL("../_designs/", import.meta.url);
const articles = readdirSync(directory).filter(name => name.endsWith(".md"))
  .map(name => ({name, text: readFileSync(new URL(name, directory), "utf8")}))
  .filter(({text}) => /^category: system-design(?:-ml)?$/m.test(text));

const stripCode = text => text.replace(/```[^\n]*\n[\s\S]*?\n```/g, "");
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("all system designs explain a functional sequence in their flow section", () => {
  const errors = [];
  for (const {name, text} of articles) {
    const flow = text.match(/^## (?:From request to response|Functional scenarios|Functional flows)\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1];
    const sequence = flow && [...flow.matchAll(/```mermaid\n([\s\S]*?)\n```/g)]
      .find(match => /^sequenceDiagram\b/m.test(match[1]));
    if (!sequence) { errors.push(`${name}: missing functional sequence`); continue; }
    const explanation = stripCode(flow.slice(sequence.index + sequence[0].length).split(/^#{2,3} /m)[0]);
    if (!/^[\p{L}][^\n]+/mu.test(explanation)) errors.push(`${name}: missing explanation after sequence`);
  }
  assert.deepEqual(errors, []);
});

test("system-design Mermaid sources carry explicit Google-style groups or phases", () => {
  const errors = [];
  for (const {name, text} of articles) {
    for (const [index, match] of [...text.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].entries()) {
      const source = match[1];
      const styled = /^sequenceDiagram\b/m.test(source)
        ? /^\s*(?:box|rect)\s+rgb\(\s*(?:232,\s*240,\s*254|230,\s*244,\s*234|254,\s*247,\s*224)\s*\)/m.test(source)
        : /^\s*(?:classDef|style)\s+[^\n]+fill\s*:\s*#(?:e8f0fe|e6f4ea|fef7e0)\b/im.test(source);
      if (!styled) errors.push(`${name}: diagram ${index + 1} has no explicit palette group/phase`);
    }
  }
  assert.deepEqual(errors, []);
});

test("named technologies link to existing technology articles", () => {
  const technologies = readdirSync(directory).filter(name => name.startsWith("tech-") && name.endsWith(".md"))
    .map(name => {
      const title = readFileSync(new URL(name, directory), "utf8").match(/^title:\s*"TECH: ([^"]+)"$/m)?.[1];
      const terms = title?.replace(/^Apache /, "").split(" / ") || [];
      if (title === "PostgreSQL") terms.push("Postgres");
      return {name, terms};
    });
  const errors = [];
  for (const {name, text} of articles) {
    const prose = stripCode(text.split(/^---\s*$/m).slice(2).join("\n"));
    for (const technology of technologies) {
      if (technology.terms.some(term => new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(prose))) {
        const route = `/designs/${technology.name.slice(0, -3)}/`;
        if (!prose.includes(`](${route})`) && !prose.includes(`](${route}#`)) {
          errors.push(`${name}: ${technology.terms.join("/")} needs ${route}`);
        }
      }
    }
  }
  assert.deepEqual(errors, []);
});

test("system designs use the reviewed Notion structure and source provenance", () => {
  assert.ok(articles.length > 0);
  assert.ok(articles.some(({name}) => name === "system-design-chatgpt.md"));
  const sources = new Set();
  for (const {name, text} of articles) {
    const source = text.match(/^notion_source: https:\/\/app\.notion\.com\/p\/([a-f0-9]{32})$/m)?.[1];
    assert.ok(source, `${name}: missing canonical source`);
    assert.ok(!sources.has(source), `${name}: source already has a website page`);
    sources.add(source);
    assert.match(text, /^last_modified_at: \d{4}-\d{2}-\d{2}$/m, name);
    for (const heading of ["Problem", "Requirements", "Back-of-the-envelope calculations", "Core entities", "High-level design", "Deep dives"]) {
      assert.ok(text.includes("\n## " + heading + "\n"), `${name}: missing ${heading}`);
    }
    assert.doesNotMatch(text, /^#{2,3} \d+[.)]|^mvp_repo:|^#{2,3} .*MVP/mi, name);
    assert.doesNotMatch(text, /discussion:\/\/|<mention-page|<table_of_contents|<empty-block|<span discussion-urls/, name);
    const deepDives = text.split("\n## Deep dives\n")[1];
    assert.match(deepDives, /^### /m, name);
    assert.match(deepDives, /^\*\*.+\*\*/m, name);
    assert.match(deepDives, /^(?:- |\| |\*\*Options\.)/m, name);
  }
});

test("data models stay compact and use Protobuf highlighting", () => {
  for (const {name, text} of articles) {
    const models = [...text.matchAll(/```protobuf\n([\s\S]*?)\n```/g)];
    assert.ok(models.length > 0, `${name}: missing Protobuf models`);
    for (const [, model] of models) {
      assert.match(model, /message \w+ \{/, name);
      assert.doesNotMatch(model, /^\s*\w+[^\n;]*=\s*\d+\s*;/m, `${name}: field numbers add noise`);
    }
  }
});
