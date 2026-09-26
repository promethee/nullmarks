import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeJsonForHtml, loadPrevious, parsePrevious, renderPage } from '../scripts/build.mjs';
import { hashEntries } from '../src/core.js';

const fixturePath = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const repoPath = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const BUILD = repoPath('scripts/build.mjs');

/** Runs the real build CLI against a fixture into a temporary directory. */
function runBuild(previousFile) {
  const outDir = mkdtempSync(join(tmpdir(), 'nullmarks-'));
  const result = spawnSync(process.execPath, [BUILD, previousFile, outDir], { encoding: 'utf8' });
  const read = () => readFileSync(join(outDir, 'index.html'), 'utf8');
  return { ...result, read, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

/** Extracts the inlined data block from a built page. */
function dataBlock(html) {
  const match = html.match(/<script id="previous" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'data block present');
  return match[1];
}

test('parsePrevious: Invalid scheme names the URL', () => {
  assert.throws(() => loadPrevious(fixturePath('invalid-scheme.json')), /javascript:alert\(1\)/);
});

test('parsePrevious: Duplicate URL names the normalized URL', () => {
  assert.throws(() => loadPrevious(fixturePath('duplicate.json')), /duplicate URL: https:\/\/a\.example\/$/);
});

test('parsePrevious: invalid JSON reports the parse error', () => {
  assert.throws(() => loadPrevious(fixturePath('not-json.json')), /not valid JSON/);
});

test('loadPrevious: No previous file gives an empty list', () => {
  const previous = loadPrevious(fixturePath('does-not-exist.json'));
  assert.deepEqual(previous, { hash: hashEntries([]), data: [] });
});

test('parsePrevious: normalizes URLs and hashes the entries', () => {
  const previous = parsePrevious(JSON.stringify({ children: [{ uri: 'HTTPS://A.example', title: 'A' }] }));
  assert.deepEqual(previous.data, [{ url: 'https://a.example/', title: 'A' }]);
  assert.equal(previous.hash, hashEntries(previous.data));
});

test('escapeJsonForHtml: escapes <, U+2028 and U+2029 and still parses', () => {
  const value = { t: '</script><!-- \u2028\u2029' };
  const escaped = escapeJsonForHtml(value);
  assert.doesNotMatch(escaped, /[<\u2028\u2029]/);
  assert.deepEqual(JSON.parse(escaped), value);
});

test('renderPage: strips export keywords and keeps $ sequences literal', () => {
  const html = renderPage(
    '<script id="previous" type="application/json">/*PREVIOUS*/</script><script>/*CORE*/</script>',
    'export function f() { return "$&"; }\nexport const X = 1;',
    { hash: 'h', data: [{ url: 'https://a.example/', title: '$& $1 /*CORE*/' }] },
  );
  assert.match(html, /<script>function f\(\) \{ return "\$&"; \}\nconst X = 1;<\/script>/);
  assert.equal(JSON.parse(dataBlock(html)).data[0].title, '$& $1 /*CORE*/');
});

test('renderPage: rejects a template without placeholders', () => {
  assert.throws(() => renderPage('<html></html>', '', { hash: 'h', data: [] }), /PREVIOUS/);
});

test('build CLI: Hostile title builds without breaking out of the data block', (t) => {
  const run = runBuild(fixturePath('hostile-title.json'));
  t.after(run.cleanup);
  assert.equal(run.status, 0, run.stderr);
  const html = run.read();
  const block = dataBlock(html);
  assert.doesNotMatch(block, /<\/script|<!--/i);
  const data = JSON.parse(block);
  assert.equal(data.data[0].title, readHostileTitle());
  // Only the page's own two script elements exist: the data block and the app.
  assert.equal(html.match(/<script\b/gi).length, 2);
});

test('build CLI: Invalid scheme exits non-zero naming the URL', (t) => {
  const run = runBuild(fixturePath('invalid-scheme.json'));
  t.after(run.cleanup);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /javascript:alert\(1\)/);
});

test('build CLI: Duplicate URL exits non-zero naming the URL', (t) => {
  const run = runBuild(fixturePath('duplicate.json'));
  t.after(run.cleanup);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /https:\/\/a\.example\//);
});

test('build CLI: No previous file builds an empty page', (t) => {
  const run = runBuild(fixturePath('does-not-exist.json'));
  t.after(run.cleanup);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(dataBlock(run.read())).data, []);
});

test('build CLI: the committed previous.json is valid', (t) => {
  const run = runBuild(repoPath('previous.json'));
  t.after(run.cleanup);
  assert.equal(run.status, 0, run.stderr);
});

test('built page: loads nothing but itself', (t) => {
  const run = runBuild(repoPath('previous.json'));
  t.after(run.cleanup);
  const html = run.read();
  assert.doesNotMatch(html, /<[a-z]+[^>]*\ssrc=|<link(?![^>]*href="data:)[^>]*>/i, 'no external elements');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.doesNotMatch(css, /@import|url\(/i, 'no external CSS resources');
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/, 'favicon request suppressed');
});

function readHostileTitle() {
  return JSON.parse(readFileSync(fixturePath('hostile-title.json'), 'utf8')).children[0].title;
}
