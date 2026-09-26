// @ts-check
// Pure bookmark logic shared by the page, the build script and the tests.
// The build inlines this file into the page after stripping the `export`
// keywords, so it must stay free of imports, DOM access and anything that
// would close a script element (the build rejects such text).

/** @typedef {{ url: string, title: string }} Entry */
/** @typedef {{ data: Entry[], deleted: string[] }} Store */
/** @typedef {Store & { hash: string }} PreviousStore */
/** @typedef {{ hash: string, data: Entry[] }} Inlined */

const FIREFOX_CONTAINER = 'text/x-moz-place-container';
const FIREFOX_PLACE = 'text/x-moz-place';

/**
 * Returns the WHATWG serialization of an absolute http(s) URL, or null for
 * any other scheme or unparseable input.
 * @param {unknown} url
 * @returns {string | null}
 */
export function normalize(url) {
  if (typeof url !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return parsed.href;
}

/**
 * Collects every object carrying a string `uri` (Firefox) or `url` (Chrome)
 * from a parsed JSON document, in document order. URLs are returned raw,
 * without normalization or scheme filtering, so the build can report them.
 * @param {unknown} node
 * @param {Entry[]} [out]
 * @returns {Entry[]}
 */
export function collectJson(node, out = []) {
  if (Array.isArray(node)) {
    for (const child of node) collectJson(child, out);
    return out;
  }
  if (node === null || typeof node !== 'object') return out;
  const obj = /** @type {Record<string, unknown>} */ (node);
  const url = typeof obj.uri === 'string' ? obj.uri : typeof obj.url === 'string' ? obj.url : null;
  if (url !== null) {
    const title = typeof obj.title === 'string' ? obj.title : typeof obj.name === 'string' ? obj.name : '';
    out.push({ url, title: title.trim() });
  }
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === 'object') collectJson(value, out);
  }
  return out;
}

/**
 * Turns a parsed JSON bookmark document into normalized http(s) entries.
 * Handles Firefox backups, Chrome `Bookmarks` files and nullmarks exports.
 * @param {unknown} obj
 * @returns {Entry[]}
 */
export function fromJson(obj) {
  return keepHttp(collectJson(obj));
}

/**
 * Turns `{ href, text }` pairs read from `a[href]` elements into normalized
 * http(s) entries.
 * @param {Array<{ href: string, text: string }>} list
 * @returns {Entry[]}
 */
export function fromAnchors(list) {
  return keepHttp(list.map((a) => ({ url: a.href, title: (a.text || '').trim() })));
}

/**
 * @param {Entry[]} entries
 * @returns {Entry[]}
 */
function keepHttp(entries) {
  /** @type {Entry[]} */
  const out = [];
  for (const entry of entries) {
    const url = normalize(entry.url);
    if (url !== null) out.push({ url, title: entry.title });
  }
  return out;
}

/**
 * Removes duplicate URLs, keeping first-seen order and the first non-empty
 * title. Expects normalized URLs.
 * @param {Entry[]} entries
 * @returns {Entry[]}
 */
export function dedupe(entries) {
  /** @type {Map<string, Entry>} */
  const byUrl = new Map();
  for (const { url, title } of entries) {
    const seen = byUrl.get(url);
    if (!seen) byUrl.set(url, { url, title });
    else if (!seen.title && title) seen.title = title;
  }
  return [...byUrl.values()];
}

/**
 * Builds the rendered list: visible `previous` entries in stored order, then
 * visible `local`-only entries in stored order. When a URL is in both, a
 * non-empty `local` title wins.
 * @param {Store} previous
 * @param {Store} local
 * @returns {Entry[]}
 */
export function merge(previous, local) {
  /** @type {Map<string, Entry>} */
  const byUrl = new Map();
  const prevDeleted = new Set(previous.deleted);
  for (const { url, title } of previous.data) {
    if (!prevDeleted.has(url) && !byUrl.has(url)) byUrl.set(url, { url, title });
  }
  const localDeleted = new Set(local.deleted);
  for (const { url, title } of local.data) {
    if (localDeleted.has(url)) continue;
    const seen = byUrl.get(url);
    if (!seen) byUrl.set(url, { url, title });
    else if (title) seen.title = title;
  }
  return [...byUrl.values()];
}

/**
 * Brings the stored `previous` store in line with the inlined previous.json.
 * Unchanged hash: the stored store is returned as is. Otherwise the data is
 * replaced and deletions of URLs no longer present are pruned.
 * @param {PreviousStore | null} stored
 * @param {Inlined} inlined
 * @returns {{ store: PreviousStore, changed: boolean }}
 */
export function refreshPrevious(stored, inlined) {
  if (stored && stored.hash === inlined.hash) return { store: stored, changed: false };
  const urls = new Set(inlined.data.map((e) => e.url));
  const deleted = stored ? stored.deleted.filter((url) => urls.has(url)) : [];
  return { store: { hash: inlined.hash, data: inlined.data.map(copyEntry), deleted }, changed: true };
}

