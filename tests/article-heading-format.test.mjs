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
