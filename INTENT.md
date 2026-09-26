# INTENT: nullmarks

## Name
`nullmarks`: null tracking, null infra. Repo `nullmarks`, served at `<username>.github.io/nullmarks/`.

## Purpose
A static bookmark launcher hosted on GitHub Pages. Visit, click a bookmark, leave. Every visit is a cold load, so first paint speed matters.

## Core flow
1. Drag and drop a browser-exported `bookmarks.html` (or `bookmarks.json`) onto the page.
2. The page parses it client-side and keeps only URLs (`a[href]`, `http(s)` only).
3. Entries are deduplicated, saved to localStorage, and rendered as a grid.
4. Export produces a new `previous` file. Committing it to the repo updates the shared base list.

## Data model
- Two separate localStorage stores: `previous` and `local`.
- Each store holds `data` and `deleted`.
- `previous` is rewritten from the committed `previous` file. `local` holds user imports and additions.
- Rendered list = deduplicated union of both stores, minus their `deleted` sets.
- A non-empty or changed `deleted` set proposes an export.
- Export = the "eternal" bookmark file, the repo's `previous` file, in the same shape the importer accepts.

## Repo and build
- The user's raw `bookmarks.html` is never committed.
- An optional initial `previous` file may be committed.
- CI builds the page from the `previous` file present in the repo, inlining it so there is no runtime fetch.
- CI validates the `previous` file before deploy.

## Scope decisions
- No sync across devices.
- Bookmarks are non-personal, so a public repo and shared origin are acceptable.
- No intermediate format: the raw browser export is the import format.
- Light CRUD on the localStorage data, plus export.
- Favicons are replaced by cheap generated color tiles.
- Target browser: Firefox. Safari is not a concern.

## README disclosures
- localStorage can be cleared by the browser (site-data clearing, Safari's inactivity policy, Firefox close-time cleanup).
- Starting fresh is quick: drop the external bookmark file again.
