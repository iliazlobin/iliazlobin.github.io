import { prepareDocuments, parseSearchQuery, searchDocuments, getSearchFacets, getSearchSuggestions } from './search-core.mjs';

const controllers = new WeakMap();
const same = (a, b) => String(a).toLocaleLowerCase('en') === String(b).toLocaleLowerCase('en');

export function isSearchShortcut(event) {
  return Boolean(!event.defaultPrevented && !event.isComposing && !event.altKey && !event.shiftKey &&
    (event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === 'k');
}

// Remove a visible chip's inline operator without disturbing the remaining query.
export function removeQueryFilter(query, kind, value) {
  return (String(query).match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []).filter(token => {
    const parsed = parseSearchQuery(token);
    return !parsed[kind]?.some(item => same(item, value));
  }).join(' ');
}

export function highlightSegments(text, query) {
  const tokens = (parseSearchQuery(query).text.match(/"[^"]+"|'[^']+'|[^\s]+/g) || []).slice(0, 12);
  const patterns = tokens.map(raw => {
    const phrase = /^(["']).*\1$/.test(raw), value = phrase ? raw.slice(1, -1) : raw;
    if (!value) return '';
    const characters = Array.from(value), word = /[\p{L}\p{N}_]/u;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `${word.test(characters[0]) ? '(?<![\\p{L}\\p{N}_])' : ''}${escaped}${phrase && word.test(characters.at(-1)) ? '(?![\\p{L}\\p{N}_])' : ''}`;
  }).filter(Boolean);
  const source = String(text);
  if (!patterns.length) return [{ text: source, match: false }];
  const segments = []; let offset = 0;
  for (const match of source.matchAll(new RegExp(patterns.join('|'), 'giu'))) {
    segments.push({ text: source.slice(offset, match.index), match: false }, { text: match[0], match: true });
    offset = match.index + match[0].length;
  }
  segments.push({ text: source.slice(offset), match: false });
  return segments;
}

export function setupSiteSearch(doc = document, view = doc.defaultView) {
  if (controllers.has(doc)) return controllers.get(doc);
  const dialog = doc.querySelector('[data-site-search]');
  const triggers = Array.from(doc.querySelectorAll('[data-open-site-search]'));
  if (!dialog?.showModal || !triggers.length) return null;
  const query = dialog.querySelector('[data-search-query]');
  const suggestionList = dialog.querySelector('[data-search-suggestions]');
  const filters = dialog.querySelector('[data-search-filters]');
  const list = dialog.querySelector('[data-search-results]');
  const status = dialog.querySelector('[data-search-status]');
  const retry = dialog.querySelector('[data-search-retry]');
  const reset = dialog.querySelector('[data-search-reset]');
  if (![query, suggestionList, filters, list, status, retry, reset].every(Boolean)) return null;
  const state = { query: '', categories: [], tags: [], sections: [] };
  let documents = null, pending = null, destroyed = false, opener = null, previousOverflow = null;
  let suggestions = [], activeSuggestion = -1;

  function element(name, className, text) {
    const node = doc.createElement(name);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function highlight(node, text) {
    for (const part of highlightSegments(text, state.query)) node.append(part.match ? element('mark', '', part.text) : doc.createTextNode(part.text));
  }
  function selectSuggestion(index) {
    const item = suggestions[index];
    if (!item) return;
    if (!state[item.kind].some(value => same(value, item.value))) state[item.kind].push(item.value);
    state.query = item.query; query.value = state.query;
    render(); query.focus();
  }
  function updateSuggestionSelection() {
    const choices = Array.from(suggestionList.querySelectorAll('[data-search-suggestion]'));
    choices.forEach((node, index) => node.setAttribute('aria-selected', String(index === activeSuggestion)));
    if (choices[activeSuggestion]) {
      query.setAttribute('aria-activedescendant', choices[activeSuggestion].id);
      choices[activeSuggestion].scrollIntoView?.({ block: 'nearest' });
    } else query.removeAttribute('aria-activedescendant');
  }
  function hideSuggestions() {
    suggestionList.hidden = true; activeSuggestion = -1;
    query.setAttribute('aria-expanded', 'false'); query.removeAttribute('aria-activedescendant');
  }
  function renderSuggestions() {
    suggestions = documents ? getSearchSuggestions(documents, state) : [];
    activeSuggestion = -1; suggestionList.replaceChildren();
    const labels = { sections: 'Sections', categories: 'Categories', tags: 'Tags' };
    for (const kind of Object.keys(labels)) {
      const items = suggestions.map((item, index) => ({ item, index })).filter(({ item }) => item.kind === kind);
      if (!items.length) continue;
      const group = element('div', 'site-search-suggestion-group');
      group.setAttribute('role', 'group'); group.setAttribute('aria-label', labels[kind]);
      const heading = element('span', 'site-search-suggestion-label', labels[kind]); heading.setAttribute('aria-hidden', 'true');
      group.append(heading);
      for (const { item, index } of items) {
        const option = element('button', 'site-search-suggestion');
        option.type = 'button'; option.tabIndex = -1; option.id = `site-search-suggestion-${index}`;
        option.dataset.searchSuggestion = String(index);
        option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
        option.setAttribute('aria-label', `${kind === 'categories' ? 'Category' : kind === 'tags' ? 'Tag' : 'Section'} ${item.label}, ${item.count} results`);
        option.append(element('span', '', item.label), element('span', 'site-search-suggestion-count', String(item.count)));
        group.append(option);
      }
      suggestionList.append(group);
    }
    suggestionList.hidden = !suggestions.length || doc.activeElement !== query;
    query.setAttribute('aria-expanded', String(!suggestionList.hidden)); query.removeAttribute('aria-activedescendant');
  }
  function renderFilters(facets) {
    const parsed = parseSearchQuery(state.query);
    const active = {
      categories: [...new Set([...state.categories, ...parsed.categories])],
      tags: [...new Set([...state.tags, ...parsed.tags])],
      sections: [...new Set([...state.sections, ...parsed.sections])],
    };
    filters.replaceChildren();
    for (const kind of ['sections', 'categories', 'tags']) for (const value of active[kind]) {
      const label = facets[kind].find(item => same(item.value, value))?.label || value;
      const name = kind === 'tags' ? 'Tag' : kind === 'sections' ? 'Section' : 'Category';
      const chip = element('button', 'site-search-filter', `${name}: ${label} ×`);
      chip.type = 'button';
      chip.setAttribute('aria-label', `Remove ${name.toLowerCase()} ${label}`);
      chip.dataset.filterKind = kind;
      chip.dataset.filterValue = value;
      filters.append(chip);
    }
    filters.hidden = !filters.children.length;
    reset.disabled = !state.query && !active.categories.length && !active.tags.length && !active.sections.length;
    return active;
  }
  function render() {
    if (destroyed || !dialog.open || !documents) return;
    const facets = getSearchFacets(documents, state);
    renderFilters(facets);
    renderSuggestions();
    const found = searchDocuments(documents, state, 20);
    list.replaceChildren();
    for (const result of found.results) {
      const row = element('li');
      const link = element('a', 'site-search-result');
      link.href = result.url;
      link.dataset.searchResult = '';
      const title = element('span', 'site-search-result-title');
      highlight(title, result.title);
      const meta = element('span', 'site-search-result-meta');
      meta.append(element('span', 'site-search-category', result.categoryLabel), element('span', '', result.sectionLabel));
      if (result.sectionTitle) meta.append(element('span', '', `› ${result.sectionTitle}`));
      for (const value of result.tags.slice(0, 3)) meta.append(element('span', 'site-search-result-tag', value));
      const snippet = element('span', 'site-search-result-snippet');
      highlight(snippet, result.snippet || result.description || '');
      link.append(title, meta, snippet);
      row.append(link);
      list.append(row);
    }
    status.textContent = found.total ?
      `${found.total === found.results.length ? found.total : `${found.results.length} of ${found.total}`} result${found.total === 1 ? '' : 's'}` :
      'No matches. Try fewer words or remove a filter.';
    retry.hidden = true;
  }
  async function load() {
    if (documents) { render(); return; }
    status.textContent = 'Loading site search…';
    retry.hidden = true;
    if (!pending) pending = (async () => {
      const url = new URL(dialog.dataset.searchIndex, view.location.href);
      if (url.origin !== view.location.origin) throw new Error('Search index must be local.');
      const response = await view.fetch(url.href, { credentials: 'same-origin', cache: 'force-cache' });
      if (!response.ok) throw new Error('Search index unavailable.');
      return prepareDocuments(await response.json());
    })();
    try {
      const loaded = await pending;
      if (destroyed) return;
      documents = loaded;
      render();
    } catch {
      pending = null;
      if (destroyed || !dialog.open) return;
      list.replaceChildren();
      status.textContent = 'Search couldn’t load. Please try again.';
      retry.hidden = false;
    }
  }
  function open() {
    if (destroyed) return;
    if (dialog.open) { query.focus(); return; }
    if (doc.querySelector('dialog[open]')) return;
    opener = doc.activeElement;
    previousOverflow = { value: doc.body.style.getPropertyValue('overflow'), priority: doc.body.style.getPropertyPriority('overflow') };
    dialog.showModal();
    doc.body.style.setProperty('overflow', 'hidden');
    query.focus();
    load();
  }
  function restore() {
    hideSuggestions();
    if (previousOverflow) {
      if (previousOverflow.value) doc.body.style.setProperty('overflow', previousOverflow.value, previousOverflow.priority);
      else doc.body.style.removeProperty('overflow');
      previousOverflow = null;
    }
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }
  function onShortcut(event) {
    if (!isSearchShortcut(event) || (doc.querySelector('dialog[open]') && !dialog.open)) return;
    event.preventDefault();
    open();
  }
  function onInput() { state.query = query.value; render(); }
  function onQueryFocus() { if (dialog.open) renderSuggestions(); }
  function onReset() { state.query = ''; state.categories = []; state.tags = []; state.sections = []; query.value = ''; query.focus(); render(); }
  function onPointerDown(event) { if (event.target.closest('[data-search-suggestion]')) event.preventDefault(); }
  function onClick(event) {
    const suggestion = event.target.closest('[data-search-suggestion]');
    if (suggestion) { selectSuggestion(Number(suggestion.dataset.searchSuggestion)); return; }
    const chip = event.target.closest('[data-filter-kind]');
    if (chip) {
      const { filterKind: kind, filterValue: value } = chip.dataset;
      state[kind] = state[kind].filter(item => !same(item, value));
      state.query = removeQueryFilter(state.query, kind, value);
      query.value = state.query;
      query.focus(); render();
    } else if (event.target.closest('[data-search-close], [data-search-result]')) dialog.close();
    else if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    }
  }
  function onDialogKeydown(event) {
    // A search input otherwise consumes the first Escape to clear its value.
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault(); dialog.close(); return;
    }
    if (event.key === 'Tab' && !event.isComposing) {
      const focusable = Array.from(dialog.querySelectorAll('[data-search-query], [data-search-close], [data-search-reset], [data-search-retry], [data-filter-kind], [data-search-result]'))
        .filter(node => !node.disabled && !node.hidden && !node.closest('[hidden]') && node.tabIndex >= 0 && node.getClientRects().length);
      const destination = event.shiftKey && event.target === focusable[0] ? focusable.at(-1) :
        !event.shiftKey && event.target === focusable.at(-1) ? focusable[0] : null;
      if (destination) { event.preventDefault(); destination.focus(); }
      return;
    }
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const links = Array.from(list.querySelectorAll('[data-search-result]'));
    const index = links.indexOf(event.target.closest('[data-search-result]'));
    if (event.target === query && !suggestionList.hidden && suggestions.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const next = activeSuggestion + (event.key === 'ArrowDown' ? 1 : -1);
      if (next >= suggestions.length && links.length) { hideSuggestions(); links[0].focus(); }
      else { activeSuggestion = next < 0 ? suggestions.length - 1 : Math.min(next, suggestions.length - 1); updateSuggestionSelection(); }
    }
    else if (event.target === query && activeSuggestion >= 0 && !suggestionList.hidden && event.key === 'Enter') { event.preventDefault(); selectSuggestion(activeSuggestion); }
    else if (event.target === query && links.length && event.key === 'Enter') { event.preventDefault(); links[0].click(); }
    else if (event.target === query && links.length && event.key === 'ArrowDown') { event.preventDefault(); links[0].focus(); }
    else if (index >= 0 && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) query.focus();
      else links[Math.min(next, links.length - 1)].focus();
    }
  }
  const mac = /Mac|iPhone|iPad/.test(view.navigator?.platform || '');
  triggers.forEach(trigger => {
    trigger.hidden = false;
    const hint = trigger.querySelector('[data-search-shortcut]');
    if (hint) hint.textContent = mac ? '⌘ K' : 'Ctrl K';
    trigger.addEventListener('click', open);
  });
  view.addEventListener('keydown', onShortcut);
  query.addEventListener('input', onInput);
  query.addEventListener('focus', onQueryFocus);
  query.addEventListener('blur', hideSuggestions);
  reset.addEventListener('click', onReset);
  retry.addEventListener('click', load);
  dialog.addEventListener('click', onClick);
  dialog.addEventListener('pointerdown', onPointerDown);
  dialog.addEventListener('keydown', onDialogKeydown);
  dialog.addEventListener('close', restore);
  const controller = { open, destroy() {
    destroyed = true;
    if (dialog.open) dialog.close();
    restore();
    triggers.forEach(trigger => { trigger.hidden = true; trigger.removeEventListener('click', open); });
    view.removeEventListener('keydown', onShortcut);
    query.removeEventListener('input', onInput);
    query.removeEventListener('focus', onQueryFocus);
    query.removeEventListener('blur', hideSuggestions);
    reset.removeEventListener('click', onReset);
    retry.removeEventListener('click', load);
    dialog.removeEventListener('click', onClick);
    dialog.removeEventListener('pointerdown', onPointerDown);
    dialog.removeEventListener('keydown', onDialogKeydown);
    dialog.removeEventListener('close', restore);
    controllers.delete(doc);
  } };
  controllers.set(doc, controller);
  return controller;
}
