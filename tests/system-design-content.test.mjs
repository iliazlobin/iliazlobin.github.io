import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const directory = new URL("../_designs/", import.meta.url);
const articles = readdirSync(directory).filter(name => name.endsWith(".md"))
  .map(name => ({name, text: readFileSync(new URL(name, directory), "utf8")}))
  .filter(({text}) => /^category: system-design(?:-ml)?$/m.test(text));

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
