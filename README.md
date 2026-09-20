# Automate Payload Extractor for Caido

[![Caido Plugin](https://img.shields.io/badge/Caido-Plugin-FF6A00?style=flat-square&logo=target)](https://caido.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-blue?style=flat-square)](#)

A lightweight, zero-dependency frontend plugin for [Caido](https://caido.io) that brings the beloved Burp Intruder "Copy Column" experience directly into Caido Automate.

---

## 🎯 Motivation

When performing web security assessments, fuzzing endpoints, or conducting XSS filter bypass research in **Caido Automate**, filtering results by response status (e.g. `resp.code.eq:200`) is effortless. However, extracting *just* the successful payload column to pipe into another wordlist or attack phase traditionally required exporting the entire session to CSV and manually slicing columns.

**Automate Payload Extractor** eliminates this friction. It provides:
- **Instant Clipboard Copying:** Copy filtered payloads with a single click or keyboard shortcut.
- **Dedicated UI Tab:** Inspect, search, and deduplicate payloads inside a native Caido interface.
- **Wordlist Generation:** Download filtered payloads directly as clean `.txt` files.

---

## ✨ Features

- **⚡ Zero Overhead:** Pure vanilla JavaScript & CSS with zero runtime dependencies. Ultra-fast, minimal memory footprint.
- **🖥️ Native UI Integration:** Adds a clean, dark-themed dashboard into Caido's sidebar matching Caido's design system.
- **🔍 Granular Filtering:**
  - Filter by response code: `200 OK`, `2xx`, `3xx`, `4xx`, `5xx`, or all.
  - Live substring / keyword search across payloads.
  - One-click deduplication toggle.
- **⌨️ Keyboard Shortcuts:**
  - `Ctrl + Shift + C` (or `Cmd + Shift + C` on macOS): Instantly copies HTTP 200 payloads from the latest session to your clipboard.
- **🚀 Command Palette:** Integrated with Caido's `Ctrl + K` Command Palette (`Automate: Quick Copy 200 OK Payloads`).
- **🌐 100% Cross-Platform:** Works identically on Linux, macOS, and Windows.

---

## 📂 Project Structure

```text
caido-automate-payload-extractor/
├── manifest.json            # Caido plugin manifest
├── package.json             # Project metadata & developer scripts
├── LICENSE                  # MIT License
├── README.md                # Documentation & usage guide
├── frontend/
│   ├── script.js            # Human-written, standalone frontend entrypoint
│   ├── style.css            # Native dark theme styling
│   └── src/                 # TypeScript source files (for contributors)
│       ├── index.ts
│       ├── extractor.ts
│       └── types.ts
└── scripts/
    └── package.py           # Cross-platform distribution packager
```

---

## 📦 Installation

### Option 1: Install from Release Package (Recommended)

1. Build or download the distribution zip:
   ```bash
   python3 scripts/package.py
   ```
   This generates `dist/automate-payload-extractor-v1.0.0.zip`.
2. Open **Caido**.
3. Navigate to **Plugins** in the left sidebar.
4. Click **Install Package** and select the `.zip` file (or drag and drop it into the window).
5. The plugin is active immediately!

---

## 🚀 How to Use

### 1. From the Dedicated Sidebar Tab
1. In Caido, click the **Payload Extractor** icon in the sidebar.
2. Select your desired Automate session from the dropdown.
3. Choose your filter (e.g. `200 OK Only`).
4. Click **Copy to Clipboard** or **Save as .txt**.

### 2. From Anywhere (Global Shortcut)
After running an Automate fuzzing attack:
- Press **`Ctrl + Shift + C`** (or `Cmd + Shift + C` on macOS).
- A notification will appear confirming that your successful payloads were copied to the system clipboard.

### 3. Via Command Palette
- Press **`Ctrl + K`** (or `Cmd + K`).
- Type `Quick Copy` and press Enter.

---

## 🌍 Submitting to the Caido Community Store

To share this plugin with the global Caido community:

1. **Push to your GitHub repository:**
   ```bash
   git init
   git add .
   git commit -m "feat: initial release of Automate Payload Extractor plugin"
   git remote add origin https://github.com/<your-username>/caido-automate-payload-extractor.git
   git push -u origin main
   ```

2. **Fork and Submit a PR:**
   - Go to [caido/community-packages](https://github.com/caido/community-packages).
   - Add your plugin metadata under `packages/` pointing to your repository.
   - Open a Pull Request. Once merged, any Caido user worldwide can install it directly from Caido's built-in Community Store!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Feel free to use, modify, and distribute it freely.
