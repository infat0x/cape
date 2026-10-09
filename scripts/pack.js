import fs from "fs";
import path from "path";
import JSZip from "jszip";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

async function pack() {
  const manifestPath = path.join(rootDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("manifest.json not found");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const version = manifest.version || "1.0.0";
  const pluginId = manifest.id || "plugin";

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const zip = new JSZip();

  const files = [
    { target: "manifest.json", file: manifestPath },
    { target: "frontend/script.js", file: path.join(rootDir, "frontend/script.js") },
    { target: "frontend/style.css", file: path.join(rootDir, "frontend/style.css") },
    { target: "backend/script.js", file: path.join(rootDir, "backend/script.js") },
    { target: "README.md", file: path.join(rootDir, "README.md") },
    { target: "CHANGELOG.md", file: path.join(rootDir, "CHANGELOG.md") },
    { target: "LICENSE", file: path.join(rootDir, "LICENSE") }
  ];

  for (const { target, file } of files) {
    if (fs.existsSync(file)) {
      zip.file(target, fs.readFileSync(file));
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    streamFiles: true
  });

  fs.writeFileSync(path.join(distDir, "plugin_package.zip"), zipBuffer);
  fs.writeFileSync(path.join(distDir, `${pluginId}-v${version}.zip`), zipBuffer);

  console.log(`Plugin package generated: dist/plugin_package.zip (${zipBuffer.length} bytes)`);
}

pack().catch((err) => {
  console.error("Package generation failed:", err);
  process.exit(1);
});
