# Tasks

## 1. Repo setup

- [x] 1.1 Add `.gitignore` with `bookmarks.html`, `bookmarks.json`, `dist/`, `node_modules/`; verify `git status` hides a test `bookmarks.html`
- [x] 1.2 Add `package.json` (`"type": "module"`, no dependencies, scripts `build` and `test`) and an empty Firefox-backup `previous.json`; verify `node -e "JSON.parse(require('fs').readFileSync('previous.json'))"` succeeds

## 2. Core logic (`src/core.js`)

- [x] 2.1 Implement `normalize(url)` returning the WHATWG `href` for http(s) or `null` otherwise; verify tests cover case, trailing root slash, `javascript:`, `place:`, and invalid input
- [x] 2.2 Implement `fromJson(obj)`, a recursive walk over `uri`/`url` with `title`/`name`; verify tests pass against Firefox-backup, Chrome `Bookmarks`, and exported `previous.json` fixtures
- [x] 2.3 Implement `fromAnchors(list)` that turns `{href, text}` pairs into entries; verify the tests pass (the DOMParser call stays in the page)
- [x] 2.4 Implement `dedupe(entries)` that keeps first order and the first non-empty title; verify the "Same URL twice" scenario test
- [x] 2.5 Implement `merge(previous, local)` per the bookmark-lists "Rendered list" requirement; verify tests cover ordering, local-title-wins, and deleted filtering
- [x] 2.6 Implement `refreshPrevious(stored, inlined)` that prunes `deleted`; verify the "Redeploy with a deletion applied" and "Unchanged deploy" scenario tests
- [x] 2.7 Implement `toPreviousJson(entries)` and `fnv1a(str)`; verify with a round-trip test (`fromJson(toPreviousJson(x))` deep-equals `x`)

## 3. Build (`scripts/build.mjs`)

- [x] 3.1 Load `previous.json` (missing → empty), validate schemes and duplicates, and exit non-zero naming the offending URL; verify with fixture tests for invalid-scheme, duplicate, and missing-file cases
- [x] 3.2 Inline `core.js` (stripping `export`) and the escaped data plus hash into `src/index.html`, and write `dist/index.html`; verify the hostile-title fixture builds and `dist/index.html` contains no raw `</script>` inside the data block

## 4. Page (`src/index.html`)

- [x] 4.1 Add markup and CSS: a header with filter, add, and export controls, the grid, color tiles, an empty state, and a notice area; verify in Firefox that the empty build shows the drop hint
- [x] 4.2 Add a storage layer with try/catch around every read and write, and a fallback notice; verify that with `dom.storage.enabled=false` in Firefox the previous entries still render and the notice shows
- [x] 4.3 Add drag-and-drop import (HTML via DOMParser, JSON via `fromJson`) that writes to `local`, un-deletes re-imported URLs, and shows the added count; verify by dropping a real Firefox `bookmarks.html` and a `.json` backup
- [x] 4.4 Render the grid with a single fragment, `textContent` labels, and same-tab links; verify that clicking a tile navigates in the same tab
- [x] 4.5 Add filter behavior: type-anywhere focus, case-insensitive match on title or URL, Enter opens the first match, Escape clears; verify each launcher scenario manually
- [x] 4.6 Add add/edit via `<dialog>` and delete via the per-tile control; verify the add, rename-previous, reject-ftp, and delete-in-both scenarios
- [x] 4.7 Add export download and the export prompt driven by `nullmarks.exported`; verify the prompt appears after a delete and hides after export

## 5. CI and docs

- [ ] 5.1 Add `.github/workflows/pages.yml` (test, build, upload, deploy); verify a push to `main` publishes the page and a bad `previous.json` fails before deploy
- [x] 5.2 Update README: remove the Safari line, note that `previous.json` is a Firefox backup file, and add the Pages setup step; verify the README matches the specs

## 6. End-to-end check

- [ ] 6.1 In Firefox on the deployed site: drop an export, delete one entry, export, commit `previous.json`, push, reload; verify the entry stays gone, the prompt is gone, and the network panel shows one request
