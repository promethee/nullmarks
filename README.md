# nullmarks

A static bookmark launcher for GitHub Pages. Open it, click a bookmark, leave. No server, no account, no tracking.

The whole page is one HTML file with its CSS, script and bookmark list inline, so a visit costs exactly one request.

## Usage

1. Export your bookmarks from your browser as `bookmarks.html` (Firefox and Chrome both support this), or use a `bookmarks.json` (a Firefox backup or Chrome's `Bookmarks` file).
2. Drag the file onto the page. It is parsed in your browser and stored in localStorage.
3. Type to filter, press Enter to open the first match, press Escape to clear the filter.

Only `http` and `https` links are kept. Duplicates are merged. Your raw export is never uploaded or committed: `bookmarks.html` and `bookmarks.json` are in `.gitignore`.

Hover a bookmark and use its **⋯** control to edit its title or delete it. **Add** creates a bookmark by hand.

## Two lists

- **Previous**: the shared base list, committed to the repo as `previous.json` and inlined into the page at build time.
- **Local**: what you import, add or rename in your own browser.

The page shows both, merged and deduplicated: previous entries first, then local-only entries. When a URL is in both, the local title wins. Deleting a link is remembered per list.

## Updating the previous list

1. Edit your bookmarks in the page.
2. Click **Export** to download a new `previous.json`.
3. Replace `previous.json` in the repo and push. CI validates it and redeploys.

`previous.json` is a Firefox bookmark-backup JSON file with one flat list, so it is easy to diff and the page can import it back. The page prompts you to export whenever you have deletions that are not in the last export.

## Setup

Requirements: [Node.js](https://nodejs.org/) 22 or later, for the tests and the build only. There are no npm dependencies, so there is nothing to install.

1. Fork or clone this repository and name it `nullmarks`.
2. In the repository on GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/pages.yml` runs the tests, validates `previous.json`, builds the page and deploys it to `https://<username>.github.io/nullmarks/`.

The first deploy ships the committed `previous.json`, which is empty. Drop your browser export on the live page, export, commit the new `previous.json`, and push.

## Development

```bash
npm test
```

```bash
npm run build
```

- `npm test` runs the unit tests in `tests/` with the built-in Node test runner.
- `npm run build` validates `previous.json` and writes `dist/index.html`. It exits non-zero and names the offending URL when `previous.json` has a non-http(s) URL or a duplicate. A missing `previous.json` builds an empty page.
- Open `dist/index.html` in a browser to try it. `node scripts/build.mjs <file.json> <outDir>` builds from another list.

| Path | Role |
| --- | --- |
| `src/core.js` | Pure logic: URL normalization, parsing, merging, export shape. Imported by the tests and the build, inlined into the page. |
| `src/index.html` | Page template: markup, CSS and the browser-side script. |
| `scripts/build.mjs` | Validates `previous.json`, inlines it and `core.js`, writes `dist/index.html`. |
| `tests/` | Unit tests and fixtures. |
| `MANUAL_TESTS.md` | Browser checks that the unit tests cannot cover. |

## Limitations

- **No sync.** Each browser keeps its own local list. The previous list is the only shared data.
- **localStorage can be cleared.** Clearing site data wipes the local list.
- **Firefox:** if "Delete cookies and site data when Firefox is closed" is on, add an exception for the site (Settings → Privacy & Security → Cookies and Site Data → Manage Exceptions → Allow).
- **Starting over is quick.** Drop your bookmark file again and wait a few seconds.
- **Folders are flattened.** The launcher is one flat grid.
- Bookmarks in the previous list are public. Do not commit anything private.

## License

TBD

## Built with

| Item | Value |
| --- | --- |
| LLM model | Claude Opus 5.5 (`claude-opus-5-5`), in Claude Code |
| Tokens used | About 160k tokens of context for the implementation session (estimate; the exact count is in the Claude Code usage view) |
| Time to complete | About 1 hour for the implementation session, on 2026-09-26 |
| Memory used | Not measured. The build and tests run in a single Node process in under a second. |
