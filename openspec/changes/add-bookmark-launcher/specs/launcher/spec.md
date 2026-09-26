# Spec Delta

## Purpose

The page a visitor sees: a fast-loading grid of bookmarks they can filter and open with a click or the keyboard.

## ADDED Requirements

### Requirement: Single self-contained page
The deployed page SHALL be one HTML file with its CSS, script, and bookmark data inline. Loading it MUST NOT trigger any other network request: no fonts, no favicons, no scripts, no data fetch.

#### Scenario: Cold load
- **WHEN** a visitor opens the page with an empty cache
- **THEN** the browser makes exactly one request, for the HTML document

### Requirement: Bookmark grid
The page SHALL render each bookmark of the merged view as a link showing its title (or its hostname when the title is empty) and a color tile. Activating the link SHALL open the URL in the same tab.

#### Scenario: Click a bookmark
- **WHEN** the user clicks a bookmark
- **THEN** the browser navigates to its URL in the current tab

#### Scenario: Untitled bookmark
- **WHEN** an entry has an empty title
- **THEN** its hostname is shown as the label

### Requirement: Generated color tiles
Each bookmark SHALL display a tile whose color is derived deterministically from its hostname and which shows the first letter of the label. No favicon SHALL be requested.

#### Scenario: Same host, same color
- **WHEN** two bookmarks share a hostname
- **THEN** their tiles have the same color on every load

### Requirement: Type to filter
Typing while no other input has focus SHALL focus the filter field. The grid SHALL show only entries whose title or URL contains the filter text, case-insensitively.

#### Scenario: Filter by text
- **WHEN** the user types `git` on the page
- **THEN** only entries whose title or URL contains "git" in any case are shown

### Requirement: Enter opens the first match
Pressing Enter in the filter field SHALL open the first shown entry in the current tab. When no entry is shown, Enter SHALL do nothing.

#### Scenario: Enter with matches
- **WHEN** the filter shows at least one entry and the user presses Enter
- **THEN** the browser navigates to the first shown entry

#### Scenario: Escape clears the filter
- **WHEN** the filter field has text and the user presses Escape
- **THEN** the filter is cleared and all entries are shown

### Requirement: Empty state
When the merged view is empty, the page SHALL show a hint to drop a bookmark file.

#### Scenario: No bookmarks
- **WHEN** both stores have no visible entries
- **THEN** the page shows "Drop your bookmarks.html or bookmarks.json here"
