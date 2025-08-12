#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, "src");
const OUTPUT_DIR = path.join(__dirname, "merged-output");
const DATE_TAG = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
const MERGED_FILE = `merged-src-${DATE_TAG}.txt`;
const MAX_PART_SIZE = 1.5 * 1024 * 1024; // ~1.5 MB per part for AI safety

// Language map for syntax highlighting
const LANGUAGE_MAP = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".css": "css",
  ".scss": "scss",
  ".html": "html",
  ".json": "json",
  ".md": "markdown",
};
const ALLOWED_EXTENSIONS = Object.keys(LANGUAGE_MAP);

// Recursively read files in src
function readFilesRecursively(dir) {
  let files = [];
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(readFilesRecursively(fullPath));
    } else if (ALLOWED_EXTENSIONS.includes(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

// Merge files into a single string
function mergeFiles() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ No 'src' folder found in: ${projectPath}`);
    process.exit(1);
  }

  const files = readFilesRecursively(SRC_DIR);
  let output = "";

  for (const file of files) {
    const ext = path.extname(file);
    const lang = LANGUAGE_MAP[ext] || "";
    const relativePath = path.relative(__dirname, file);
    const content = fs.readFileSync(file, "utf8");

    output += `\n\n=== FILE: ${relativePath} ===\n\n`;
    output += `\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
  }

  return output;
}

// Split file into AI-safe parts
function splitIfTooLarge(content) {
  if (Buffer.byteLength(content, "utf8") <= MAX_PART_SIZE) {
    return [content];
  }

  console.log("⚠ Large file detected, splitting into parts...");

  let parts = [];
  let buffer = "";
  let size = 0;

  for (const line of content.split("\n")) {
    const lineSize = Buffer.byteLength(line + "\n", "utf8");
    if (size + lineSize > MAX_PART_SIZE) {
      parts.push(buffer);
      buffer = "";
      size = 0;
    }
    buffer += line + "\n";
    size += lineSize;
  }

  if (buffer.trim()) {
    parts.push(buffer);
  }

  return parts;
}

// Save parts and zip them
function saveAndZip(parts) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  const partFiles = [];
  parts.forEach((part, i) => {
    const fileName =
      parts.length > 1
        ? MERGED_FILE.replace(".txt", `-part${i + 1}.txt`)
        : MERGED_FILE;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, part, "utf8");
    partFiles.push(fileName);
  });

  // Zip the folder for archiving
  const zipName = `merged-src-${DATE_TAG}.zip`;
  const zipPath = path.join(OUTPUT_DIR, zipName);

  try {
    execSync(
      `zip -j "${zipPath}" ${partFiles
        .map((f) => `"${path.join(OUTPUT_DIR, f)}"`)
        .join(" ")}`
    );
    console.log(`✅ Zipped into ${zipPath}`);
  } catch (err) {
    console.error(
      "⚠ Zip command failed. Install zip utility or do it manually."
    );
  }
}

// Main
function main() {
  console.log("🔄 Merging source files...");
  const mergedContent = mergeFiles();
  const parts = splitIfTooLarge(mergedContent);
  saveAndZip(parts);
  console.log(`✅ Done! Files are in ${OUTPUT_DIR}`);
}

main();
