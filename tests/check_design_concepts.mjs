// Ordered, reviewer-authored concept contracts; not a semantic/readability evaluator.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const aliasPattern = aliases => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${aliases.map(escapeRegex).sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}\\p{N}_])`, "iu");
const cleanVisibleText = (text, markup = true) => {
  const codeSpans = [];
  if (markup) text = text.replace(/(`+)([\s\S]*?)\1/g, (_, ticks, code) => {
    codeSpans.push(code);
    return `\0${codeSpans.length - 1}\0`;
  });
  return (markup ? text
  .replace(/!?\[([^\]\n]+)\]\((?:[^()\n]|\([^()\n]*\))*\)/g, "$1")
  .replace(/^\s*\[[^\]]+\]:[^\n]*/gm, "")
  .replace(/\[([^\]\n]+)\]\[[^\]\n]*\]/g, "$1")
  .replace(/<br\s*\/?\s*>/gi, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/[`*~]/g, "")
  .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1") : text)
  .replace(/\0(\d+)\0/g, (_, index) => codeSpans[Number(index)])
  .replace(/https?:\/\/[^\s<>]+/g, "");
};

// Mask complete prose comments before paragraph segmentation; code comments remain
// visible. Retaining newlines keeps diagnostics tied to the original source.
function maskMarkdownComments(markdown) {
  let comment = false, fence = null;
  return markdown.split("\n").map(line => {
    if (fence) {
      if (fence.test(line.replace(/^(?:\s*>\s?)+/, ""))) fence = null;
      return line;
    }
    const opener = line.replace(/^(?:\s*>\s?)+/, "").match(/^\s*(`{3,}|~{3,})/);
    if (!comment && opener) {
      fence = new RegExp(`^\\s*${opener[1][0]}{${opener[1].length},}\\s*$`);
      return line;
    }
    let offset = 0, visible = "";
    while (offset < line.length) {
      const boundary = line.indexOf(comment ? "-->" : "<!--", offset);
      if (boundary === -1) {
        visible += comment ? " ".repeat(line.length - offset) : line.slice(offset);
        break;
      }
      if (comment) {
        visible += " ".repeat(boundary + 3 - offset);
        offset = boundary + 3;
        comment = false;
      } else {
        visible += line.slice(offset, boundary) + "    ";
        offset = boundary + 4;
        comment = true;
      }
    }
    return visible;
  }).join("\n");
}

// Only this explicit Mermaid subset is scanned. Unknown statements fail closed;
// rendering/grammar validation remains the separate Mermaid renderer's job.
function mermaidStatements(raw, line) {
  const statements = [];
  let start = 0, quoted = false, depth = 0;
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];
    if (char === '"' && raw[index - 1] !== "\\") quoted = !quoted;
    if (quoted) continue;
    if (raw.slice(index, index + 2) === "%%") {
      statements.push(raw.slice(start, index).trim());
      return statements.filter(Boolean);
    }
    if ("[({".includes(char)) depth++;
    if ("])}".includes(char)) depth--;
    if (char === ";" && depth === 0) {
      statements.push(raw.slice(start, index).trim());
      start = index + 1;
    }
  }
  // Brackets and quotes can be literal message text in a sequence diagram;
  // flow-node delimiters are validated by flowNodes rather than this splitter.
  statements.push(raw.slice(start).trim());
  return statements.filter(Boolean);
}

function flowNodes(statement, fail, label) {
  const nodes = [];
  let offset = 0;
  const space = () => { while (/\s/.test(statement[offset] || "") && offset < statement.length) offset++; };
  const node = () => {
    space();
    const id = statement.slice(offset).match(/^[\w-]+/)?.[0];
    if (!id) fail();
    offset += id.length;
    space();
    let text;
    if ("[({".includes(statement[offset] || "\0")) {
      const start = offset++, stack = [statement[start]], matching = { "]": "[", ")": "(", "}": "{" };
      let quoted = false;
      while (offset < statement.length && stack.length) {
        const char = statement[offset++];
        if (char === '"' && statement[offset - 2] !== "\\") quoted = !quoted;
        if (quoted) continue;
        if ("[({".includes(char)) stack.push(char);
        if (matching[char] && stack.pop() !== matching[char]) fail();
      }
      if (stack.length || quoted) fail();
      text = statement.slice(start + 1, offset - 1);
    }
    const style = statement.slice(offset).match(/^:::[\w,-]+/);
    if (style) offset += style[0].length;
    nodes.push({ id, label: text });
    space();
  };
  const group = () => {
    node();
    while (statement[offset] === "&") { offset++; node(); }
  };
  group();
  while (offset < statement.length) {
    const remaining = statement.slice(offset);
    const textualEdge = remaining.match(/^(?:--\s+(.+?)\s+--+>|-\.\s+(.+?)\s+\.->|==\s+(.+?)\s+==+>)/);
    if (textualEdge) {
      label(textualEdge.slice(1).find(Boolean));
      offset += textualEdge[0].length;
    } else {
      const arrow = remaining.match(/^(?:[<ox]?[-.=~]{2,}[>ox]?)/)?.[0];
      if (!arrow) fail();
      offset += arrow.length;
      space();
      if (statement[offset] === "|") {
        const start = ++offset;
        let quoted = false;
        while (offset < statement.length) {
          const char = statement[offset];
          if (char === '"' && statement[offset - 1] !== "\\") quoted = !quoted;
          if (char === "|" && !quoted) break;
          offset++;
        }
        if (offset === statement.length) fail();
        label(statement.slice(start, offset++));
      }
    }
    group();
  }
  return nodes;
}

function diagramLabels(lines, firstLine) {
  const events = [], names = new Map(), statements = [];
  let directive = false;
  for (const [index, raw] of lines.entries()) {
    const text = raw.trim();
    if (directive || /^%%\{/.test(text)) {
      directive = !/\}%%\s*$/.test(text);
      continue;
    }
    for (const statement of mermaidStatements(raw, firstLine + index)) statements.push({ text: statement, line: firstLine + index });
  }
  if (directive) throw new Error(`Unclosed Mermaid directive at line ${firstLine}`);
  const header = statements.shift()?.text || "";
  const flow = /^(?:flowchart|graph)\s+(?:TB|TD|BT|LR|RL)$/.test(header);
  if (!flow && header !== "sequenceDiagram") throw new Error(`Unsupported Mermaid type at line ${firstLine}; extend the label scanner before registering this design`);
  for (const {text, line} of statements) {
    const fail = () => { throw new Error(`Unsupported Mermaid statement at line ${line}: ${text}; extend the label scanner before registering this design`); };
    const label = value => events.push({ text: value, line });
    const actor = id => events.push({ id, line });
    if (text === "end") continue;
    if (flow) {
      if (/^(?:classDef\s+\S+\s+.+|class\s+\S+\s+\S+|style\s+\S+\s+.+|linkStyle\s+\S+\s+.+|direction\s+(?:TB|TD|BT|LR|RL)|click\s+\S+\s+.+)$/.test(text)) continue;
      const subgraph = text.match(/^subgraph\s+(.+)$/);
      if (subgraph) {
        if (/^[\w-]+\s*[\[({]/.test(subgraph[1])) {
          const group = flowNodes(subgraph[1], fail, label);
          if (group.length !== 1) fail();
          names.set(group[0].id, group[0].label);
          actor(group[0].id);
        } else label(subgraph[1]);
        continue;
      }
      for (const node of flowNodes(text, fail, label)) {
        if (node.label !== undefined) names.set(node.id, node.label);
        actor(node.id);
      }
      continue;
    }
    const participant = text.match(/^(?:participant|actor)\s+([\w-]+)(?:\s+as\s+(.+))?$/);
    if (participant) { names.set(participant[1], participant[2] || participant[1]); actor(participant[1]); continue; }
    const message = text.match(/^([\w-]+)\s*[-<>=.]+[x)]?\s*[+-]?([\w-]+)\s*:\s*(.*)$/);
    if (message) { actor(message[1]); actor(message[2]); label(message[3]); continue; }
    const note = text.match(/^Note\s+(?:over|left of|right of)\s+([\w,-]+)\s*:\s*(.*)$/i);
    if (note) { note[1].split(",").forEach(actor); label(note[2]); continue; }
    const control = text.match(/^(?:alt|else|opt|loop|par|and|critical|option|break)(?:\s+(.+))?$/);
    if (control) { if (control[1]) label(control[1]); continue; }
    const band = text.match(/^(rect|box)\s+(.+)$/);
    if (band) {
      const remainder = band[2].replace(/^(?:rgba?\([^)]*\)|#[\da-f]{3,8}|transparent|red|green|blue|purple|white|black)(?:\s+|$)/i, "");
      if (band[1] === "rect") { if (remainder || remainder === band[2]) fail(); }
      else if (remainder) label(remainder);
      continue;
    }
    const activation = text.match(/^(?:activate|deactivate)\s+([\w-]+)$/);
    if (activation) { actor(activation[1]); continue; }
    if (/^autonumber(?:\s+\d+(?:\s+\d+)?)?$/.test(text)) continue;
    fail();
  }
  return events.map(event => ({ text: cleanVisibleText(event.text ?? names.get(event.id) ?? event.id), line: event.line, surface: "diagram" })).filter(unit => unit.text.trim());
}

export function readingUnits(markdown) {
  const lines = maskMarkdownComments(markdown.replace(/\r\n/g, "\n")).split("\n"), units = [];
  let index = 0, paragraph = [], paragraphLine = 1;
  let paragraphQuoteDepth = 0;
  if (lines[0] === "---") {
    index = lines.indexOf("---", 1);
    if (index === -1) throw new Error("Unclosed front matter");
    index++;
  }
  const flush = () => {
    if (paragraph.length) units.push({ text: cleanVisibleText(paragraph.join("\n")), line: paragraphLine, surface: "prose" });
    paragraph = [];
  };
  while (index < lines.length) {
    const quotePrefix = lines[index].match(/^(?:\s*>\s?)+/)?.[0] || "";
    const quoteDepth = (quotePrefix.match(/>/g) || []).length;
    const line = lines[index].slice(quotePrefix.length), fence = line.match(/^\s*(`{3,}|~{3,})\s*(\S*)[^\n]*$/);
    if (paragraph.length && quoteDepth !== paragraphQuoteDepth) flush();
    if (fence) {
      flush();
      const start = ++index, body = [], closing = new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`);
      while (index < lines.length) {
        const bodyLine = lines[index].replace(/^(?:\s*>\s?)+/, "");
        if (closing.test(bodyLine)) break;
        body.push(bodyLine); index++;
      }
      if (index === lines.length) throw new Error(`Unclosed code fence at line ${start}`);
      const language = fence[2].toLowerCase();
      if (language === "mermaid") units.push(...diagramLabels(body, start + 1));
      else body.forEach((text, offset) => units.push({
        text: cleanVisibleText(text, false), line: start + offset + 1,
        surface: language === "protobuf" ? "model" : ["yaml", "json", "http"].includes(language) ? "api" : "code",
      }));
      index++;
      continue;
    }
    if (!line.trim()) flush();
    else if (/^\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|\|)/.test(line)) {
      flush(); paragraphLine = index + 1; paragraphQuoteDepth = quoteDepth; paragraph.push(line);
      if (/^\s*(?:#{1,6}\s|\|)/.test(line)) flush();
    } else {
      if (!paragraph.length) { paragraphLine = index + 1; paragraphQuoteDepth = quoteDepth; }
      paragraph.push(line);
    }
    index++;
  }
  flush();
  return units.filter(unit => unit.text.trim());
}

export function checkConceptPrerequisites(markdown, ledger) {
  const units = readingUnits(markdown), concepts = ledger.concepts || [];
  const assumedKnown = new Set(ledger.assumedKnown || []);
  const ids = new Set(concepts.map(concept => concept.id));
  if (ids.size !== concepts.length) throw new Error("Duplicate concept IDs");
  const contracts = concepts.map(concept => {
    if (!concept.id || !concept.aliases?.length || !concept.definition?.purpose || !concept.definition?.mechanism) throw new Error("Each concept needs an ID, aliases and reviewed purpose/mechanism signatures");
    if (concept.introduction && (!concept.introduction.purpose || !concept.introduction.meaning)) throw new Error(`${concept.id}: a brief introduction needs reviewed purpose/meaning signatures`);
    for (const prerequisite of [...(concept.prerequisites || []), ...(concept.introduction?.prerequisites || [])]) {
      if (!ids.has(prerequisite) && !assumedKnown.has(prerequisite)) throw new Error(`${concept.id}: unknown prerequisite ${prerequisite}`);
    }
    return { ...concept, pattern: aliasPattern(concept.aliases),
      signatures: Object.entries(concept.definition).map(([name, pattern]) => [name, new RegExp(pattern, "iu")]),
      introductionSignatures: concept.introduction ? ["purpose", "meaning"].map(name => [name, new RegExp(concept.introduction[name], "iu")]) : [],
    };
  });
  const diagnostics = [], introduced = new Set(assumedKnown), defined = new Set(), recorded = new Set(), observations = [];
  const isDefinition = (concept, unit) => (concept.definitionSurfaces || ["prose"]).includes(unit.surface)
    && concept.pattern.test(unit.text) && concept.signatures.every(([, pattern]) => pattern.test(unit.text.replace(/\s+/g, " ")));
  const isIntroduction = (concept, unit) => concept.introductionSignatures.length
    && (concept.introductionSurfaces || ["prose"]).includes(unit.surface)
    && concept.pattern.test(unit.text) && concept.introductionSignatures.every(([, pattern]) => pattern.test(unit.text.replace(/\s+/g, " ")));
  const isExplanation = (concept, unit) => isDefinition(concept, unit) || isIntroduction(concept, unit);
  const introductionPrerequisites = concept => concept.introduction?.prerequisites ?? concept.prerequisites ?? [];
  const readyForIntroduction = (concept, unit) =>
    (isDefinition(concept, unit) && (concept.prerequisites || []).every(id => introduced.has(id)))
    || (isIntroduction(concept, unit) && introductionPrerequisites(concept).every(id => introduced.has(id)));
  for (const [index, unit] of units.entries()) {
    const uses = contracts.filter(concept => concept.pattern.test(unit.text));
    // A concise purpose/meaning introduction may establish a prerequisite without
    // putting its full mechanism in an overview. Full detail is checked separately.
    // Same-paragraph prerequisites must satisfy their own reviewed contracts.
    const pending = uses.filter(concept => !introduced.has(concept.id) && isExplanation(concept, unit));
    let changed = true;
    while (changed) {
      changed = false;
      for (const concept of pending) {
        if (!introduced.has(concept.id) && readyForIntroduction(concept, unit)) {
          introduced.add(concept.id);
          observations.push({ concept: concept.id, introductionLine: unit.line,
            definitionLine: isDefinition(concept, unit) && (concept.prerequisites || []).every(id => introduced.has(id)) ? unit.line : null, surface: unit.surface });
          changed = true;
        }
      }
    }
    for (const concept of uses) {
      if (isDefinition(concept, unit) && (concept.prerequisites || []).every(id => introduced.has(id))) {
        defined.add(concept.id);
        const observation = observations.find(item => item.concept === concept.id);
        if (observation && observation.definitionLine === null) observation.definitionLine = unit.line;
      } else if (isDefinition(concept, unit) && introduced.has(concept.id) && !recorded.has(concept.id)) {
        recorded.add(concept.id);
        const missing = (concept.prerequisites || []).filter(id => !introduced.has(id));
        diagnostics.push({ code: "missing-prerequisite", concept: concept.id, line: unit.line, surface: unit.surface,
          message: `Explain ${missing.join(", ")} before the detailed ${concept.id} mechanism.` });
      }
    }
    for (const concept of uses) {
      if (introduced.has(concept.id) || recorded.has(concept.id)) continue;
      recorded.add(concept.id);
      const match = concept.pattern.exec(unit.text);
      const line = unit.line + unit.text.slice(0, match.index).split("\n").length - 1;
      const missing = (isIntroduction(concept, unit) ? introductionPrerequisites(concept) : concept.prerequisites || []).filter(id => !introduced.has(id));
      const future = units.slice(index + 1).find(candidate => isExplanation(concept, candidate));
      const code = isExplanation(concept, unit) && missing.length ? "missing-prerequisite" : future ? "use-before-definition" : "missing-definition";
      const message = code === "missing-prerequisite" ? `Introduce ${missing.join(", ")} before ${concept.id}.`
        : future ? `${concept.id} is used before its reviewed explanation at line ${future.line}.`
          : `${concept.id} needs a reviewed purpose/meaning introduction or full definition; a name or link alone is insufficient.`;
      diagnostics.push({ code, concept: concept.id, line, surface: unit.surface, message });
    }
  }
  for (const concept of contracts) {
    if (!introduced.has(concept.id) || defined.has(concept.id) || recorded.has(concept.id)) continue;
    const observation = observations.find(item => item.concept === concept.id);
    if (!observation) continue;
    diagnostics.push({ code: "missing-definition", concept: concept.id, line: observation.introductionLine, surface: observation.surface,
      message: `${concept.id} has a brief introduction but still needs its reviewed purpose/mechanism explanation in the owning functional flow or deep dive.` });
  }
  const registered = new Set([...assumedKnown, ...contracts.flatMap(concept => concept.aliases)].map(alias => alias.toUpperCase()));
  const advisory = [], seenAcronyms = new Set();
  for (const unit of units) {
    for (const match of unit.text.matchAll(/\b[A-Z][A-Z0-9]{1,7}\b/g)) {
      const acronym = match[0];
      if (registered.has(acronym) || seenAcronyms.has(acronym)) continue;
      seenAcronyms.add(acronym);
      advisory.push({ acronym, line: unit.line, surface: unit.surface, message: "Unregistered acronym: confirm reader baseline or add a reviewed concept contract." });
    }
  }
  return { diagnostics, advisory, observations, reviewedConcepts: contracts.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [articlePath, ledgerPath] = process.argv.slice(2);
  if (!articlePath || !ledgerPath) throw new Error("Usage: node tests/check_design_concepts.mjs ARTICLE.md LEDGER.json");
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (!ledger.article || resolve(articlePath) !== resolve(repositoryRoot, ledger.article)) throw new Error("Use the reviewed ledger belonging to this article; ledger.article is relative to the repository root");
  const result = checkConceptPrerequisites(readFileSync(articlePath, "utf8"), ledger);
  for (const diagnostic of result.diagnostics) console.error(`${articlePath}:${diagnostic.line} [${diagnostic.surface}/${diagnostic.code}] ${diagnostic.message}`);
  for (const item of result.advisory) console.log(`${articlePath}:${item.line} [advisory/${item.surface}] ${item.acronym}: ${item.message}`);
  console.log(`Checked ${result.reviewedConcepts} registered concepts; ${result.diagnostics.length} prerequisite errors, ${result.advisory.length} manual-review advisories. Editorial review is still required.`);
  process.exitCode = result.diagnostics.length ? 1 : 0;
}
