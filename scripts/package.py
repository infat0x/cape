#!/usr/bin/env python3
"""
Automate Payload Extractor - Packaging Script
Packages and signs the plugin for Caido Store distribution.
"""

import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
MANIFEST_FILE = ROOT_DIR / "manifest.json"
PRIVATE_KEY = ROOT_DIR / "private.pem"
PUBLIC_KEY = ROOT_DIR / "public.pem"

def main():
    if not MANIFEST_FILE.exists():
        print(f"[-] Error: manifest.json not found at {MANIFEST_FILE}")
        sys.exit(1)

    with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    plugin_id = manifest.get("id", "caido-plugin")
    version = manifest.get("version", "1.0.0")
    named_zip = DIST_DIR / f"{plugin_id}-v{version}.zip"
    store_zip = DIST_DIR / "plugin_package.zip"
    store_sig = DIST_DIR / "plugin_package.zip.sig"

    DIST_DIR.mkdir(exist_ok=True)

    print(f"[*] Packaging {plugin_id} (version {version})...")

    files_to_include = [
        ("manifest.json", ROOT_DIR / "manifest.json"),
        ("frontend/script.js", ROOT_DIR / "frontend" / "script.js"),
        ("frontend/style.css", ROOT_DIR / "frontend" / "style.css"),
        ("backend/script.js", ROOT_DIR / "backend" / "script.js"),
    ]

    if (ROOT_DIR / "README.md").exists():
        files_to_include.append(("README.md", ROOT_DIR / "README.md"))
    if (ROOT_DIR / "LICENSE").exists():
        files_to_include.append(("LICENSE", ROOT_DIR / "LICENSE"))
    if (ROOT_DIR / "CHANGELOG.md").exists():
        files_to_include.append(("CHANGELOG.md", ROOT_DIR / "CHANGELOG.md"))

    # Write plugin_package.zip
    with zipfile.ZipFile(store_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for archive_name, source_path in files_to_include:
            if not source_path.exists():
                print(f"[-] Warning: Missing required file {source_path}")
                continue
            print(f"  [+] Adding {archive_name}")
            zf.write(source_path, arcname=archive_name)

    # Also copy to named zip for convenience
    import shutil
    shutil.copyfile(store_zip, named_zip)

    print(f"\n[+] Successfully created Caido plugin packages:")
    print(f"    -> {store_zip} (Required for Store release)")
    print(f"    -> {named_zip}")

    # Sign if private key exists
    if PRIVATE_KEY.exists():
        print("\n[*] Signing plugin_package.zip with private.pem...")
        cmd_sign = [
            "openssl", "pkeyutl", "-sign",
            "-inkey", str(PRIVATE_KEY),
            "-in", str(store_zip),
            "-out", str(store_sig),
            "-rawin"
        ]
        res = subprocess.run(cmd_sign, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"[+] Successfully generated signature: {store_sig}")
            if PUBLIC_KEY.exists():
                cmd_verify = [
                    "openssl", "pkeyutl", "-verify",
                    "-pubin", "-inkey", str(PUBLIC_KEY),
                    "-sigfile", str(store_sig),
                    "-in", str(store_zip),
                    "-rawin"
                ]
                ver_res = subprocess.run(cmd_verify, capture_output=True, text=True)
                if ver_res.returncode == 0:
                    print("[+] Signature Verified OK against public.pem!")
                else:
                    print(f"[-] Signature verification failed: {ver_res.stderr}")
        else:
            print(f"[-] Signing failed: {res.stderr}")

if __name__ == "__main__":
    main()
