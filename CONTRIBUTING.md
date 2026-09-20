# Contributing to CAPE

Thank you for your interest in contributing!

## How to Contribute

### Reporting Bugs

Open a [Bug Report](https://github.com/infat0x/cape/issues/new?template=bug_report.md) with as much detail as possible.

### Suggesting Features

Open a [Feature Request](https://github.com/infat0x/cape/issues/new?template=feature_request.md).

### Submitting Code

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes.
4. Test the plugin inside Caido by packaging it:
   ```bash
   python3 scripts/package.py
   ```
5. Commit with a clear message: `git commit -m "feat: add your feature"`
6. Push and open a Pull Request against `main`.

## Code Style

- Keep frontend code inside `frontend/script.js` and `frontend/style.css`.
- Keep backend logic inside `backend/script.js`.
- Match Caido's dark theme colors (`#31333a`, `#272930`, `#f0642f`).
- No external runtime dependencies allowed (Caido plugin policy).

## Questions?

Open an issue or reach out on the [Caido Discord](https://links.caido.io/discord) in the `#plugins` channel.
