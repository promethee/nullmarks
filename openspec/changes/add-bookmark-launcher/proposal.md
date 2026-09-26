# Proposal

## Why

The repo holds only docs. There is no page yet. nullmarks needs a static bookmark launcher on GitHub Pages that loads fast on every cold visit, works without a server or account, and keeps a shared base list (the `previous` file) in the repo.

## What Changes

- New single-page launcher at `<username>.github.io/nullmarks/` that renders bookmarks as a grid of links with generated color tiles.
- Client-side import by drag and drop of a browser-exported `bookmarks.html` or `bookmarks.json`, keeping only `http(s)` URLs and merging duplicates.
- Two localStorage stores, `previous` and `local`, each with `data` and `deleted`. The rendered list is their deduplicated union minus deletions.
- Light CRUD on bookmarks: add, edit title, delete.
- Type-to-filter and Enter-to-open, as the README already promises.
- Export writes a new `previous.json` that the importer can read back. The page prompts for an export when there are deletions that haven't been exported.
- Build script that validates `previous.json` and inlines it into the page, so the page makes no fetch at load.
- GitHub Actions workflow that validates, builds, and deploys to GitHub Pages.
- `.gitignore` entry so a raw `bookmarks.html` is never committed.

## Capabilities

### New Capabilities
- `bookmark-import`: parsing dropped browser exports into deduplicated http(s) bookmark entries.
- `bookmark-lists`: the `previous` and `local` stores, the merged view, deletions, and CRUD.
- `launcher`: rendering, color tiles, filtering, and keyboard opening; first-paint constraints.
- `previous-export`: producing the next `previous.json` and prompting when an export is due.
- `build-deploy`: validating and inlining `previous.json` and publishing to GitHub Pages.

### Modified Capabilities
- None. No specs exist yet.

## Impact

- New files: `src/index.html`, `scripts/build.mjs`, `previous.json`, `.github/workflows/pages.yml`, `.gitignore`.
- No runtime dependencies. The build script needs Node on CI only.
- GitHub Pages must be set to deploy from GitHub Actions in the repo settings.
- README: the Safari note is out of scope per INTENT and may be trimmed later. No behavior depends on it.
