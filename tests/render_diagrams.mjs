// Offline Mermaid verification. No source edits; --thumbnails updates SD/LD card SVGs.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MERMAID_VERSION, createDiagramConfig, normalizeDiagramStyles } from "../assets/js/diagram-palette.mjs";

const compactColor = color => color.toLowerCase().replace(/\s+/g, "");
const googleFills = new Set([
  "rgb(232,240,254)", "rgb(230,244,234)", "rgb(254,247,224)",
  "rgb(254,239,227)", "rgb(252,232,230)", "rgb(243,232,253)",
  "rgb(228,247,251)", "rgb(241,243,244)",
]);
const isWhiteStyle = styles =>
  /(?:^|,)\s*fill\s*:\s*(?:#fff(?:fff)?|white)\s*(?=[,;]|$)/i.test(styles);

function explicitlyWhiteNodes(source) {
  const classes = new Set(), nodes = new Set();
  for (const [, names, styles] of source.matchAll(/^\s*classDef\s+(\S+)\s+([^\n]+)/gm)) {
    if (isWhiteStyle(styles)) names.split(",").forEach(name => classes.add(name));
  }
  for (const [, ids, names] of source.matchAll(/^\s*class\s+([^\s;]+)\s+([^\s;]+)/gm)) {
    if (names.split(",").some(name => classes.has(name))) ids.split(",").forEach(id => nodes.add(id));
  }
  for (const [, id, styles] of source.matchAll(/^\s*style\s+(\S+)\s+([^\n]+)/gm)) {
    if (isWhiteStyle(styles)) nodes.add(id);
  }
  return nodes;
}

export function assertGoogleDiagramStyles(diagram, appearance) {
  const fail = message => { throw new Error(`${diagram.path} diagram ${diagram.index}: ${message}`); };
  const checkFills = (fills, kind) => {
    for (const fill of fills) {
      if (!googleFills.has(compactColor(fill))) fail(`${kind} has non-palette fill ${fill}`);
    }
  };
  if (/^(?:flowchart|graph)\b/m.test(diagram.source)) {
    if (!appearance.nodes.length) fail("no rendered flowchart nodes");
    checkFills(appearance.clusters, "cluster");
    const whiteNodes = explicitlyWhiteNodes(diagram.source);
    for (const node of appearance.nodes) {
      if (!node.fills.length) fail(`node ${node.id} has no visible fill`);
      for (const fill of node.fills) {
        // White components are intentional only in explicitly styled, grouped diagrams.
        if (compactColor(fill) === "rgb(255,255,255)"
          && whiteNodes.has(node.id) && appearance.clusters.length) continue;
        checkFills([fill], `node ${node.id}`);
      }
    }
  } else if (/^sequenceDiagram\b/m.test(diagram.source)) {
    if (!appearance.actors.length) fail("no rendered sequence actors");
    checkFills(appearance.actors, "actor");
    checkFills(appearance.phases, "phase");
    const bands = [...diagram.source.matchAll(/^\s*(?:rect|box)\s+rgb\(/gm)].length;
    const minimum = Math.max(bands, diagram.systemDesign || diagram.lowLevelDesign ? 1 : 0);
    if (appearance.phases.length < minimum) fail(`missing sequence phases: expected ${minimum}, rendered ${appearance.phases.length}`);
  } else fail("unsupported diagram type");
}

export function extractDiagrams(text) {
  return [...text.matchAll(/```mermaid\r?\n([\s\S]*?)\r?\n```/g)].map(match => ({
    source: match[1],
    heading: [...text.slice(0, match.index).matchAll(/^##\s+(.+)$/gm)].at(-1)?.[1] || "",
  }));
}

export function collectDiagrams(root, systemDesignsOnly = false) {
  const diagrams = [];
  for (const directory of ["_designs", "_posts"]) {
    if (!existsSync(join(root, directory))) continue;
    for (const name of readdirSync(join(root, directory)).filter(name => name.endsWith(".md")).sort()) {
      const path = `${directory}/${name}`;
      const text = readFileSync(join(root, path), "utf8");
      const systemDesign = /^category: system-design(?:-ml)?\r?$/m.test(text);
      const lowLevelDesign = /^category: low-level-design\r?$/m.test(text);
      if (systemDesignsOnly && !systemDesign) continue;
      const thumbnail = text.match(/^thumbnail:\s*["']?(\/images\/posts\/[^\s"']+\.svg)["']?\s*$/m)?.[1];
      for (const [index, diagram] of extractDiagrams(text).entries()) {
        diagrams.push({
          ...diagram, path, index: index + 1, systemDesign, lowLevelDesign, thumbnail,
          sourceSha256: createHash("sha256").update(diagram.source).digest("hex"),
        });
      }
    }
  }
  return diagrams;
}

export function thumbnailTargets(diagrams, root) {
  const paths = [...new Set(diagrams.filter(diagram => diagram.systemDesign || diagram.lowLevelDesign).map(diagram => diagram.path))];
  return paths.map(path => {
    const lowLevelDesign = diagrams.find(diagram => diagram.path === path).lowLevelDesign;
    const heading = lowLevelDesign ? /^From .+ to .+$/i : /^High-level design$/i;
    const diagram = diagrams.find(diagram => diagram.path === path && heading.test(diagram.heading)
      && /^(?:flowchart|graph)\s/m.test(diagram.source));
    if (!diagram) throw new Error(`${path}: missing ${lowLevelDesign ? "decision-flow" : "HLD"} Mermaid flowchart`);
    if (!diagram.thumbnail || !/^\/images\/posts\/[a-zA-Z0-9_-]+\.svg$/.test(diagram.thumbnail)) {
      throw new Error(`${path}: missing or unsafe thumbnail path`);
    }
    return { diagram, destination: join(root, diagram.thumbnail.slice(1)) };
  });
}

async function inspectRenderedSvgs(cli, outputDirectory, diagrams, browserPath) {
  const require = createRequire(resolve(dirname(cli), "../package.json"));
  const { default: puppeteer } = await import(pathToFileURL(require.resolve("puppeteer")).href);
  const browser = await puppeteer.launch(browserPath ? { executablePath: browserPath } : {});
  try {
    const page = await browser.newPage();
    // Generated SVGs are local artifacts. No network images/fonts/scripts are permitted.
    await page.setRequestInterception(true);
    page.on("request", request => request.url().startsWith("file:") || request.url().startsWith("data:")
      ? request.continue() : request.abort());
    for (const diagram of diagrams) {
      const svgPath = join(outputDirectory, diagram.svg);
      const svg = readFileSync(svgPath, "utf8");
      if (!/<svg\b/.test(svg) || /Syntax error in text/.test(svg)) {
        throw new Error(`${diagram.path} diagram ${diagram.index}: invalid SVG`);
      }
      await page.goto(pathToFileURL(svgPath).href);
      diagram.renderedAppearance = await page.evaluate(() => {
        const fills = elements => [...elements].filter(element => {
          const style = getComputedStyle(element), bounds = element.getBBox();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0
            && bounds.width > 0 && bounds.height > 0 && style.fill !== "none" && style.fill !== "transparent"
            && !/rgba\([^)]*,\s*0\)$/.test(style.fill);
        }).map(element => getComputedStyle(element).fill);
        return {
          nodes: [...document.querySelectorAll(".node")].map(node => ({
            id: node.id.replace(/^.*?flowchart-(.*)-\d+$/, "$1"),
            fills: fills(node.querySelectorAll("rect, polygon, path, circle, ellipse")),
          })),
          clusters: fills(document.querySelectorAll(".cluster rect")),
          actors: fills(document.querySelectorAll("rect.actor")),
          phases: fills(document.querySelectorAll("rect.rect, rect.box")),
        };
      });
      assertGoogleDiagramStyles(diagram, diagram.renderedAppearance);
      diagram.renderedFills = await page.evaluate(() => [...new Set([...document.querySelectorAll(
        ".node rect, .node polygon, .node path, .node circle, .node ellipse, .cluster rect, rect.actor, rect.rect, rect.box",
      )].map(node => getComputedStyle(node).fill))].sort());
      diagram.renderedFonts = await page.evaluate(() => [...new Set([...document.querySelectorAll(
        ".nodeLabel, .cluster-label, .edgeLabel, .messageText, text.actor",
      )].map(node => getComputedStyle(node).fontFamily))].sort());
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  let cli, browserPath;
  let root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let systemDesignsOnly = false, thumbnails = false;
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    if (["--cli", "--browser", "--root"].includes(option)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`${option} needs a path`);
      if (option === "--cli") cli = resolve(value);
      if (option === "--browser") browserPath = resolve(value);
      if (option === "--root") root = resolve(value);
    } else if (option === "--system-designs") systemDesignsOnly = true;
    else if (option === "--thumbnails") thumbnails = true;
    else throw new Error(`Unknown option ${option}`);
  }
  if (!cli) throw new Error("Usage: node tests/render_diagrams.mjs --cli /installed/mermaid-cli/src/cli.js [--browser /installed/chrome] [--system-designs] [--thumbnails]");
  const packageJson = JSON.parse(readFileSync(resolve(dirname(cli), "../package.json"), "utf8"));
  if (packageJson.name !== "@mermaid-js/mermaid-cli" || packageJson.version !== MERMAID_VERSION) {
    throw new Error(`Use installed @mermaid-js/mermaid-cli ${MERMAID_VERSION}; no downloads are performed`);
  }
  const require = createRequire(resolve(dirname(cli), "../package.json"));
  const rendererPackage = JSON.parse(readFileSync(require.resolve("mermaid/package.json"), "utf8"));
  if (rendererPackage.version !== MERMAID_VERSION) throw new Error(`CLI Mermaid dependency must also be ${MERMAID_VERSION}`);
  const diagrams = collectDiagrams(root, systemDesignsOnly);
  if (!diagrams.length) throw new Error("No Mermaid diagrams found");
  const targets = thumbnails ? thumbnailTargets(diagrams, root) : [];
  if (new Set(targets.map(target => target.destination)).size !== targets.length) {
    throw new Error("Two designs share a thumbnail destination");
  }
  const outputDirectory = mkdtempSync(join(tmpdir(), "site-diagrams-"));
  const input = join(outputDirectory, "diagrams.md");
  const output = join(outputDirectory, "rendered.md");
  const config = join(outputDirectory, "mermaid-config.json");
  writeFileSync(input, diagrams.map(diagram => `\`\`\`mermaid\n${normalizeDiagramStyles(diagram.source)}\n\`\`\``).join("\n\n"));
  writeFileSync(config, JSON.stringify(createDiagramConfig(), null, 2));
  const command = [cli, "-i", input, "-o", output, "-c", config, "-b", "white", "-j", "4"];
  if (browserPath) {
    const puppeteerConfig = join(outputDirectory, "puppeteer-config.json");
    writeFileSync(puppeteerConfig, JSON.stringify({ executablePath: browserPath }));
    command.push("-p", puppeteerConfig);
  }
  console.log(`Rendering ${diagrams.length} diagrams with Mermaid ${MERMAID_VERSION}; artifacts: ${outputDirectory}`);
  for (const [index, diagram] of diagrams.entries()) diagram.svg = `rendered-${index + 1}.svg`;
  const manifest = { mermaidVersion: MERMAID_VERSION, config: createDiagramConfig(), diagrams };
  writeFileSync(join(outputDirectory, "manifest.json"), JSON.stringify(manifest, null, 2));
  const result = spawnSync(process.execPath, command, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Mermaid CLI failed (${result.status}); no thumbnails replaced`);
  await inspectRenderedSvgs(cli, outputDirectory, diagrams, browserPath);
  writeFileSync(join(outputDirectory, "manifest.json"), JSON.stringify(manifest, null, 2));
  // No writes to article sources or metadata. Replace only validated, explicitly requested SD/LD assets.
  for (const { diagram, destination } of targets) copyFileSync(join(outputDirectory, diagram.svg), destination);
  console.log(`Verified ${diagrams.length} SVGs; refreshed ${targets.length} HLD thumbnails. Manifest: ${join(outputDirectory, "manifest.json")}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
