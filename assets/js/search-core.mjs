/** Static, local-only search. Indexed HTML is parsed as text, never executed. */
const CATEGORY_LABELS = {
  page: 'Pages', sd: 'System design', ml: 'Machine learning', ld: 'Low-level design',
  ai: 'Agentic AI', infra: 'Infrastructure', tech: 'Technologies', blog: 'Blog',
  'full-stack': 'Full Stack', 'ai-ml': 'AI/ML', research: 'Research'
};
const CATEGORY_ALIASES = {
  'system-design': 'sd', 'system-design-ml': 'ml', 'low-level-design': 'ld',
  technology: 'tech', technologies: 'tech', pages: 'page', posts: 'blog',
  ...Object.fromEntries(Object.keys(CATEGORY_LABELS).map(value => [value, value])),
  ...Object.fromEntries(Object.entries(CATEGORY_LABELS).map(([value, label]) => [label.toLowerCase(), value]))
};
const SECTION_LABELS = { portfolio: 'Portfolio', design: 'Design', infra: 'Infra', resume: 'Resume', advisory: 'Advisory', about: 'About', blog: 'Blog' };
const SECTION_ALIASES = { designs: 'design', infrastructure: 'infra', home: 'about', ...Object.fromEntries(Object.keys(SECTION_LABELS).map(value => [value, value])) };
const ENTITY_NAMES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', middot: '·', bull: '•', times: '×', copy: '©', reg: '®'
};
const MAX_QUERY = 512, MAX_HTML = 1_000_000, MAX_DOCUMENTS = 2_000;
const collapse = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalize = value => collapse(value).normalize('NFKC').toLocaleLowerCase('en');
const unique = values => [...new Set(values)];
const aliasValue = (aliases, value) => Object.hasOwn(aliases, normalize(value)) ? aliases[normalize(value)] : null;
const categoryValue = value => aliasValue(CATEGORY_ALIASES, value);
const sectionValue = value => aliasValue(SECTION_ALIASES, value);
const inferredSection = entry => sectionValue(entry.section) || (entry.url?.startsWith('/portfolio/') ? 'portfolio' :
  ['sd', 'ml', 'ld', 'ai'].includes(categoryValue(entry.category)) ? 'design' :
    ['infra', 'tech'].includes(categoryValue(entry.category)) ? 'infra' :
      entry.url?.startsWith('/resume/') ? 'resume' : entry.url?.startsWith('/advisory/') ? 'advisory' : entry.url === '/' ? 'about' : 'blog');

function decodeEntities(value) {
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (entity, name) => {
    if (!name.startsWith('#')) return ENTITY_NAMES[name.toLowerCase()] ?? entity;
    const number = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : ' ';
  });
}

