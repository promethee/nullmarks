# Spec Delta

## Purpose

Produces the next version of the committed `previous.json` from what the page currently shows, and reminds the user when that file is out of date.

## ADDED Requirements

### Requirement: Export the merged view as previous.json
Export SHALL download a file named `previous.json` containing every entry of the merged view, in rendered order, as a Firefox bookmark-backup JSON document. The file MUST be importable by the page's own importer and MUST pass the build's validation.

#### Scenario: Export round trip
- **WHEN** the user exports and then drops the exported file on a fresh browser
- **THEN** the same URLs with the same titles are shown in the same order

#### Scenario: Export excludes deletions
- **WHEN** the user deleted `https://a.example/` and exports
- **THEN** the exported file does not contain `https://a.example/`

### Requirement: Export prompt
The page SHALL show an export prompt when either `deleted` set is non-empty and the merged view differs from the one last exported from this browser. The prompt SHALL disappear after an export and SHALL return when the merged view changes again.

#### Scenario: Deletion triggers prompt
- **WHEN** the user deletes an entry
- **THEN** the export prompt is shown

#### Scenario: Prompt clears after export
- **WHEN** the export prompt is shown and the user exports
- **THEN** the prompt is hidden

#### Scenario: Prompt clears after redeploy
- **WHEN** the exported file is committed and deployed and the user reloads
- **THEN** the deleted URLs are pruned from `previous.deleted` and the prompt is not shown
