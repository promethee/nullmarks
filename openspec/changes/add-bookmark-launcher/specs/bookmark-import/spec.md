# Spec Delta

## Purpose

Turns a browser's raw bookmark export, dropped onto the page, into a clean list of http(s) bookmarks without uploading anything.

## ADDED Requirements

### Requirement: Drop to import
The page SHALL accept a file dropped anywhere on the page and SHALL parse it entirely in the browser. The file contents MUST NOT be sent over the network.

#### Scenario: HTML export dropped
- **WHEN** the user drops a Netscape-format `bookmarks.html` exported by Firefox or Chrome
- **THEN** every `a[href]` in the file becomes a candidate entry, titled by the link text

#### Scenario: JSON export dropped
- **WHEN** the user drops a `.json` file (a Firefox bookmark backup, a Chrome `Bookmarks` file, or a `previous.json` exported by nullmarks)
- **THEN** every object carrying a `uri` or `url` string becomes a candidate entry, titled by its `title` or `name` field

#### Scenario: Unreadable file
- **WHEN** the dropped file is neither parseable HTML nor valid JSON, or yields zero candidate entries
- **THEN** the page shows an error message and leaves both stores unchanged

### Requirement: Only http and https URLs are kept
The importer SHALL keep only entries whose URL scheme is `http:` or `https:`. All other schemes (`place:`, `javascript:`, `file:`, `about:`, `data:`, and others) MUST be dropped.

#### Scenario: Mixed schemes
- **WHEN** a file contains `https://a.example/`, `javascript:alert(1)` and `place:sort=8`
- **THEN** only `https://a.example/` is imported

### Requirement: Duplicates are merged
The importer SHALL deduplicate entries by normalized URL, where normalization is the URL as serialized by the WHATWG URL parser. When duplicates have different titles, the first non-empty title encountered SHALL be kept.

#### Scenario: Same URL twice
- **WHEN** a file contains `https://A.example` titled "" and `https://a.example/` titled "A"
- **THEN** one entry `https://a.example/` titled "A" is imported

### Requirement: Imports go to the local store
Imported entries SHALL be added to the `local` store and SHALL be saved immediately. Entries already present in `local.data` MUST NOT be duplicated. An import of a URL present in a `deleted` set SHALL remove that URL from the `deleted` set, so re-importing restores it.

#### Scenario: Re-import after deletion
- **WHEN** the user deletes `https://a.example/` and then drops a file containing it
- **THEN** `https://a.example/` is shown again

#### Scenario: Import reports a count
- **WHEN** an import completes
- **THEN** the page shows how many new entries were added
