# Design

## Context

Greenfield: the repo has only `README.md`, `INTENT.md`, `LICENSE`, and `.gitattributes`. The target browser is Firefox, and every visit is a cold load. See proposal.md for the motivation and the specs for the required behavior.

## Goals / Non-Goals

**Goals:**
- One HTML response per visit, with the page usable on first paint.
- Zero runtime dependencies and no bundler; the build is a single Node script with no npm installs.
- `previous.json` is human-diffable in PRs.

**Non-Goals:**
- Folders, tags, or preserving the browser's bookmark hierarchy. Import flattens it.
- Sync, accounts, favicons, service worker, or offline caching.
- Automated browser tests. Verification is a Node test of the pure functions plus a manual checklist.

## Decisions

**D1. File layout.** `src/index.html` holds the markup, CSS, and script inline, with one placeholder `<script id="previous" type="application/json">/*PREVIOUS*/</script>`. `scripts/build.mjs` writes `dist/index.html`. Pure logic (URL normalization, parsing, merging, export shape) lives in `src/core.js`, which the build inlines into the page and which Node tests can import. *Alternative:* one monolithic HTML file. Rejected because the logic could not then be unit-tested without a browser.

**D2. `previous.json` format = Firefox bookmark backup JSON.** It is a root `text/x-moz-place-container` with one flat `children` array of `{ "type": "text/x-moz-place", "title", "uri" }`, pretty-printed with one entry per line group. This satisfies "no intermediate format": Firefox can restore it directly, and the importer's generic `uri`/`url` walk reads it. *Alternative:* Netscape HTML. Rejected because it is noisier to diff and harder to validate in Node without a DOM parser.

**D3. JSON import walks the tree.** A recursive walk collects any object with a string `uri` (Firefox) or `url` (Chrome), titled by `title` or `name`. This covers Firefox backups, Chrome's `Bookmarks` file, and our own exports with one code path.

**D4. HTML import uses `DOMParser`.** Parse as `text/html`, then read `a[href]`. Parsing is inert (no script runs, no resources load), so a hostile export cannot execute code.

**D5. Normalization key = `new URL(u).href`.** This lowercases the scheme and host, adds the root `/`, and resolves percent-encoding. Fragments and query strings are kept, because they often matter (SPA routes). *Alternative:* stripping a trailing slash or `www.`. Rejected because it can merge distinct pages.

**D6. localStorage keys.** `nullmarks.previous` = `{ hash, data, deleted[] }`, `nullmarks.local` = `{ data, deleted[] }`, and `nullmarks.exported` = hash of the last exported merged view. `hash` is a cheap FNV-1a over the canonical JSON, computed by the build for `previous` and in the page for export tracking. On load, if the inlined hash is not equal to the stored hash, the page refreshes `previous` per spec.

**D7. Safe inlining.** The build serializes entries with `JSON.stringify`, then escapes `<` as `<`, and also escapes ` ` and ` `, before substituting the placeholder. The page reads the data with `JSON.parse(el.textContent)`. Entries render via `textContent` and `href` assignment only, never `innerHTML`.

**D8. Color tile.** Hue = FNV-1a(hostname) mod 360, with fixed saturation and lightness chosen for white-letter contrast. The tile shows the uppercased first letter of the label. Tiles are plain CSS, with no canvas and no images.

**D9. First paint.** CSS sits in `<head>`. The script is placed at the end of `<body>` and renders synchronously from inlined data plus localStorage. With a few thousand entries, a single `DocumentFragment` append stays well under a frame budget. No framework.

**D10. CRUD UI.** Each tile gets a small overflow control that reveals edit and delete on hover or focus. A header bar holds the filter field, an add button, and the export button. There is no modal library; a native `<dialog>` handles add and edit.

**D11. CI.** `.github/workflows/pages.yml` runs on push to `main` and on manual dispatch. It uses `actions/setup-node` with Node 22, runs `node --test` and then `node scripts/build.mjs`, and deploys with `actions/upload-pages-artifact` plus `actions/deploy-pages`. A failing test or validation stops the job before upload.

## Risks / Trade-offs

- [localStorage cleared by the browser] → The README documents it. Re-dropping the export restores everything quickly, and `previous` always comes back from the page itself.
- [Two browsers export different `previous.json` files] → No sync by design. The last commit wins, and git history keeps the other.
- [A large import, e.g. 10k entries, slows first paint] → A single fragment append is still fast. If it measures over ~50 ms in Firefox, the fix is to render the first screen and then idle-render the rest, deferred to a later change.
- [Flattening loses folder structure] → Accepted per INTENT: the launcher is a flat grid.
- [Hash collision makes a refresh be skipped] → FNV-1a over the full canonical JSON makes a collision negligible for this use.

## Migration Plan

1. Enable GitHub Pages with "Source: GitHub Actions" in the repo settings.
2. Merge. The first deploy ships an empty `previous.json`.
3. Drop the browser export on the live page, export, commit `previous.json`, and push.

Rollback: revert the commit. Pages redeploys the previous build.