/**
 * Adds imported entries to `local`, un-deletes them in both stores and
 * reports how many URLs became visible that were not visible before.
 * @param {Store} previous
 * @param {Store} local
 * @param {Entry[]} entries normalized, deduplicated entries
 * @returns {{ previous: Store, local: Store, added: number }}
 */
export function applyImport(previous, local, entries) {
  const before = new Set(merge(previous, local).map((e) => e.url));
  const imported = new Set(entries.map((e) => e.url));
  const localUrls = new Set(local.data.map((e) => e.url));
  const nextLocal = {
    data: [...local.data.map(copyEntry), ...entries.filter((e) => !localUrls.has(e.url)).map(copyEntry)],
    deleted: local.deleted.filter((url) => !imported.has(url)),
  };
  const nextPrevious = { ...previous, deleted: previous.deleted.filter((url) => !imported.has(url)) };
  const added = merge(nextPrevious, nextLocal).filter((e) => !before.has(e.url)).length;
  return { previous: nextPrevious, local: nextLocal, added };
}

/**
 * Adds a bookmark to `local`, or updates its title when already there. A
 * re-added URL is un-deleted in both stores.
 * @param {Store} previous
 * @param {Store} local
 * @param {string} rawUrl
 * @param {string} title
 * @returns {{ previous: Store, local: Store, url: string }}
 */
export function addEntry(previous, local, rawUrl, title) {
  const url = normalize(rawUrl);
  if (url === null) throw new Error('Only http and https URLs can be added.');
  const { previous: nextPrevious, local: nextLocal } = applyImport(previous, local, [{ url, title: '' }]);
  const trimmed = title.trim();
  // An empty title keeps whatever title the URL already has.
  return { previous: nextPrevious, local: trimmed ? renameEntry(nextLocal, url, trimmed) : nextLocal, url };
}

/**
 * Sets the title of `url` in `local`, creating a `local` entry when the URL
 * only exists in `previous`.
 * @param {Store} local
 * @param {string} url normalized URL
 * @param {string} title
 * @returns {Store}
 */
export function renameEntry(local, url, title) {
  const exists = local.data.some((e) => e.url === url);
  const data = exists
    ? local.data.map((e) => (e.url === url ? { url, title } : copyEntry(e)))
    : [...local.data.map(copyEntry), { url, title }];
  return { data, deleted: [...local.deleted] };
}

/**
 * Hides `url` by adding it to the `deleted` set of every store holding it.
 * @param {Store} previous
 * @param {Store} local
 * @param {string} url normalized URL
 * @returns {{ previous: Store, local: Store }}
 */
export function deleteEntry(previous, local, url) {
  return { previous: markDeleted(previous, url), local: markDeleted(local, url) };
}

/**
 * @template {Store} S
 * @param {S} store
 * @param {string} url
 * @returns {S}
 */
function markDeleted(store, url) {
  if (!store.data.some((e) => e.url === url) || store.deleted.includes(url)) return store;
  return { ...store, deleted: [...store.deleted, url] };
}

/**
 * True when there are deletions and the merged view differs from the one
 * last exported from this browser.
 * @param {Store} previous
 * @param {Store} local
 * @param {string | null} exportedHash
 * @returns {boolean}
 */
export function needsExport(previous, local, exportedHash) {
  if (previous.deleted.length === 0 && local.deleted.length === 0) return false;
  return hashEntries(merge(previous, local)) !== exportedHash;
}

/**
 * Wraps entries as a flat Firefox bookmark-backup document, the format of
 * previous.json.
 * @param {Entry[]} entries
 */
export function toPreviousJson(entries) {
  return {
    type: FIREFOX_CONTAINER,
    title: 'nullmarks',
    children: entries.map((e) => ({ type: FIREFOX_PLACE, title: e.title, uri: e.url })),
  };
}

/**
 * 32-bit FNV-1a over the UTF-16 code units of `str`.
 * @param {string} str
 * @returns {number} unsigned 32-bit hash
 */
export function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Hash of the canonical JSON of a list, used to detect changes.
 * @param {Entry[]} entries
 * @returns {string} 8 hex digits
 */
export function hashEntries(entries) {
  const canonical = JSON.stringify(entries.map((e) => [e.url, e.title]));
  return fnv1a(canonical).toString(16).padStart(8, '0');
}

/**
 * Checks the shape of a store read back from localStorage.
 * @param {unknown} value
 * @param {boolean} withHash
 * @returns {boolean}
 */
export function isStore(value, withHash) {
  if (value === null || typeof value !== 'object') return false;
  const store = /** @type {Record<string, unknown>} */ (value);
  if (withHash && typeof store.hash !== 'string') return false;
  return (
    Array.isArray(store.data) &&
    store.data.every(
      (e) => e !== null && typeof e === 'object' && typeof e.url === 'string' && typeof e.title === 'string',
    ) &&
    Array.isArray(store.deleted) &&
    store.deleted.every((url) => typeof url === 'string')
  );
}

/**
 * @param {Entry} entry
 * @returns {Entry}
 */
function copyEntry(entry) {
  return { url: entry.url, title: entry.title };
}