function stripSourceControls(value) {
  return String(value)
    .replace(/{%\s*(comment|raw)\b[^%]*%}[\s\S]*?{%\s*end\1\s*%}/gi, ' ')
    .replace(/{%[\s\S]*?%}|{{[\s\S]*?}}/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function attribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`(?:\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decodeEntities(match ? match[1] ?? match[2] ?? match[3] : '');
}

function ignoredTag(name, token) {
  const classes = attribute(token, 'class').split(/\s+/);
  return ['script', 'style', 'svg', 'template', 'nav', 'form', 'button', 'select', 'textarea'].includes(name)
    || /\shidden(?:\s|=|>)/i.test(token) || attribute(token, 'aria-hidden') === 'true'
    || classes.some(value => ['mermaid', 'language-mermaid', 'blog-controls', 'type-filters', 'result-count'].includes(value));
}

/** Keep resolved heading IDs, including a Portfolio heading's enclosing article. */
function extractHtml(html) {
  const source = stripSourceControls(String(html ?? '').slice(0, MAX_HTML));
  const sections = [{ title: '', id: '', chunks: [] }], allChunks = [], stack = [];
  const blocks = /^(?:p|div|section|article|li|ul|ol|pre|table|tr|blockquote|br|hr|header|footer)$/;
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  let heading = null;
  const separator = () => {
    allChunks.push(' ');
    sections.at(-1).chunks.push(' ');
    if (heading) heading.chunks.push(' ');
  };
  const finishHeading = () => {
    if (!heading) return;
    const title = collapse(heading.chunks.join(''));
    if (title) {
      sections.push({ title, id: heading.id, chunks: [title, ' '] });
      allChunks.push(title, ' ');
    }
    heading = null;
  };
  for (const token of source.match(/<![^>]*>|<\/?[^>]+>|[^<]+/g) ?? []) {
    if (token.startsWith('<')) {
      const match = token.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b/i);
      if (!match) continue;
      const name = match[2].toLowerCase();
      if (match[1]) {
        const index = stack.map(item => item.name).lastIndexOf(name);
        if (index < 0) continue;
        const skipped = stack.at(-1)?.ignored;
        if (/^h[1-6]$/.test(name) && !skipped) finishHeading();
        stack.splice(index);
        if (blocks.test(name) && !skipped) separator();
      } else {
        const ignored = Boolean(stack.at(-1)?.ignored) || ignoredTag(name, token);
        if (!ignored && /^h[1-6]$/.test(name)) {
          finishHeading(); separator();
          const parent = [...stack].reverse().find(item => ['article', 'section'].includes(item.name) && item.id);
          heading = { id: attribute(token, 'id') || parent?.id || '', chunks: [] };
        } else if (!ignored && blocks.test(name)) separator();
        if (!voidTags.has(name) && !/\/\s*>$/.test(token)) stack.push({ name, ignored, id: attribute(token, 'id') });
      }
    } else if (!stack.at(-1)?.ignored) {
      const text = decodeEntities(token);
      if (heading) heading.chunks.push(text);
      else { allChunks.push(text); sections.at(-1).chunks.push(text); }
    }
  }
  finishHeading();
  return {
    text: collapse(allChunks.join('')),
    sections: sections.map(section => ({ title: section.title, id: section.id, text: collapse(section.chunks.join('')) }))
      .filter(section => section.text)
  };
}

function safeText(value, maximum = 1_000) {
  return extractHtml(String(value ?? '').slice(0, maximum * 4)).text.slice(0, maximum);
}

function safeUrl(value) {
  if (typeof value !== 'string' || value.length > 2_048 || !value.startsWith('/')
    || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value) || /%(?:2f|5c|00|0[ad])/i.test(value)) return null;
  try {
    const url = new URL(value, 'https://search.invalid');
    if (url.origin !== 'https://search.invalid') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

/** Return one prepared document per canonical internal URL. */
export function prepareDocuments(rawEntries) {
  if (!Array.isArray(rawEntries)) return [];
  const prepared = [], seen = new Set();
  for (const entry of rawEntries.slice(0, MAX_DOCUMENTS)) {
    if (!entry || typeof entry !== 'object') continue;
    const url = safeUrl(entry.url), title = safeText(entry.title, 250), category = categoryValue(entry.category);
    if (!url || !title || !category || seen.has(url) || entry.search_disabled === true || entry.published === false || entry.redirect_to) continue;
    seen.add(url);
    const description = safeText(entry.description, 600);
    const tags = unique((Array.isArray(entry.tags) ? entry.tags : []).slice(0, 100)
      .map(value => safeText(value, 100)).filter(Boolean));
    const extracted = extractHtml(entry.html ?? entry.content ?? '');
    prepared.push({
      url, title, description, category, categoryLabel: CATEGORY_LABELS[category], tags,
      section: inferredSection(entry), sectionLabel: SECTION_LABELS[inferredSection(entry)],
      text: extracted.text, sections: extracted.sections.map(section => ({ ...section, normalized: normalize(section.text), normalizedTitle: normalize(section.title) })),
      normalizedTitle: normalize(title), normalizedDescription: normalize(description),
      normalizedTags: unique(tags.map(normalize)), normalizedText: normalize(extracted.text), order: prepared.length
    });
  }
  return prepared;
}

/** Inline filters supplement UI chips; unknown/malformed filters remain text. */
export function parseSearchQuery(query) {
  const categories = [], tags = [], sections = [], text = [];
  for (const token of String(query ?? '').slice(0, MAX_QUERY).match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []) {
    const match = token.match(/^(type|category|tag|in|section):(.+)$/i);
    if (!match) { text.push(token); continue; }
    const raw = match[2], value = /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
    if (['type', 'category'].includes(match[1].toLowerCase())) {
      const category = categoryValue(value);
      if (category) { categories.push(category); continue; }
    } else if (['in', 'section'].includes(match[1].toLowerCase())) {
      const section = sectionValue(value);
      if (section) { sections.push(section); continue; }
    } else if (value && !/["']/.test(value)) { tags.push(normalize(value)); continue; }
    text.push(token);
  }
  return { text: collapse(text.join(' ')), categories: unique(categories), tags: unique(tags), sections: unique(sections) };
}

function searchState(state = {}) {
  const parsed = parseSearchQuery(state.query);
  const tokens = [], seen = new Set();
  for (const raw of normalize(parsed.text).match(/"[^"]+"|'[^']+'|[^\s]+/g) ?? []) {
    const phrase = /^(["']).*\1$/.test(raw);
    const value = phrase ? raw.slice(1, -1) : raw;
    const key = `${phrase ? 'phrase' : 'prefix'}:${value}`;
    if (!value || seen.has(key)) continue;
    seen.add(key);
    const characters = Array.from(value), word = /[\p{L}\p{N}_]/u;
    const leading = word.test(characters[0]) ? '(^|[^\\p{L}\\p{N}_])' : '()';
    const trailing = phrase && word.test(characters.at(-1)) ? '(?![\\p{L}\\p{N}_])' : '';
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    tokens.push({ value, phrase, pattern: new RegExp(`${leading}${escaped}${trailing}`, 'u') });
  }
  return {
    tokens,
    categories: unique([...(Array.isArray(state.categories) ? state.categories : []).map(categoryValue).filter(Boolean), ...parsed.categories]),
    tags: unique([...(Array.isArray(state.tags) ? state.tags : []).map(normalize).filter(Boolean), ...parsed.tags]),
    sections: unique([...(Array.isArray(state.sections) ? state.sections : []).map(sectionValue).filter(Boolean), ...parsed.sections])
  };
}

/** Prefix completion is allowed at a word start, never inside another word. */
function matchPosition(text, token) {
  const match = token.pattern.exec(text);
  return match ? match.index + match[1].length : -1;
}

function matches(document, state) {
  return (!state.categories.length || state.categories.includes(document.category))
    && (!state.sections.length || state.sections.includes(document.section))
    && state.tags.every(tag => document.normalizedTags.includes(tag))
    && state.tokens.every(token => matchPosition(document.normalizedTitle, token) >= 0 || matchPosition(document.normalizedDescription, token) >= 0
      || document.normalizedTags.some(tag => matchPosition(tag, token) >= 0) || matchPosition(document.normalizedText, token) >= 0);
}

function snippet(text, tokens, length = 200) {
  if (!text) return '';
  const normalized = normalize(text);
  const positions = tokens.map(token => matchPosition(normalized, token)).filter(index => index >= 0);
  // Snippet boundaries are only approximate after Unicode normalization. The
  // source stays plain text, and a nearby sentence is more useful than markup.
  const hit = positions.length ? Math.min(...positions) : 0;
  let start = hit > 65 ? hit - 55 : 0;
  if (start) {
    const nextSpace = text.indexOf(' ', start);
    if (nextSpace >= 0 && nextSpace < hit) start = nextSpace + 1;
  }
  const end = Math.min(text.length, start + length);
  let sample = text.slice(start, end);
  if (end < text.length && sample.includes(' ')) sample = sample.slice(0, sample.lastIndexOf(' '));
  return `${start ? '…' : ''}${sample.trim()}${end < text.length ? '…' : ''}`;
}

function rank(document, state) {
  let score = 0;
  for (const token of state.tokens) {
    const titlePosition = matchPosition(document.normalizedTitle, token);
    if (document.normalizedTitle === token.value) score += 150;
    else if (titlePosition === 0) score += 65;
    else if (titlePosition > 0) score += 45;
    if (document.normalizedTags.includes(token.value)) score += 35;
    else if (document.normalizedTags.some(tag => matchPosition(tag, token) >= 0)) score += 15;
    if (matchPosition(document.normalizedDescription, token) >= 0) score += 12;
    if (matchPosition(document.normalizedText, token) >= 0) score += 2;
  }
  let bestSection = null, bestSectionScore = 0;
  for (const section of document.sections) {
    const sectionScore = state.tokens.reduce((total, token) => total
      + (matchPosition(section.normalizedTitle, token) >= 0 ? 14 : 0) + (matchPosition(section.normalized, token) >= 0 ? 4 : 0), 0);
    if (sectionScore > bestSectionScore) { bestSection = section; bestSectionScore = sectionScore; }
  }
  return { score: score + bestSectionScore, section: bestSection };
}

/** AND text/tags, OR categories; total counts documents before the result cap. */
export function searchDocuments(prepared, state = {}, limit = 20) {
  const selected = searchState(state);
  const matched = (Array.isArray(prepared) ? prepared : []).filter(document => matches(document, selected))
    .map(document => ({ document, ...rank(document, selected) }));
  matched.sort((a, b) => b.score - a.score
    || (selected.tokens.length ? 0 : Number(b.document.category === 'page') - Number(a.document.category === 'page'))
    || a.document.order - b.document.order);
  const cap = Number.isFinite(Number(limit)) ? Math.max(0, Math.min(100, Math.floor(Number(limit)))) : 20;
  return {
    total: matched.length,
    results: matched.slice(0, cap).map(({ document, score, section }) => ({
      url: section?.id ? `${document.url.split('#')[0]}#${encodeURIComponent(section.id)}` : document.url,
      title: document.title, description: document.description, category: document.category,
      categoryLabel: document.categoryLabel, tags: [...document.tags], section: document.section, sectionLabel: document.sectionLabel,
      snippet: snippet(section?.text || document.description || document.text, selected.tokens),
      sectionTitle: section?.title || '', score
    }))
  };
}

