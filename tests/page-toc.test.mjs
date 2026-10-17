import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const frontMatter = path => read(path).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || "";

test("About, Resume and Advisory explicitly opt in without changing ordinary page layouts", () => {
  const optedIn = readdirSync(root)
    .filter(path => path.endsWith(".md") && /^toc:\s*true\s*$/m.test(frontMatter(path)))
    .sort();
  assert.deepEqual(optedIn, ["advisory.md", "index.md", "resume.md"]);
  for (const path of optedIn) assert.match(frontMatter(path), /^layout:\s*page\s*$/m);
  for (const path of ["portfolio.md", "designs.md", "infrastructure.md", "blog.md"]) {
    assert.doesNotMatch(frontMatter(path), /^toc:\s*true\s*$/m);
  }
});

test("personal pages reuse the rendered-heading outline and article enhancement, not a separate navigation implementation", () => {
  const layout = read("_layouts/page.html");
  assert.match(layout, /if page\.toc/);
  assert.match(layout, /class="document-shell document-shell--page[^\n]+data-document-shell/);
  assert.match(layout, /post--page[\s\S]*post--document/);
  assert.match(layout, /include article-toc\.html content=content/);
  assert.match(layout, /\/assets\/css\/article-toc\.css' \| relative_url/);
  assert.match(layout, /import \{ setupArticleToc, setupSidePanels \} from "\{\{ '\/assets\/js\/article-toc\.mjs' \| relative_url \}\}\?v=/);
  assert.match(layout, /const shell = document\.querySelector\("\[data-document-shell\]"\)/);
  assert.match(layout, /setupArticleToc\(shell\)/);
  assert.match(layout, /<aside class="page-side-rail" data-toc-scroll aria-label="Page navigation and details">/);
  assert.doesNotMatch(layout, /include document-nav\.html|setupDocumentNav|new IntersectionObserver|addEventListener\(/);
});

test("the shared outline remains native, named, hierarchical and initially open without JavaScript", () => {
  const include = read("_includes/article-toc.html");
  assert.match(include, /<aside class="article-toc" data-article-toc aria-label="On this page">/);
  assert.match(include, /<details class="article-toc-panel" open>/);
  assert.match(include, /<summary>On this page<\/summary>/);
  assert.match(include, /<nav aria-label="On this page">/);
  assert.match(include, /<ol class="article-toc-list" role="list">/);
  assert.match(include, /<ol role="list">/);
  assert.match(include, /href="#\{\{ toc_id \| url_encode/);
  assert.match(include, /toc_attributes contains ' data-toc-label="'/);
  assert.doesNotMatch(include, /href="javascript:|onclick=|slugify|<script/);
});

test("shared responsive and print behavior stays attached to the document shell", () => {
  const css = read("assets/css/article-toc.css");
  const enhancement = read("assets/js/article-toc.mjs");
  assert.match(css, /@media \(min-width: 1240px\)/);
  assert.match(css, /grid-template-columns: 210px minmax\(0, 1fr\) 220px/);
  assert.match(css, /\.document-shell \.article-toc[\s\S]*grid-column: 3/);
  assert.match(css, /position: sticky; top: calc\(var\(--site-header-height\) \+ 1\.25rem\)/);
  assert.match(css, /@media print\s*\{[\s\S]*\.document-shell > :is\(\.document-nav, \.article-toc\)\s*\{ display: none; \}/);
  assert.match(css, /@media print\s*\{[\s\S]*\.document-shell--page > \.page-side-rail \.article-toc\s*\{ display: none; \}/);
  assert.match(enhancement, /matchMedia\("\(min-width: 1240px\)"\)/);
  assert.match(enhancement, /panel\.open = desktop\.matches/);
  assert.match(enhancement, /if \(!desktop\.matches && panel\) panel\.open = false/);
  assert.doesNotMatch(enhancement, /window\.location|location\.hash\s*=|history\.(?:pushState|replaceState)|clipboard/);
});

test("one reading-width token controls article and personal-page bodies without changing the global shell", () => {
  const site = read("assets/css/site.css");
  const css = read("assets/css/article-toc.css");
  assert.match(site, /--site-reading-width:\s*800px/);
  assert.match(css, /\.document-shell > \.post--document\s*\{[^}]*max-width: var\(--site-reading-width\);[^}]*width: 100%;/);
  assert.match(css, /\.document-shell--page\s*\{[^}]*max-width: var\(--site-reading-width\);[^}]*margin-inline: auto;/);
  assert.match(css, /\.document-shell--page > \.page-side-rail\s*\{[\s\S]*grid-column: 3; grid-row: 1/);
  assert.doesNotMatch(css, /\.wrapper/);
  for (const path of ["assets/css/advisory.css", "assets/css/about.css"]) {
    assert.doesNotMatch(read(path), /max-width:\s*(?:640|850)px/);
  }
});

test("Resume qualifications stay on the left and searchable, while only the outline occupies the right rail", () => {
  assert.match(frontMatter("resume.md"), /^left_rail:\s*resume-qualifications\.html\s*$/m);
  assert.doesNotMatch(frontMatter("resume.md"), /^right_rail:/m);
  const layout = read("_layouts/page.html");
  assert.match(layout, /<aside class="page-profile-rail" data-page-profile aria-label="\{\{ page\.left_rail_label \| default: 'Contact and qualifications' \| escape \}\}">\s*\{% include \{\{ page\.left_rail \}\} %}/);
  const rightRail = layout.match(/<aside class="page-side-rail"[^>]*>([\s\S]*?)<\/aside>/)[1];
  assert.match(rightRail, /include article-toc\.html content=content/);
  assert.doesNotMatch(rightRail, /left_rail|qualifications|resume-sidebar/);
  const rail = read("_includes/resume-qualifications.html");
  assert.match(rail, /<details class="resume-qualifications-panel profile-panel" data-side-panel open>/);
  assert.match(rail, /<summary>Contact and qualifications<\/summary>/);
  assert.match(rail, /<h2 id="education">Education<\/h2>/);
  assert.match(rail, /<h2 id="professional-certifications">Certifications<\/h2>/);
  assert.match(rail, /include profile-contact\.html work_status=true %}/);
  assert.doesNotMatch(read("_includes/profile-contact.html"), /include resume-download|resume_download/);
  assert.doesNotMatch(read("resume.md"), /<aside class="resume-sidebar"/);
  const search = read("search-index.json");
  assert.match(search, /if entry\.left_rail[\s\S]*include \{\{ entry\.left_rail \}\}[\s\S]*search_html = search_html \| append: search_rail/);
  const download = read("_includes/resume-download.html");
  assert.match(download, /href="\{\{ '\/assets\/documents\/ilia-zlobin-resume\.pdf' \| relative_url \}\}"/);
  assert.match(download, /download="Ilia-Zlobin-Resume\.pdf" type="application\/pdf" aria-label="Download Resume PDF"/);
});
