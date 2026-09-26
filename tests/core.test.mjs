import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalize,
  collectJson,
  fromJson,
  fromAnchors,
  dedupe,
  merge,
  refreshPrevious,
  applyImport,
  addEntry,
  renameEntry,
  deleteEntry,
  needsExport,
  toPreviousJson,
  fnv1a,
  hashEntries,
  isStore,
} from '../src/core.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const empty = () => ({ data: [], deleted: [] });

test('normalize: lowercases scheme and host, adds root slash', () => {
  assert.equal(normalize('HTTPS://A.Example'), 'https://a.example/');
  assert.equal(normalize('http://a.example/Path'), 'http://a.example/Path');
  assert.equal(normalize('  https://a.example/x  '), 'https://a.example/x');
});

test('normalize: keeps query and fragment', () => {
  assert.equal(normalize('https://a.example/app#/route?x=1'), 'https://a.example/app#/route?x=1');
});

test('normalize: rejects non-http schemes', () => {
  for (const url of ['javascript:alert(1)', 'place:sort=8', 'ftp://c.example', 'file:///etc', 'about:blank', 'data:,x']) {
    assert.equal(normalize(url), null, url);
  }
});

test('normalize: rejects invalid input', () => {
  for (const url of ['', 'not a url', '/relative', 'https://', null, undefined, 42]) {
    assert.equal(normalize(url), null, String(url));
  }
});

test('fromJson: Firefox backup keeps http(s) entries in order', () => {
  assert.deepEqual(fromJson(fixture('firefox-backup.json')), [
    { url: 'https://www.mozilla.org/', title: 'Mozilla' },
    { url: 'https://github.com/', title: 'GitHub' },
  ]);
});

test('fromJson: Chrome Bookmarks uses url and name', () => {
  assert.deepEqual(fromJson(fixture('chrome-bookmarks.json')), [
    { url: 'http://example.com/a?b=1#c', title: 'Example' },
    { url: 'https://developer.mozilla.org/en-US/', title: 'Docs' },
  ]);
});

test('fromJson: reads a nullmarks previous.json export', () => {
  assert.deepEqual(fromJson(fixture('previous-export.json')), [
    { url: 'https://a.example/', title: 'A' },
    { url: 'https://b.example/path', title: '' },
  ]);
});

test('fromJson: tolerates scalars and empty documents', () => {
  assert.deepEqual(fromJson(null), []);
  assert.deepEqual(fromJson(42), []);
  assert.deepEqual(fromJson([]), []);
});

test('collectJson: returns raw URLs for validation', () => {
  assert.deepEqual(
    collectJson(fixture('invalid-scheme.json')).map((e) => e.url),
    ['https://a.example/', 'javascript:alert(1)'],
  );
});

test('fromAnchors: normalizes, trims titles and drops other schemes', () => {
  assert.deepEqual(
    fromAnchors([
      { href: 'https://A.example', text: '  A  ' },
      { href: 'javascript:alert(1)', text: 'x' },
      { href: 'place:sort=8', text: 'y' },
      { href: 'http://b.example/', text: '' },
    ]),
    [
      { url: 'https://a.example/', title: 'A' },
      { url: 'http://b.example/', title: '' },
    ],
  );
});

test('dedupe: Same URL twice keeps first position and first non-empty title', () => {
  const entries = fromAnchors([
    { href: 'https://A.example', text: '' },
    { href: 'https://b.example/', text: 'B' },
    { href: 'https://a.example/', text: 'A' },
    { href: 'https://a.example/', text: 'Later' },
  ]);
  assert.deepEqual(dedupe(entries), [
    { url: 'https://a.example/', title: 'A' },
    { url: 'https://b.example/', title: 'B' },
  ]);
});

test('merge: previous first, then local-only, local title wins', () => {
  const previous = { data: [{ url: 'https://a.example/', title: 'A' }, { url: 'https://p.example/', title: 'P' }], deleted: [] };
  const local = { data: [{ url: 'https://l.example/', title: 'L' }, { url: 'https://a.example/', title: 'Alpha' }], deleted: [] };
  assert.deepEqual(merge(previous, local), [
    { url: 'https://a.example/', title: 'Alpha' },
    { url: 'https://p.example/', title: 'P' },
    { url: 'https://l.example/', title: 'L' },
  ]);
});

test('merge: an empty local title does not hide the previous title', () => {
  const previous = { data: [{ url: 'https://a.example/', title: 'A' }], deleted: [] };
  const local = { data: [{ url: 'https://a.example/', title: '' }], deleted: [] };
  assert.deepEqual(merge(previous, local), [{ url: 'https://a.example/', title: 'A' }]);
});

