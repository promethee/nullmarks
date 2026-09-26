# nullmarks

A static bookmark launcher for GitHub Pages. Open it, click a bookmark, leave. No server, no account, no tracking.

## Usage

1. Export your bookmarks from your browser as `bookmarks.html` (Firefox and Chrome both support this), or use a `bookmarks.json`.
2. Drag the file onto the page. It is parsed in your browser and stored in localStorage.
3. Type to filter, press Enter to open a link.

Only `http` and `https` links are kept. Duplicates are merged. Your raw export is never uploaded or committed.

## Two lists

- **Previous**: the shared base list, committed to the repo as `previous.json` and inlined into the page at build time.
- **Local**: what you import or add in your own browser.

The page shows both, merged and deduplicated. Deleting a link is remembered per list.

## Updating the previous list

1. Edit your bookmarks in the page.
2. Click **Export** to download a new `previous.json`.
3. Replace `previous.json` in the repo and push. CI validates it and redeploys.

The page prompts you to export whenever you have unexported deletions.

## Limitations

- **No sync.** Each browser keeps its own local list. The previous list is the only shared data.
- **localStorage can be cleared.** Clearing site data wipes the local list. Safari also deletes site data after 7 days without a visit.
- **Firefox:** if "Delete cookies and site data when Firefox is closed" is on, add an exception for the site (Settings → Privacy & Security → Cookies and Site Data → Manage Exceptions → Allow).
- **Starting over is quick.** Drop your bookmark file again and wait a few seconds.
- Bookmarks in the previous list are public. Do not commit anything private.

## License

TBD
