# Changelog

All notable changes to the "Caido Automate Payload Extractor" plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-20

### Added
* Automate attack run selector with live payload loading via QuickJS RPC.
* Exact 6-column table layout aligned with Caido Automate: `ID`, `Payload 1`, `Status`, `Length`, `Round-trip Time (ms)`, and `Request Sent At`.
* Interactive, dynamic column width resizing with persistent settings in localStorage.
* Alternating dark and light zebra striping for table rows with orange accent indicator on row selection.
* Color-coded HTTP status dropdown filter supporting `All`, `200 OK`, `2XX`, `3XX`, `4XX`, and `5XX`.
* Side-by-side split pane inspector:
  * Left pane: Real raw HTTP request with line numbers, syntax highlighting, and injected payload highlighting.
  * Right pane: Real raw HTTP response with line numbers, status code highlights, and response metrics (`bytes | ms`).
  * Toggle options for `Pretty` and `Raw` views (plus `Preview` for response bodies).
* Instant search input filtering across payload contents, raw requests, response bodies, IDs, and status codes.
* Payload deduplication toggle.
* Export capabilities:
  * Single-click clipboard copy formatted as a wordlist.
  * Download filtered payloads directly as a `.txt` wordlist file.
  * Row double-click to quickly copy a specific payload.
* Global keyboard shortcut: `Ctrl + Shift + C` (or `Cmd + Shift + C` on macOS) to instantly copy HTTP 200 OK payloads from the latest attack run.
* Command Palette integration (`automate-payload-extractor.quick-copy`).
* Native Caido graphite color theme (`#31333a`) with dark charcoal panel headers and borders.
