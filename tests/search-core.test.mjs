import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prepareDocuments, parseSearchQuery, searchDocuments, getSearchFacets, getSearchSuggestions } from '../assets/js/search-core.mjs';

const fixture = () => prepareDocuments([
  { url: '/designs/redis/', title: 'TECH: Redis', category: 'tech', tags: ['Caching', 'Data Pipelines'],
    description: 'An in-memory data store.', html: '<h2 id="recovery">Recovery</h2><p>Snapshots and replication restore lost cache state.</p><h2 id="tradeoffs">Trade-offs</h2><p>Distributed locks require careful leases.</p>' },
  { url: '/designs/rate-limiter/', title: 'SD: Rate Limiter', category: 'system-design', tags: ['Redis', 'Caching'],
    description: 'Bound traffic per customer.', html: '<h2 id="atomic-updates">Atomic updates</h2><p>Redis scripts reserve tokens atomically for admission.</p>' },
  { url: '/designs/pipeline/', title: 'INFRA: Event Pipeline', category: 'infra', tags: ['Data Pipelines', 'Kafka'],
    html: '<h2 id="replay">Replay</h2><p>Snapshots retain offsets for replay.</p>' },
  { url: '/portfolio/', title: 'Portfolio', category: 'page', tags: ['AI Agents', 'Python'],
    html: '<nav>Hidden navigation</nav><article id="events-concierge"><h3>Events Concierge</h3><p>Calendar registration through browser automation.</p></article>' },
  { url: '/resume/', title: 'Resume', category: 'page', description: 'Staff Software Engineer', html: '<h2 id="experience">Experience</h2><p>Platform engineering and software development.</p>' }
]);

test('inline type/tag filters are case-insensitive, deduplicated and quoted', () => {
  assert.deepEqual(parseSearchQuery('redis TYPE:TECH type:tech tag:"Data Pipelines" tag:\'Caching\' tag:Caching'), {
    text: 'redis', categories: ['tech'], tags: ['data pipelines', 'caching'], sections: []
  });
  assert.deepEqual(parseSearchQuery('type:sd type:ml type:ld type:infra type:ai type:page type:blog'), {
    text: '', categories: ['sd', 'ml', 'ld', 'infra', 'ai', 'page', 'blog'], tags: [], sections: []
  });
  assert.deepEqual(parseSearchQuery('type:unsupported tag: "exact phrase"'), {
    text: 'type:unsupported tag: "exact phrase"', categories: [], tags: [], sections: []
  });
  assert.deepEqual(parseSearchQuery('tag:\'Data Pipelines\' redis'), { text: 'redis', categories: [], tags: ['data pipelines'], sections: [] });
});

test('sections are independent of a single category and all tags remain conjunctive', () => {
  const documents = prepareDocuments([
    { url: '/portfolio/', title: 'Portfolio', section: 'portfolio', category: 'page', html: '' },
    { url: '/portfolio/#worker', title: 'AI Worker', section: 'portfolio', category: 'ai-ml', tags: ['Python', 'AI Agents'], html: '<article id="worker"><h3>AI Worker</h3><p>Concurrent assistants</p></article>' },
    { url: '/portfolio/#cloud', title: 'Cloud Platform', section: 'portfolio', category: 'infra', tags: ['Terraform'], html: '<article id="cloud"><h3>Cloud Platform</h3><p>Network setup</p></article>' },
    { url: '/designs/cloud/', title: 'Infrastructure Cloud', section: 'infra', category: 'infra', tags: ['Python'], html: '<h2 id="network">Network</h2><p>Cloud network</p>' }
  ]);
  assert.deepEqual(parseSearchQuery('IN:portfolio section:Infrastructure category:"AI/ML" tag:Python'), {
    text: '', sections: ['portfolio', 'infra'], categories: ['ai-ml'], tags: ['python']
  });
  assert.equal(parseSearchQuery('in:unknown section: tag:').text, 'in:unknown section: tag:');
  assert.deepEqual(searchDocuments(documents, { query: 'in:portfolio tag:Python' }).results.map(item => item.url), ['/portfolio/#worker']);
  assert.equal(searchDocuments(documents, { query: 'in:portfolio type:infra' }).results[0].url, '/portfolio/#cloud');
  assert.equal(searchDocuments(documents, { sections: ['infra', 'portfolio'], categories: ['infra', 'ai-ml'] }).total, 3);
  assert.equal(searchDocuments(documents, { query: 'in:portfolio tag:Python tag:Terraform' }).total, 0);
  const result = searchDocuments(documents, { query: 'in:portfolio concurrent' }).results[0];
  assert.equal(result.url, '/portfolio/#worker'); assert.equal(result.sectionLabel, 'Portfolio'); assert.equal(result.categoryLabel, 'AI/ML');
  assert.equal(getSearchFacets(documents, { query: 'type:infra' }).sections.find(item => item.value === 'portfolio').count, 1);
});

