#!/usr/bin/env node
import fs from "fs";
import path from "path";

// CLI argument: project folder (defaults to current working dir)
const projectPath = process.argv[2] || process.cwd();
const srcPath = path.join(projectPath, "src");
const outputDir = path.join(projectPath, "ai-merged");
const maxFileSize = 900_000; // ~900 KB for AI-friendly context limits

// Folders & files to ignore
const ignoreDirs = ["node_modules", "dist", "build", ".git", ".next", "out"];
const ignoreFiles = [".env", ".DS_Store", "package-lock.json", "yarn.lock"];

function walkDir(dir, callback) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name)) {
        walkDir(entryPath, callback);
      }
    } else {
      if (!ignoreFiles.includes(entry.name)) {
        callback(entryPath);
      }
    }
  });
}

function mergeFiles() {
  if (!fs.existsSync(srcPath)) {
    console.error(`❌ No src folder found at: ${srcPath}`);
    process.exit(1);
  }

  let mergedContent = "";

  walkDir(srcPath, (filePath) => {
    const relativePath = path.relative(projectPath, filePath);
    const content = fs.readFileSync(filePath, "utf8");
    mergedContent += `\n\n--- FILE: ${relativePath} ---\n${content}\n`;
  });

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // Split into multiple files if too large
  let part = 1;
  while (mergedContent.length > 0) {
    const chunk = mergedContent.slice(0, maxFileSize);
    mergedContent = mergedContent.slice(maxFileSize);
    const outFile = path.join(outputDir, `merged-part-${part}.txt`);
    fs.writeFileSync(outFile, chunk, "utf8");
    console.log(`✅ Created: ${outFile}`);
    part++;
  }
}

mergeFiles();