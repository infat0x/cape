#!/usr/bin/env python3
"""
Automate Payload Extractor - Packaging Script
Packages the plugin into a Caido-compatible distribution .zip file.
No external dependencies required (works on Linux, macOS, and Windows).
"""

import json
import os
import sys
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
MANIFEST_FILE = ROOT_DIR / "manifest.json"

def main():
    if not MANIFEST_FILE.exists():
        print(f"[-] Error: manifest.json not found at {MANIFEST_FILE}")
        sys.exit(1)

    with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    plugin_id = manifest.get("id", "caido-plugin")
    version = manifest.get("version", "1.0.0")
    zip_filename = f"{plugin_id}-v{version}.zip"

    DIST_DIR.mkdir(exist_ok=True)
    target_zip = DIST_DIR / zip_filename

    print(f"[*] Packaging {plugin_id} (version {version})...")

    files_to_include = [
        ("manifest.json", ROOT_DIR / "manifest.json"),
        ("frontend/script.js", ROOT_DIR / "frontend" / "script.js"),
        ("frontend/style.css", ROOT_DIR / "frontend" / "style.css"),
    ]

    # Optional docs
    if (ROOT_DIR / "README.md").exists():
        files_to_include.append(("README.md", ROOT_DIR / "README.md"))
    if (ROOT_DIR / "LICENSE").exists():
        files_to_include.append(("LICENSE", ROOT_DIR / "LICENSE"))

    with zipfile.ZipFile(target_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for archive_name, source_path in files_to_include:
            if not source_path.exists():
                print(f"[-] Warning: Missing required file {source_path}")
                continue
            print(f"  [+] Adding {archive_name}")
            zf.write(source_path, arcname=archive_name)

    print(f"\n[+] Successfully created Caido plugin package:")
    print(f"    -> {target_zip}")
    print(f"    -> File size: {target_zip.stat().st_size} bytes")
    print(f"\n[i] Installation instructions:")
    print(f"    1. Open Caido.")
    print(f"    2. Go to Plugins -> Install from Package (or drag & drop the .zip).")
    print(f"    3. Enjoy single-click payload extraction!")

if __name__ == "__main__":
    main()
