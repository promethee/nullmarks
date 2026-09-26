# Spec Delta

## Purpose

Turns the committed `previous.json` into the published page on GitHub Pages, and refuses to deploy a `previous.json` that is invalid.

## ADDED Requirements

### Requirement: previous.json is validated before deploy
The build SHALL fail, and nothing SHALL be deployed, when `previous.json` is not valid JSON, contains an entry whose URL is not `http(s)`, or contains two entries with the same normalized URL. The failure message MUST name the offending URL or the parse error.

#### Scenario: Invalid scheme
- **WHEN** `previous.json` contains `javascript:alert(1)`
- **THEN** the build exits non-zero with a message naming that URL, and the deploy step does not run

#### Scenario: Duplicate URL
- **WHEN** `previous.json` contains `https://a.example` and `https://a.example/`
- **THEN** the build exits non-zero naming `https://a.example/`

### Requirement: previous.json is optional
When `previous.json` is absent, the build SHALL succeed and produce a page with an empty previous list.

#### Scenario: No previous file
- **WHEN** the repo has no `previous.json`
- **THEN** the build succeeds and the deployed page shows the empty state

### Requirement: previous.json is inlined
The build SHALL embed the validated entries in the page so the page needs no runtime fetch. Embedded data MUST NOT be able to break out of its script element.

#### Scenario: Hostile title
- **WHEN** an entry title contains `</script><script>alert(1)</script>`
- **THEN** the built page shows the title as text and runs no injected script

### Requirement: Deploy on push to main
A push to `main` SHALL run validation, build the page, and deploy it to GitHub Pages at `/nullmarks/`.

#### Scenario: Push with a new previous.json
- **WHEN** a commit changing `previous.json` is pushed to `main`
- **THEN** the site serves a page containing the new entries once the workflow succeeds

### Requirement: Raw exports are never committed
The repo SHALL ignore `bookmarks.html` and `bookmarks.json` files so a raw browser export is not committed by accident.

#### Scenario: Export left in the working tree
- **WHEN** `bookmarks.html` is in the repo folder
- **THEN** `git status` does not list it
