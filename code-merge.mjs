#!/usr/bin/env node
import fs from "fs";
import path from "path";

// CLI argument: project folder (defaults to current working dir)
const projectPath = process.argv[2] || process.cwd();
const srcPath = path.join(projectPath, "src");
const outputDir = path.join(projectPath, "ai-merged");
const maxFileSize = 900_000; // ~900 KB for AI-friendly context limits

// Folders & files to ignore
const ignoreDirs = ["node_modules", "dist", "build", ".git", ".next", "out", "ai-merged"]; // Also ignore the output directory itself
const ignoreFiles = [".env", ".DS_Store", "package-lock.json", "yarn.lock"];

/**
 * Recursively walks a directory and calls a callback for each file.
 * @param {string} dir - The directory to walk.
 * @param {function(string): void} callback - The callback to execute for each file path.
 */
function walkDir(dir, callback) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // If it's a directory, check if it should be ignored
      if (!ignoreDirs.includes(entry.name)) {
        walkDir(entryPath, callback);
      }
    } else {
      // If it's a file, check if it should be ignored
      if (!ignoreFiles.includes(entry.name)) {
        callback(entryPath);
      }
    }
  });
}

/**
 * Merges files from a specified directory into one or more text files.
 */
function mergeFiles() {
  let scanPath = "";

  // Determine which directory to scan
  if (fs.existsSync(srcPath) && fs.lstatSync(srcPath).isDirectory()) {
    console.log(`✅ Found 'src' folder. Merging files from: ${srcPath}`);
    scanPath = srcPath;
  } else {
    console.log(`ℹ️ No 'src' folder found. Merging files from the current project folder: ${projectPath}`);
    scanPath = projectPath;
  }

  let mergedContent = "";

  // Walk the selected directory and merge file contents
  walkDir(scanPath, (filePath) => {
    // Ensure we don't process files inside the output directory if scanning the root
    if (filePath.startsWith(outputDir)) {
      return;
    }
    const relativePath = path.relative(projectPath, filePath);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      mergedContent += `\n\n--- FILE: ${relativePath} ---\n${content}\n`;
    } catch (error) {
      console.warn(`⚠️ Could not read file: ${filePath}. Skipping. Error: ${error.message}`);
    }
  });

  if (mergedContent.trim() === "") {
    console.log("No files to merge.");
    return;
  }
  
  // Create the output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Split the merged content into multiple files if it's too large
  let part = 1;
  while (mergedContent.length > 0) {
    const chunk = mergedContent.slice(0, maxFileSize);
    mergedContent = mergedContent.slice(maxFileSize);
    const outFile = path.join(outputDir, `merged-part-${part}.txt`);
    
    try {
      fs.writeFileSync(outFile, chunk, "utf8");
      console.log(`✅ Created: ${outFile}`);
    } catch (error) {
        console.error(`❌ Failed to write file: ${outFile}. Error: ${error.message}`);
    }
    part++;
  }
}

mergeFiles();