/** Facet counts respect text and the other dimension, not their own category. */
export function getSearchFacets(prepared, state = {}) {
  const selected = searchState(state), documents = Array.isArray(prepared) ? prepared : [];
  const categoryCounts = new Map(), tagLabels = new Map(), tagCounts = new Map(), sectionCounts = new Map();
  for (const document of documents) {
    if (matches(document, { ...selected, categories: [] })) categoryCounts.set(document.category, (categoryCounts.get(document.category) || 0) + 1);
    if (matches(document, { ...selected, sections: [] })) sectionCounts.set(document.section, (sectionCounts.get(document.section) || 0) + 1);
    for (const label of document.tags) if (!tagLabels.has(normalize(label))) tagLabels.set(normalize(label), label);
    // The selected tag's own checkbox stays removable even when another filter
    // yields zero matches. Additional tags count the AND intersection.
    if (!matches(document, selected)) continue;
    for (const value of document.normalizedTags) tagCounts.set(value, (tagCounts.get(value) || 0) + 1);
  }
  return {
    sections: Object.entries(SECTION_LABELS).filter(([value]) => sectionCounts.has(value) || selected.sections.includes(value))
      .map(([value, label]) => ({ value, label, count: sectionCounts.get(value) || 0 })),
    categories: Object.entries(CATEGORY_LABELS)
      .filter(([value]) => categoryCounts.has(value) || selected.categories.includes(value))
      .map(([value, label]) => ({ value, label, count: categoryCounts.get(value) || 0 })),
    tags: [...unique([...tagCounts.keys(), ...selected.tags])]
      .map(value => ({ value, label: tagLabels.get(value) || value, count: tagCounts.get(value) || 0 }))
      .sort((a, b) => Number(selected.tags.includes(b.value)) - Number(selected.tags.includes(a.value))
        || b.count - a.count || a.label.localeCompare(b.label, 'en'))
  };
}