test('merge: filters each store by its own deleted set', () => {
  const previous = { data: [{ url: 'https://a.example/', title: 'A' }, { url: 'https://b.example/', title: 'B' }], deleted: ['https://a.example/'] };
  const local = { data: [{ url: 'https://c.example/', title: 'C' }, { url: 'https://b.example/', title: 'Bee' }], deleted: ['https://c.example/'] };
  assert.deepEqual(merge(previous, local), [{ url: 'https://b.example/', title: 'Bee' }]);
});

test('merge: does not mutate its inputs', () => {
  const previous = { data: [{ url: 'https://a.example/', title: 'A' }], deleted: [] };
  const local = { data: [{ url: 'https://a.example/', title: 'Alpha' }], deleted: [] };
  merge(previous, local);
  assert.equal(previous.data[0].title, 'A');
});

test('refreshPrevious: first visit stores the inlined data', () => {
  const inlined = { hash: 'h1', data: [{ url: 'https://a.example/', title: 'A' }] };
  const { store, changed } = refreshPrevious(null, inlined);
  assert.equal(changed, true);
  assert.deepEqual(store, { hash: 'h1', data: inlined.data, deleted: [] });
});

test('refreshPrevious: Redeploy with a deletion applied prunes deleted', () => {
  const stored = {
    hash: 'old',
    data: [{ url: 'https://a.example/', title: 'A' }, { url: 'https://b.example/', title: 'B' }],
    deleted: ['https://a.example/', 'https://b.example/'],
  };
  const inlined = { hash: 'new', data: [{ url: 'https://b.example/', title: 'B' }] };
  const { store, changed } = refreshPrevious(stored, inlined);
  assert.equal(changed, true);
  assert.deepEqual(store.data, inlined.data);
  assert.deepEqual(store.deleted, ['https://b.example/']);
});

test('refreshPrevious: Unchanged deploy leaves the store alone', () => {
  const stored = { hash: 'same', data: [{ url: 'https://a.example/', title: 'A' }], deleted: ['https://a.example/'] };
  const { store, changed } = refreshPrevious(stored, { hash: 'same', data: [] });
  assert.equal(changed, false);
  assert.equal(store, stored);
});

test('applyImport: adds new URLs to local and counts newly visible entries', () => {
  const previous = { hash: 'h', data: [{ url: 'https://a.example/', title: 'A' }], deleted: [] };
  const local = { data: [{ url: 'https://l.example/', title: 'L' }], deleted: [] };
  const entries = [
    { url: 'https://a.example/', title: 'A2' },
    { url: 'https://l.example/', title: 'L2' },
    { url: 'https://n.example/', title: 'N' },
  ];
  const result = applyImport(previous, local, entries);
  assert.equal(result.added, 1);
  assert.deepEqual(result.local.data.map((e) => e.url), ['https://l.example/', 'https://a.example/', 'https://n.example/']);
  assert.equal(result.local.data[0].title, 'L', 'existing local entries are not duplicated or changed');
  assert.equal(result.previous.hash, 'h');
});

test('applyImport: Re-import after deletion restores the URL', () => {
  const url = 'https://a.example/';
  let previous = { hash: 'h', data: [{ url, title: 'A' }], deleted: [] };
  let local = { data: [{ url, title: 'A' }], deleted: [] };
  ({ previous, local } = deleteEntry(previous, local, url));
  assert.deepEqual(merge(previous, local), []);
  const result = applyImport(previous, local, [{ url, title: 'A' }]);
  assert.deepEqual(merge(result.previous, result.local), [{ url, title: 'A' }]);
  assert.deepEqual(result.previous.deleted, []);
  assert.deepEqual(result.local.deleted, []);
  assert.equal(result.added, 1);
});

test('addEntry: Add a bookmark normalizes and saves to local', () => {
  const { local, url } = addEntry(empty(), empty(), 'https://b.example', ' B ');
  assert.equal(url, 'https://b.example/');
  assert.deepEqual(local.data, [{ url: 'https://b.example/', title: 'B' }]);
});

test('addEntry: Reject non-http URL', () => {
  assert.throws(() => addEntry(empty(), empty(), 'ftp://c.example', 'C'), /http/);
});

test('addEntry: an empty title keeps the existing title', () => {
  const local = { data: [{ url: 'https://b.example/', title: 'B' }], deleted: [] };
  assert.deepEqual(addEntry(empty(), local, 'https://b.example/', '').local.data, local.data);
});

test('renameEntry: Edit a title of a previous entry creates a local entry', () => {
  const previous = { data: [{ url: 'https://a.example/', title: 'A' }], deleted: [] };
  const local = renameEntry(empty(), 'https://a.example/', 'Alpha');
  assert.deepEqual(local.data, [{ url: 'https://a.example/', title: 'Alpha' }]);
  assert.deepEqual(merge(previous, local), [{ url: 'https://a.example/', title: 'Alpha' }]);
});

