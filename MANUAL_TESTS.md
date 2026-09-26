# Manual tests

These checks cover what the unit tests (`npm test`) cannot: the page in a real browser, and the deploy. Run them in **Firefox**, the target browser.

## Preparation

1. Run `npm run build`.
2. Build a sample page from the test fixture:

   ```bash
   node scripts/build.mjs tests/fixtures/previous-export.json dist
   ```

3. Open `dist/index.html` in Firefox, or the deployed site for section 9.
4. Before each section, clear the site data: press F12, open **Storage → Local Storage**, right-click the origin and choose **Delete All**, then reload.

Each step lists an action and the expected result.

## 1. Page and empty state

| # | Action | Expected |
| --- | --- | --- |
| 1.1 | Run `npm run build` with the committed empty `previous.json`, then open `dist/index.html` | The header shows the filter, **Add** and **Export**. The page reads "Drop your bookmarks.html or bookmarks.json here". |
| 1.2 | Open the sample page from the preparation step | Two bookmarks: "A" and "b.example" (the untitled entry shows its hostname). Each has a colored tile with its first letter. |
| 1.3 | Reload three times | Each tile keeps the same color. |
| 1.4 | Switch the OS to dark mode | The page uses a dark background and stays readable. |

## 2. Import by drag and drop

| # | Action | Expected |
| --- | --- | --- |
| 2.1 | In Firefox, **Bookmarks → Manage Bookmarks → Import and Backup → Export Bookmarks to HTML**. Drag the file onto the page | A dashed "Drop to import" frame appears while dragging. After the drop, the notice reads "Imported bookmarks.html: N new bookmarks added." and the grid shows your bookmarks. |
| 2.2 | Drop the same file again | The notice reads "0 new bookmarks added". No duplicates appear. |
| 2.3 | **Import and Backup → Backup…** to save a `.json` backup, and drop it | The import succeeds. Only `http(s)` links appear; no `place:` or `javascript:` entries. |
| 2.4 | Drop any image or `.zip` file | A red notice says no http(s) bookmarks were found. The grid is unchanged. |
| 2.5 | Drop a text file containing `{ nope` renamed to `bad.json` | A red notice says the file is not valid JSON. The grid is unchanged. |
| 2.6 | Press F12, **Network** tab, then drop a file | No network request is made. |

## 3. Filter and keyboard

| # | Action | Expected |
| --- | --- | --- |
| 3.1 | Click an empty area, then type `git` | The filter field gets focus and contains `git`. Only bookmarks whose title or URL contains "git", in any case, are shown. |
| 3.2 | Press Enter | The browser opens the first shown bookmark in the same tab. |
| 3.3 | Go back, type `zzzz` | "No bookmarks match." is shown. Pressing Enter does nothing. |
| 3.4 | Press Escape | The filter is cleared and all bookmarks are shown. |
| 3.5 | Click a bookmark | It opens in the same tab. |

## 4. Add, edit, delete

| # | Action | Expected |
| --- | --- | --- |
| 4.1 | Click **Add**, enter `https://b.example` and title `B`, press Enter | The dialog closes. "B" appears at the end of the grid. |
| 4.2 | Click **Add**, enter `ftp://c.example`, press Enter | The dialog stays open with "Only http and https URLs can be added." Nothing is added. |
| 4.3 | Click **Add**, then **Cancel** (or press Escape) | The dialog closes. Nothing changes. |
| 4.4 | Hover bookmark "A", hover its **⋯**, click **Edit**, change the title to `Alpha`, press Enter | The label changes to "Alpha" and stays after a reload. |
| 4.5 | Hover a bookmark, hover **⋯**, click **Delete** | The bookmark disappears and stays gone after a reload. The export prompt appears. |
| 4.6 | Delete a bookmark, then drop a file that contains it | The bookmark is shown again. |
| 4.7 | Press Tab until a **⋯** is focused, then Tab again | **Edit** and **Delete** are reachable by keyboard. |

## 5. Export

| # | Action | Expected |
| --- | --- | --- |
| 5.1 | Delete a bookmark | "You deleted bookmarks that are not reflected in previous.json yet." is shown with an **Export previous.json** button. |
| 5.2 | Click **Export previous.json** | A file named `previous.json` downloads. The prompt disappears and stays hidden after a reload. |
| 5.3 | Open the downloaded file | It is pretty-printed JSON, and the deleted bookmark is not in it. |
| 5.4 | Delete another bookmark | The prompt returns. |
| 5.5 | In a private window, open the page and drop the exported file | The same URLs are shown with the same titles in the same order. |
| 5.6 | Copy the export over `previous.json` and run `npm run build` | The build succeeds. |

## 6. Storage failure

| # | Action | Expected |
| --- | --- | --- |
| 6.1 | Open `about:config`, set `dom.storage.enabled` to `false`, reload the page | The previous bookmarks are shown with the notice "Storage is disabled in this browser: changes will not be saved." Set the preference back to `true` afterwards. |
| 6.2 | In the console, run `localStorage.setItem('nullmarks.local', '{bad')` and reload | The previous bookmarks are shown with "Saved bookmarks could not be read: changes will not be saved." Clear the site data afterwards. |

## 7. Security

| # | Action | Expected |
| --- | --- | --- |
| 7.1 | Run `node scripts/build.mjs tests/fixtures/hostile-title.json dist` and open the page | One bookmark whose label starts with `</script><script>alert(1)</script>` as plain text. No alert appears. |
| 7.2 | Save an HTML file containing `<a href="https://x.example/">x</a><script>alert(1)</script><img src=x onerror=alert(2)>` and drop it | "x" is imported. No alert appears. |

## 8. Build and deploy

| # | Action | Expected |
| --- | --- | --- |
| 8.1 | Run `node scripts/build.mjs tests/fixtures/invalid-scheme.json dist` | Exit code is non-zero and the message names `javascript:alert(1)`. |
| 8.2 | Run `node scripts/build.mjs tests/fixtures/duplicate.json dist` | Exit code is non-zero and the message names `https://a.example/`. |
| 8.3 | Create `bookmarks.html` in the repo folder and run `git status` | The file is not listed. |
| 8.4 | On a branch, commit a `previous.json` containing a `javascript:` URL, merge to `main` | The **Deploy to GitHub Pages** workflow fails at **Validate previous.json and build**. The deploy job does not run and the site is unchanged. Revert afterwards. |
| 8.5 | Push a valid `previous.json` change to `main` | The workflow succeeds and the site shows the new entries. |

## 9. End to end on the deployed site

| # | Action | Expected |
| --- | --- | --- |
| 9.1 | Open the site with F12 → **Network**, **Disable cache** checked, and reload | Exactly one request is listed: the HTML document. There are no favicon, font or script requests. |
| 9.2 | Drop your browser export, delete one entry, click **Export** | `previous.json` downloads and the prompt hides. |
| 9.3 | Commit the exported `previous.json`, push, wait for the workflow, reload | The deleted entry stays gone and the export prompt is not shown. |
