# Spec Delta

## Purpose

Defines the two localStorage lists, `previous` (the committed base list) and `local` (this browser's additions), and how they combine into what the user sees.

## ADDED Requirements

### Requirement: Two stores with data and deleted
The page SHALL keep two localStorage stores named `previous` and `local`. Each store SHALL hold `data`, a list of entries with `url` and `title`, and `deleted`, a set of normalized URLs.

#### Scenario: First visit
- **WHEN** the page loads with empty localStorage
- **THEN** `previous.data` holds the entries of the inlined `previous.json`, and `local.data`, `local.deleted` and `previous.deleted` are empty

### Requirement: previous store follows the deployed previous file
On load, when the inlined `previous.json` differs from the one last stored, the page SHALL replace `previous.data` with the inlined entries and SHALL drop from `previous.deleted` every URL that is no longer in the new data. `local` MUST NOT be modified by this refresh.

#### Scenario: Redeploy with a deletion applied
- **WHEN** the user deleted `https://a.example/`, exported, committed, and the new build no longer contains it
- **THEN** after reload `previous.deleted` no longer contains `https://a.example/`

#### Scenario: Unchanged deploy
- **WHEN** the page loads and the inlined `previous.json` matches the stored one
- **THEN** `previous.data` and `previous.deleted` are left unchanged

### Requirement: Rendered list is the merged view
The rendered list SHALL be the union of `previous.data` minus `previous.deleted` and `local.data` minus `local.deleted`, deduplicated by normalized URL. Entries from `previous` SHALL come first in their stored order, followed by `local`-only entries in their stored order. When a URL is in both, the `local` title SHALL win.

#### Scenario: URL in both stores
- **WHEN** `https://a.example/` is in `previous.data` titled "A" and in `local.data` titled "Alpha"
- **THEN** it is shown once, titled "Alpha"

### Requirement: Delete hides the entry everywhere
Deleting an entry SHALL add its normalized URL to the `deleted` set of every store whose `data` contains it. The entry MUST NOT be rendered afterward.

#### Scenario: Delete a URL present in both stores
- **WHEN** the user deletes a URL present in both `previous.data` and `local.data`
- **THEN** the URL is added to both `previous.deleted` and `local.deleted` and is no longer shown

### Requirement: Add and edit entries
The user SHALL be able to add an entry by URL with an optional title, and edit the title of any shown entry. Added entries and edited titles SHALL be written to `local`. A URL that is not `http(s)` MUST be rejected with an error message.

#### Scenario: Add a bookmark
- **WHEN** the user adds `https://b.example` with title "B"
- **THEN** `https://b.example/` titled "B" is saved in `local.data` and shown

#### Scenario: Edit a title of a previous entry
- **WHEN** the user renames an entry that exists only in `previous`
- **THEN** a `local` entry with the same URL and the new title is saved, and the new title is shown

#### Scenario: Reject non-http URL
- **WHEN** the user adds `ftp://c.example`
- **THEN** the page shows an error and saves nothing

### Requirement: Storage failure is survivable
When localStorage is unavailable, throws, or holds unparseable data, the page SHALL still render the inlined `previous.json` entries and SHALL tell the user that changes cannot be saved.

#### Scenario: localStorage blocked
- **WHEN** localStorage access throws on load
- **THEN** the previous entries are shown along with a notice that changes will not persist
