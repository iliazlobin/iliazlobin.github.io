import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import test from "node:test";

const directory = new URL("../_designs/", import.meta.url);
const articles = readdirSync(directory)
  .filter(name => name.endsWith(".md") && !name.endsWith(" 2.md"))
  .map(name => ({name, text: readFileSync(new URL(name, directory), "utf8")}));

function proseLines(text) {
  let fence = null;
  const lines = [];
  for (const line of text.split("\n")) {
    if (fence) {
      const closing = line.match(/^\s{0,3}(`+|~+)\s*$/)?.[1];
      if (closing?.[0] === fence[0] && closing.length >= fence.length) fence = null;
      continue;
    }
    const opening = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1];
    if (opening) { fence = opening; continue; }
    lines.push(line);
  }
  return lines;
}

function deepDiveHeadings(text) {
  let inDeepDives = false;
  const headings = [];
  for (const line of proseLines(text)) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const title = match[2].replace(/\s+\{#[^}]+\}$/, "");
    if (level <= 2) inDeepDives = level === 2 && title === "Deep dives";
    else if (inDeepDives) headings.push(title);
  }
  return headings;
}

test("deep-dive topics are declarative across the entire design corpus", () => {
  assert.equal(articles.length, 72);
  for (const {name, text} of articles) {
    for (const title of deepDiveHeadings(text)) {
      assert.doesNotMatch(title, /\?/, `${name}: ${title}`);
      assert.doesNotMatch(title, /^(?:how|what|which|when|where|why|who|can|could|should|would|do|does|did|is|are|will)\b/i,
        `${name}: use a topic heading, not an interview question: ${title}`);
    }
  }
});

test("topic checks exclude code, explanations, later sections and legacy fragments", () => {
  const text = ["## Deep dives", "### Stable rollout assignments {#how-do-rollouts-stay-stable}",
    "Why does this matter?", "```markdown", "### How does this example work?", "```",
    "~~~text", "### What is this example?", "~~~", "#### Failure recovery",
    "## Key implementation", "### How do I run the example?"].join("\n");
  assert.deepEqual(deepDiveHeadings(text), ["Stable rollout assignments", "Failure recovery"]);
});

test("every design, infrastructure and technology article uses unnumbered headings", () => {
  assert.equal(articles.length, 72);
  for (const {name, text} of articles) {
    const prose = proseLines(text).join("\n");
    assert.doesNotMatch(prose, /^#{1,6}\s+(?:\d+(?:\.\d+)*[.)]\s+|D\d+:\s+)/m, name);
    assert.doesNotMatch(prose, /\*\*(?:Options and trade-?offs|Choice and rationale)\.\*\*/, name);
  }
});

test("numeric-leading legacy IDs remain explicit without leaking into heading text", () => {
  const mainSections = ["1-context", "2-goals", "3-architecture", "4-reliability", "5-security",
    "6-scalability--performance", "7-cost", "8-operations", "9-key-decisions--trade-offs", "10-references"];
  const infrastructure = articles.filter(({name}) => name.startsWith("infra-"));
  assert.equal(infrastructure.length, 6);
  for (const {name, text} of infrastructure) {
    for (const id of mainSections) {
      assert.ok(text.includes(`\n{: id="${id}"}\n`), `${name}: preserve #${id}`);
    }
    assert.doesNotMatch(text, /^#{1,6} .+ \{#\d/m, `${name}: Kramdown shorthand does not accept a numeric ID`);
  }
  const cassandra = articles.find(({name}) => name === "tech-apache-cassandra.md").text;
  for (const id of ["1-time-series--metrics", "2-feeds--messaging", "3-iot--sensors", "4-shopping-carts--sessions"]) {
    assert.ok(cassandra.includes(`\n{: id="${id}"}\n`), `Cassandra: preserve #${id}`);
  }
});

test("substantive numbers, code examples and named decision destinations are retained", () => {
  const strava = articles.find(({name}) => name === "infra-strava-on-aws.md").text;
  assert.match(strava, /^# modules\/eks\/main\.tf/m);
  assert.match(strava, /### Cassandra 5\.0 vs ScyllaDB .*\{#d3-cassandra-50-vs-scylladb-for-the-activity-data-store\}/);
  const bitly = articles.find(({name}) => name === "infra-bitly-url-shortener-on-aws.md").text;
  assert.match(bitly, /^### 4-layer cache pyramid vs 3-layer \(skip in-process LRU\) \{#d3-/m);
  assert.match(bitly, /^1\. \[AWS CloudFront pricing/m);
  const uber = articles.find(({name}) => name === "infra-uber-ride-hailing-platform-on-aws-and-gcp.md").text;
  const decision = "d1-self-hosted-redis-cluster-vs-elasticache-vs-dragonfly-for-driver-location";
  assert.ok(uber.includes(`{#${decision}}`));
  assert.equal(uber.split(`](#${decision})`).length - 1, 2);
  assert.doesNotMatch(uber, /\bD1 in section 9\b/);
});
