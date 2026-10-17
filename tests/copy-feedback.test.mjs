import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('assets/js/site.js');
const handlers = source.slice(source.indexOf('  function copyText('), source.indexOf('  function init()'));

function fixture({ clipboard = 'success', fallback = true } = {}) {
  function element(attrs = {}) {
    const classes = new Set();
    return {
      attrs: { ...attrs }, listeners: new Map(), textContent: '', style: {},
      classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      },
      set className(value) { classes.clear(); value.split(/\s+/).forEach(name => classes.add(name)); },
      getAttribute: name => attrs[name],
      setAttribute(name, value) { this.attrs[name] = value; },
      addEventListener(name, callback) { this.listeners.set(name, callback); },
      after(node) { this.status = node; },
      select() { this.selected = true; },
      remove() { this.removed = true; },
      focus(options) { this.focusOptions = options; },
    };
  }
  const status = element(), email = element({ 'data-copy-email': 'iliazlobin91@gmail.com' });
  email.parentElement = { querySelector: () => status };
  email.textContent = 'iliazlobin91@gmail.com';
  const headings = ['requirements', 'deep-dives'].map(id => Object.assign(element(), { id, textContent: id }));
  const content = { querySelectorAll: () => headings };
  const writes = [], fields = [], timers = new Map(), fragments = [];
  let nextTimer = 0;
  const doc = {
    querySelector: selector => selector === '[data-copy-email]' ? email : content,
    createElement: () => element(),
    body: { appendChild: field => fields.push(field) },
    execCommand: command => { assert.equal(command, 'copy'); return fallback; },
  };
  const navigator = {};
  if (clipboard !== 'unavailable') navigator.clipboard = {
    writeText(text) {
      writes.push(text);
      if (clipboard === 'throw') throw new Error('Unavailable');
      return clipboard === 'reject' ? Promise.reject(new Error('Denied')) : Promise.resolve();
    },
  };
  const context = vm.createContext({
    document: doc, navigator,
    window: { location: { origin: 'https://iliazlobin.com', pathname: '/designs/example/' } },
    history: { replaceState: (_, __, hash) => fragments.push(hash) },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(handlers, context);
  context.setupEmailCopy(); context.setupHeadingAnchors();
  return {
    context, doc, email, status, headings, writes, fields, timers, fragments,
    async click(node) { node.listeners.get('click')(); await Promise.resolve(); await Promise.resolve(); },
    expire() { for (const [id, { callback }] of [...timers]) { timers.delete(id); callback(); } },
  };
}

test('email copy confirms through an icon class and hidden announcement without changing address text', async () => {
  const dom = fixture();
  await dom.click(dom.email);
  assert.deepEqual(dom.writes, ['iliazlobin91@gmail.com']);
  assert.equal(dom.email.textContent, 'iliazlobin91@gmail.com');
  assert.ok(dom.email.classList.contains('copied'));
  assert.equal(dom.status.textContent, 'Email address copied');
  assert.ok(!dom.status.classList.contains('copy-error'));
  await dom.click(dom.email);
  assert.equal(dom.timers.size, 1, 'repeated copies replace, not race, feedback timers');
  dom.expire();
  assert.ok(!dom.email.classList.contains('copied'));
  assert.equal(dom.status.textContent, '');
});

test('heading copies keep their native fragments and independent icon timers without changing heading labels', async () => {
  const dom = fixture();
  for (const heading of dom.headings) await dom.click(heading);
  assert.deepEqual(dom.writes, dom.headings.map(h => `https://iliazlobin.com/designs/example/#${h.id}`));
  assert.deepEqual(dom.fragments, ['#requirements', '#deep-dives']);
  for (const heading of dom.headings) {
    assert.equal(heading.textContent, heading.id);
    assert.ok(heading.classList.contains('copied'));
    assert.ok(heading.status.classList.contains('copy-status'));
    assert.equal(heading.status.attrs.role, 'status');
    assert.equal(heading.status.attrs['aria-atomic'], 'true');
    assert.equal(heading.status.textContent, 'Section link copied');
  }
  await dom.click(dom.headings[0]);
  assert.equal(dom.timers.size, 2);
  dom.expire();
  assert.ok(dom.headings.every(h => !h.classList.contains('copied') && !h.status.textContent));
});

for (const clipboard of ['unavailable', 'reject', 'throw']) {
  test(`${clipboard} Clipboard API uses the shared fallback and cleans up selected fields`, async () => {
    const dom = fixture({ clipboard });
    await dom.click(dom.email); await dom.click(dom.headings[0]);
    assert.equal(dom.fields.length, 2);
    assert.ok(dom.fields.every(field => field.removed && field.selected && field.readOnly));
    assert.equal(dom.fields[0].value, 'iliazlobin91@gmail.com');
    assert.equal(dom.fields[1].value, 'https://iliazlobin.com/designs/example/#requirements');
    assert.ok(dom.email.classList.contains('copied'));
    assert.ok(dom.headings[0].classList.contains('copied'));
    assert.equal(dom.email.focusOptions.preventScroll, true);
  });
}

test('copy failure shows manual recovery help and never presents successful icon feedback', async () => {
  const dom = fixture({ clipboard: 'reject', fallback: false });
  await dom.click(dom.email); await dom.click(dom.headings[0]);
  assert.ok(!dom.email.classList.contains('copied'));
  assert.ok(!dom.headings[0].classList.contains('copied'));
  assert.ok(dom.status.classList.contains('copy-error'));
  assert.match(dom.status.textContent, /Select the address/);
  assert.match(dom.headings[0].status.textContent, /Use the address bar/);
  assert.ok([...dom.timers.values()].every(timer => timer.delay === 6000));
  dom.expire();
  assert.equal(dom.status.textContent, '');
  assert.ok(!dom.status.classList.contains('copy-error'));
});

test('copy handlers are harmless on pages without contact controls or post content', () => {
  const dom = fixture();
  dom.doc.querySelector = () => null;
  assert.doesNotThrow(() => { dom.context.setupEmailCopy(); dom.context.setupHeadingAnchors(); });
});

test('email and document headings share an icon, not visible success text or extra layout space', () => {
  const site = read('assets/css/site.css');
  const profile = read('assets/css/profile-contact.css');
  const blog = read('assets/css/blog.css');
  assert.match(site, /--copy-link-icon:\s*url\("data:image\/svg\+xml/);
  for (const css of [profile, blog]) {
    assert.match(css, /background:\s*var\(--copy-link-icon\)/);
    assert.match(css, /\.copied::before\s*\{\s*opacity:\s*1/);
    assert.doesNotMatch(css, /content:\s*["'][^"']*[Cc]opied/);
  }
  assert.doesNotMatch(blog, /\.copied::after/);
  assert.match(profile, /\.resume-email-copy::before\s*\{[^}]*position: absolute;/);
  assert.match(site, /\.copy-status\s*\{[^}]*width: 1px;[^}]*height: 1px;[^}]*clip-path: inset\(50%\)/);
  assert.match(site, /\.copy-status\.copy-error\s*\{[^}]*clip-path: none;/);
  assert.match(read('_includes/profile-contact.html'), /class="resume-email-status copy-status" role="status" aria-atomic="true"/);
  assert.match(read('assets/css/documents.css'), /:is\(h2, h3, h4\) \+ \.copy-status:not\(\.copy-error\) \+ :is\(h3, h4\)\s*\{\s*margin-top: \.75rem;/,
    'hidden heading announcements must preserve the existing compact subheading rhythm');
});