test('autocomplete completes only the trailing token, with grouped accurate filter counts', () => {
  const documents = fixture();
  assert.deepEqual(getSearchSuggestions(documents, { query: 'port' }), [
    { kind: 'sections', value: 'portfolio', label: 'Portfolio', count: 1, query: '' }
  ]);
  const caching = getSearchSuggestions(documents, { query: 'snapshots tag:Ca' }).find(item => item.value === 'caching');
  assert.deepEqual(caching, { kind: 'tags', value: 'caching', label: 'Caching', count: 1, query: 'snapshots' });
  assert.ok(getSearchSuggestions(documents, { query: 'type:sys' }).every(item => item.kind === 'categories'));
  assert.equal(getSearchSuggestions(documents, { query: 'category:tech' })[0], undefined, 'already active inline category is not suggested twice');
  assert.equal(getSearchSuggestions(documents, { query: 'tag:"Data P"' })[0].value, 'data pipelines');
  assert.equal(getSearchSuggestions(documents, { query: 'tag:ca', tags: ['caching'] }).some(item => item.value === 'caching'), false);
  assert.equal(getSearchSuggestions(documents, { query: 'no-matching-facet' }).length, 0);
  assert.equal(getSearchSuggestions(documents, { query: '"before tag:caching after"' }).length, 0);
  assert.ok(getSearchSuggestions(documents, {}).length <= 9);
});

test('titles and exact tags outrank body mentions while the body remains searchable', () => {
  const documents = fixture();
  const redis = searchDocuments(documents, { query: 'redis' });
  assert.equal(redis.results[0].title, 'TECH: Redis');
  assert.equal(redis.results[1].title, 'SD: Rate Limiter');
  assert.equal(redis.total, 2);
  const body = searchDocuments(documents, { query: 'leases' });
  assert.equal(body.results[0].url, '/designs/redis/#tradeoffs');
  assert.equal(body.results[0].sectionTitle, 'Trade-offs');
  assert.match(body.results[0].snippet, /careful leases/);
});

test('word-prefix completion never matches midword text, and quoted phrases require both boundaries', () => {
  const documents = prepareDocuments([
    { url: '/zoom/', title: 'Zoom', category: 'sd', html: '<h2 id="storage">Storage</h2><p>State survives service restarts.</p><h2 id="restrictive-networks">Restrictive networks</h2><p>Use an ICE restart to renew the media path.</p>' },
    { url: '/chat/', title: 'Chat', category: 'sd', html: '<h2 id="prompts">Prompts</h2><p>Its service restarts cleanly.</p>' },
    { url: '/redis/', title: 'Redis', category: 'tech', html: '<p>expires_at and Éclair_name are important fields.</p>' }
  ]);
  const phrase = searchDocuments(documents, { query: '"ICE restart"' });
  assert.equal(phrase.total, 1);
  assert.equal(phrase.results[0].url, '/zoom/#restrictive-networks');
  assert.match(phrase.results[0].snippet, /ICE restart/);
  assert.equal(searchDocuments(documents, { query: 'ice' }).total, 1);
  assert.equal(searchDocuments(documents, { query: '"service restart"' }).total, 0);
  assert.equal(searchDocuments(documents, { query: 'service restart' }).total, 2);
  assert.equal(searchDocuments(documents, { query: 'red' }).results[0].title, 'Redis');
  assert.equal(searchDocuments(documents, { query: 'edis' }).total, 0);
  assert.equal(searchDocuments(documents, { query: 'expires_at' }).results[0].title, 'Redis');
  assert.equal(searchDocuments(documents, { query: 'expires_' }).total, 1);
  assert.equal(searchDocuments(documents, { query: 'éclair' }).total, 1);
  assert.equal(searchDocuments(documents, { query: 'clair' }).total, 0);
  assert.equal(getSearchFacets(documents, { query: '"ICE restart"' }).categories[0].count, 1);
});

