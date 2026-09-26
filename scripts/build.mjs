// Validates previous.json and inlines it, together with src/core.js, into
// src/index.html to produce the self-contained dist/index.html.
// Usage: node scripts/build.mjs [previous.json] [outDir]
// Both arguments default to the repo files; tests pass fixtures instead.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectJson, normalize, hashEntries } from '../src/core.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PREVIOUS_FILE = `${ROOT}previous.json`;
const TEMPLATE_FILE = `${ROOT}src/index.html`;
const CORE_FILE = `${ROOT}src/core.js`;
const OUT_DIR = `${ROOT}dist`;
const DATA_PLACEHOLDER = '/*PREVIOUS*/';
const CORE_PLACEHOLDER = '/*CORE*/';

/**
 * Parses and validates the text of a previous.json file.
 * @param {string} text
 * @returns {{ hash: string, data: Array<{ url: string, title: string }> }}
 */
export function parsePrevious(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    throw new Error(`previous.json is not valid JSON: ${error.message}`);
  }
  const data = [];
  const seen = new Set();
  for (const { url: raw, title } of collectJson(doc)) {
    const url = normalize(raw);
    if (url === null) throw new Error(`previous.json contains a URL that is not http(s): ${raw}`);
    if (seen.has(url)) throw new Error(`previous.json contains a duplicate URL: ${url}`);
    seen.add(url);
    data.push({ url, title });
  }
  return { hash: hashEntries(data), data };
}

/**
 * Loads previous.json from `file`. A missing file means an empty list.
 * @param {string} file
 */
export function loadPrevious(file) {
  if (!existsSync(file)) return parsePrevious('[]');
  return parsePrevious(readFileSync(file, 'utf8'));
}

/**
 * Serializes data for a `<script type="application/json">` block so that no
 * title can close the element or open an HTML comment.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Produces the final page from the template, the core module source and the
 * validated previous data.
 * @param {string} template
 * @param {string} coreSource
 * @param {{ hash: string, data: Array<{ url: string, title: string }> }} previous
 * @returns {string}
 */
export function renderPage(template, coreSource, previous) {
  for (const placeholder of [DATA_PLACEHOLDER, CORE_PLACEHOLDER]) {
    if (template.split(placeholder).length !== 2) {
      throw new Error(`src/index.html must contain ${placeholder} exactly once`);
    }
  }
  const core = coreSource.replace(/^export\s+/gm, '');
  if (/<\/script|<!--/i.test(core) || core.includes(DATA_PLACEHOLDER)) {
    throw new Error(`src/core.js must not contain "</script", "<!--" or ${DATA_PLACEHOLDER}`);
  }
  // The data goes in last so a title can never match a placeholder, and
  // function replacements keep any `$` in the inserted text literal.
  return template
    .replace(CORE_PLACEHOLDER, () => core)
    .replace(DATA_PLACEHOLDER, () => escapeJsonForHtml(previous));
}

function main(previousFile = PREVIOUS_FILE, outDir = OUT_DIR) {
  try {
    const previous = loadPrevious(previousFile);
    const html = renderPage(readFileSync(TEMPLATE_FILE, 'utf8'), readFileSync(CORE_FILE, 'utf8'), previous);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(`${outDir}/index.html`, html);
    console.log(`Built ${outDir}/index.html with ${previous.data.length} previous entries (hash ${previous.hash}).`);
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2], process.argv[3]);
}
