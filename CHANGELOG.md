# Changelog

All notable changes to the "Caido Automate Payload Extractor" plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.4] - 2026-09-20

### Added
* Master-Detail Inspector layout modeled after Caido's native HTTP History view.
* Syntax-highlighted HTTP request viewer featuring line numbering, golden yellow header keys (`#fec418`), purple method keywords (`#d2a8ff`), and cyan protocol tags (`#79c0ff`).
* Live payload inspector with line numbers and character count indicators.
* One-click copy buttons in the inspector header (`Copy Payload` and `Copy Request`).
* Filter chips bar under the toolbar with interactive status selectors (`All`, `200 OK`, `2XX`, `3XX`, `4XX`, `5XX`).
* Draggable and resizable divider between the table and inspector pane.
* Updated author URL and repository metadata to point to `https://github.com/infat0x`.

### Changed
* Refactored whole UI color scheme to Caido's authentic dark graphite and charcoal palette (`#181a1f`, `#202227`, `#24262c`, `#353842`), removing unwanted saturated blue backgrounds.
* Preserved standard method coloring: `GET` badge and table labels now use Caido's distinctive light blue (`#79c0ff`), while `POST` uses warm orange (`#ffab70`).
* Row selection indicator updated to display Caido's signature amber left bar (`#f0642f`).

### Fixed
* Fixed RPC argument mismatch in QuickJS backend where the first argument received was the internal context object rather than `runId`.
* Fixed Base64 payload decoding to handle standard RFC 4648 byte streams with full UTF-8 support.
* Extended backend GraphQL queries to extract request host, path, query parameters, and HTTP methods alongside response metrics.

---

## [1.0.3] - 2026-09-20

### Added
* Global shortcut (`Ctrl + Shift + C` / `Cmd + Shift + C`) for instantaneous 200 OK payload extraction from the latest attack run.
* Caido Command Palette integration (`automate-payload-extractor.quick-copy`).
* Substring search filter across extracted payload contents.

### Fixed
* Switched GraphQL query from connection cursors to `requestsByOffset` to reliably fetch runs up to 5,000 items.

---

## [1.0.2] - 2026-09-20

### Added
* Deduplication toggle to filter out duplicate reflected payloads before export.
* Export to wordlist file (`.txt`) feature.
* Live status bar displaying total, filtered, and unique payload counts.

---

## [1.0.1] - 2026-09-20

### Added
* Multi-payload support for pitchfork and cluster bomb attack types.
* Individual row copy button.

---

## [1.0.0] - 2026-09-20

### Added
* Initial public release of Automate Payload Extractor.
* Basic table view listing payloads and response status codes.
* Backend QuickJS RPC bridge for communicating with Caido Core engine.
* Automated packaging script (`scripts/package.py`).