test('multiple tags are AND, categories OR, and chips merge inline filters', () => {
  const documents = fixture();
  assert.equal(searchDocuments(documents, { query: 'type:infra', categories: ['tech'] }).total, 2);
  assert.equal(searchDocuments(documents, { query: 'tag:Caching', tags: ['data pipelines'] }).total, 1);
  assert.equal(searchDocuments(documents, { query: 'type:tech tag:"Data Pipelines" snapshots' }).results[0].title, 'TECH: Redis');
  assert.equal(searchDocuments(documents, { query: 'snapshots missing' }).total, 0);
  assert.equal(searchDocuments(documents, { query: '"browser automation"' }).results[0].title, 'Portfolio');
});

test('empty and filter-only queries keep useful top-level pages first and do not manufacture section links', () => {
  const documents = fixture();
  assert.deepEqual(searchDocuments(documents, {}).results.slice(0, 2).map(result => result.title), ['Portfolio', 'Resume']);
  assert.deepEqual(searchDocuments(documents, { query: 'type:tech' }).results.map(result => result.url), ['/designs/redis/']);
  assert.deepEqual(searchDocuments(documents, {}).results.map(result => result.title), searchDocuments(documents, {}).results.map(result => result.title));
});

test('facet counts respect query/other filters and retain selected zero-count facets', () => {
  const documents = fixture(), facets = getSearchFacets(documents, { categories: ['tech'], tags: ['caching'] });
  assert.equal(facets.categories.find(category => category.value === 'sd').count, 1);
  assert.equal(facets.categories.find(category => category.value === 'tech').count, 1);
  assert.equal(facets.tags.find(tag => tag.value === 'data pipelines').count, 1);
  assert.equal(facets.tags.some(tag => tag.value === 'kafka'), false);
  const empty = getSearchFacets(documents, { query: 'notfound type:infra tag:Redis' });
  assert.deepEqual(empty.categories, [{ value: 'infra', label: 'Infrastructure', count: 0 }]);
  assert.deepEqual(empty.tags, [{ value: 'redis', label: 'Redis', count: 0 }]);
});

test('rendered IDs preserve explicit/custom headings, entities, nested markup and enclosing project anchors', () => {
  const documents = prepareDocuments([{ url: '/article/', title: 'HTML &amp; Entities', category: 'blog',
    html: '<h2 class="x" id="custom:résumé /&amp;">A <code>typed</code> contract</h2><p>Fran&#231;ais &amp; &#x1F680; &#0; &#x110000;</p><article id="project-anchor"><h3>Project <em>details</em></h3><p>Opaque unique idea.</p></article>' }]);
  const result = searchDocuments(documents, { query: 'français' }).results[0];
  assert.equal(result.title, 'HTML & Entities');
  assert.equal(result.sectionTitle, 'A typed contract');
  assert.equal(result.url, '/article/#custom%3Ar%C3%A9sum%C3%A9%20%2F%26');
  assert.match(result.snippet, /Français & 🚀/);
  assert.equal(searchDocuments(documents, { query: 'opaque' }).results[0].url, '/article/#project-anchor');
  assert.equal(searchDocuments(fixture(), { query: 'calendar' }).results[0].url, '/portfolio/#events-concierge');
});