test('renameEntry: updates an existing local entry in place', () => {
  const local = { data: [{ url: 'https://a.example/', title: 'A' }, { url: 'https://b.example/', title: 'B' }], deleted: [] };
  assert.deepEqual(renameEntry(local, 'https://a.example/', 'Z').data.map((e) => e.title), ['Z', 'B']);
});

test('deleteEntry: Delete a URL present in both stores', () => {
  const url = 'https://a.example/';
  const previous = { hash: 'h', data: [{ url, title: 'A' }], deleted: [] };
  const local = { data: [{ url, title: 'Alpha' }], deleted: [] };
  const result = deleteEntry(previous, local, url);
  assert.deepEqual(result.previous.deleted, [url]);
  assert.deepEqual(result.local.deleted, [url]);
  assert.equal(result.previous.hash, 'h');
  assert.deepEqual(merge(result.previous, result.local), []);
});

test('deleteEntry: only marks stores that hold the URL, without duplicates', () => {
  const url = 'https://a.example/';
  const previous = { data: [{ url, title: 'A' }], deleted: [url] };
  const result = deleteEntry(previous, empty(), url);
  assert.deepEqual(result.previous.deleted, [url]);
  assert.deepEqual(result.local.deleted, []);
});

test('needsExport: Deletion triggers prompt, export clears it', () => {
  const url = 'https://a.example/';
  const previous = { data: [{ url, title: 'A' }, { url: 'https://b.example/', title: 'B' }], deleted: [] };
  assert.equal(needsExport(previous, empty(), null), false, 'no deletions, no prompt');
  const deleted = deleteEntry(previous, empty(), url);
  assert.equal(needsExport(deleted.previous, deleted.local, null), true);
  const exported = hashEntries(merge(deleted.previous, deleted.local));
  assert.equal(needsExport(deleted.previous, deleted.local, exported), false);
});

test('needsExport: Prompt clears after redeploy of the exported file', () => {
  const url = 'https://a.example/';
  const initial = { hash: 'old', data: [{ url, title: 'A' }, { url: 'https://b.example/', title: 'B' }], deleted: [] };
  const { previous } = deleteEntry(initial, empty(), url);
  const view = merge(previous, empty());
  const exportedHash = hashEntries(view);
  const redeployed = fromJson(toPreviousJson(view));
  const { store } = refreshPrevious(previous, { hash: hashEntries(redeployed), data: redeployed });
  assert.deepEqual(store.deleted, []);
  assert.equal(needsExport(store, empty(), exportedHash), false);
});

test('toPreviousJson: round trip through fromJson', () => {
  const entries = [
    { url: 'https://a.example/', title: 'A' },
    { url: 'https://b.example/x?y#z', title: '' },
    { url: 'http://c.example/', title: 'Ç "quoted" </script>' },
  ];
  assert.deepEqual(fromJson(toPreviousJson(entries)), entries);
  assert.deepEqual(fromJson(JSON.parse(JSON.stringify(toPreviousJson(entries), null, 2))), entries);
});

test('toPreviousJson: Firefox backup shape', () => {
  assert.deepEqual(toPreviousJson([{ url: 'https://a.example/', title: 'A' }]), {
    type: 'text/x-moz-place-container',
    title: 'nullmarks',
    children: [{ type: 'text/x-moz-place', title: 'A', uri: 'https://a.example/' }],
  });
});

test('fnv1a: matches reference vectors', () => {
  assert.equal(fnv1a(''), 0x811c9dc5);
  assert.equal(fnv1a('a'), 0xe40c292c);
  assert.equal(fnv1a('foobar'), 0xbf9cf968);
});

test('hashEntries: stable and sensitive to order and title', () => {
  const a = { url: 'https://a.example/', title: 'A' };
  const b = { url: 'https://b.example/', title: 'B' };
  assert.match(hashEntries([a, b]), /^[0-9a-f]{8}$/);
  assert.equal(hashEntries([a, b]), hashEntries([{ ...a }, { ...b }]));
  assert.notEqual(hashEntries([a, b]), hashEntries([b, a]));
  assert.notEqual(hashEntries([a]), hashEntries([{ ...a, title: 'X' }]));
});

test('isStore: accepts valid shapes and rejects corrupt ones', () => {
  assert.equal(isStore({ data: [], deleted: [] }, false), true);
  assert.equal(isStore({ hash: 'h', data: [{ url: 'u', title: '' }], deleted: ['u'] }, true), true);
  assert.equal(isStore({ data: [], deleted: [] }, true), false);
  assert.equal(isStore({ data: [{ url: 1, title: '' }], deleted: [] }, false), false);
  assert.equal(isStore({ data: [null], deleted: [] }, false), false);
  assert.equal(isStore({ data: [], deleted: [1] }, false), false);
  assert.equal(isStore('x', false), false);
  assert.equal(isStore(null, false), false);
});