// Completion happens while typing, so a quoted token need not be closed yet.
// Whitespace inside that token stays part of its value; quoted prose never
// exposes an embedded tag:/type: string as a separate operator.
function completionToken(query) {
  let start = null, quote = null;
  for (let index = 0; index < query.length; index++) {
    const character = query[index];
    if (quote) { if (character === quote) quote = null; }
    else if (/\s/.test(character)) { start = null; continue; }
    else if (character === '"' || character === "'") quote = character;
    if (start === null) start = index;
  }
  return start === null ? { tail: '', prefix: query.trimEnd() } :
    { tail: query.slice(start), prefix: query.slice(0, start).trimEnd() };
}

/** A trailing query token can be completed into a filter; previous free text is retained. */
export function getSearchSuggestions(prepared, state = {}, limit = 9) {
  const query = String(state.query || '').slice(0, MAX_QUERY);
  const cap = Number.isFinite(Number(limit)) ? Math.max(0, Math.min(24, Math.floor(Number(limit)))) : 9;
  const { tail, prefix } = completionToken(query);
  const match = tail.match(/^(type|category|tag|in|section):(.*)$/i);
  const kind = match ? ['type', 'category'].includes(match[1].toLowerCase()) ? 'categories' : match[1].toLowerCase() === 'tag' ? 'tags' : 'sections' : null;
  const needle = normalize((match ? match[2] : tail).replace(/^["']|["']$/g, '')).replace(/[-/]/g, ' ');
  const base = { ...state, query: prefix }, facets = getSearchFacets(prepared, base), selected = searchState(state);
  const result = [];
  for (const group of ['sections', 'categories', 'tags']) {
    if (kind && kind !== group) continue;
    const candidates = facets[group].filter(item => item.count > 0 && !selected[group].includes(item.value) &&
      (!needle || normalize(`${item.label} ${item.value}`).replace(/[-/]/g, ' ').split(' ').some(word => word.startsWith(needle)) ||
        normalize(item.label).replace(/[-/]/g, ' ').startsWith(needle)));
    for (const item of candidates.slice(0, kind ? cap : 3)) result.push({ ...item, kind: group, query: prefix });
  }
  return result.slice(0, cap);
}