test('source-only diagrams, scripts, styles, controls, comments and Liquid are never searchable', () => {
  const documents = prepareDocuments([{ url: '/safe/', title: 'Safe', category: 'tech', html: `
    <style>style-secret</style><script>script-secret</script><svg><text>svg-secret</text></svg>
    <div class="language-mermaid highlighter-rouge"><div class="highlight"><pre>graph-secret graph TB A--&gt;B</pre></div></div>
    <pre class="mermaid">mermaid-secret</pre><nav>navigation-secret</nav>
    <div hidden>hidden-secret</div><span aria-hidden="true">icon-secret</span>
    {% comment %}unpublished-secret{% endcomment %}{{ site.secret_key }}{% include private.html %}
    <!-- comment-secret --><h2 id='visible'>Visible</h2><p>ordinary searchable content.</p>
    <pre><code>important_field</code></pre>` }]);
  for (const query of ['style-secret', 'script-secret', 'svg-secret', 'graph-secret', 'mermaid-secret', 'navigation-secret', 'hidden-secret', 'icon-secret', 'unpublished-secret', 'secret_key', 'private.html', 'comment-secret']) {
    assert.equal(searchDocuments(documents, { query }).total, 0, query);
  }
  assert.equal(searchDocuments(documents, { query: 'ordinary' }).total, 1);
  assert.equal(searchDocuments(documents, { query: 'important_field' }).total, 1);
});

test('only bounded canonical internal URLs and plain metadata survive preparation', () => {
  const urls = ['javascript:alert(1)', 'https://external.test/', '//external.test/', '/\\external.test', '/%2f%2fexternal.test', '/%5cexternal.test', '/a\npage', '/%0aexternal.test'];
  const documents = prepareDocuments([
    ...urls.map(url => ({ url, title: 'Unsafe', category: 'tech' })),
    { url: '/safe/', title: '<script>evil()</script><b>Safe &amp; clear</b>', category: 'tech', tags: ['<img src=x onerror=evil>Good'], html: '<p>Safe content.</p>' },
    { url: '/safe/', title: 'Duplicate', category: 'tech' },
    { url: '/disabled/', title: 'Disabled', category: 'page', search_disabled: true },
    { url: '/unpublished/', title: 'Unpublished', category: 'page', published: false },
    { url: '/redirect/', title: 'Redirect', category: 'page', redirect_to: '/safe/' },
    { url: '/unknown/', title: 'Unknown', category: 'unknown' }
  ]);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].title, 'Safe & clear');
  assert.deepEqual(documents[0].tags, ['Good']);
  assert.deepEqual(prepareDocuments(null), []);
  assert.deepEqual(searchDocuments(null), { results: [], total: 0 });
});

test('limits cap result output, retain accurate total and bound snippets', () => {
  const documents = prepareDocuments(Array.from({ length: 150 }, (_, index) => ({
    url: `/page-${index}/`, title: `Page ${index}`, category: 'page', html: `<p>${'long words '.repeat(100)}needle${' tail '.repeat(100)}</p>`
  })));
  const response = searchDocuments(documents, { query: 'needle' }, 2);
  assert.equal(response.total, 150);
  assert.equal(response.results.length, 2);
  assert.ok(response.results.every(result => result.snippet.length <= 202 && result.snippet.includes('needle')));
  assert.equal(searchDocuments(documents, {}, 999).results.length, 100);
  assert.equal(searchDocuments(documents, {}, -1).results.length, 0);
  assert.equal(searchDocuments(documents, {}, 'bad').results.length, 20);
});

test('static index covers public collections and configured header pages without layouts or remote services', () => {
  const source = readFileSync(new URL('../search-index.json', import.meta.url), 'utf8');
  assert.match(source, /layout: null/);
  assert.match(source, /search_disabled: true/);
  assert.match(source, /for header_path in site.header_pages/);
  assert.match(source, /for entry in site.designs/);
  assert.match(source, /for entry in site.posts/);
  assert.match(source, /entry.search_disabled != true and entry.redirect_to == nil/);
  assert.match(source, /entry.content \| markdownify \| jsonify/);
  assert.match(source, /search_project.tags \| jsonify/);
  assert.match(source, /search_project_url \| relative_url \| jsonify/);
  assert.match(source, /"section":"portfolio"/);
  assert.doesNotMatch(source, /https?:\/\//);
});
