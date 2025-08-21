#!/usr/bin/env node
import fs from "fs";
import path from "path";
import inquirer from "inquirer";

const projectPath = process.cwd();
const outputDir = path.join(projectPath, "ai-merged");
const maxFileSize = 900_000;

const ignoreDirs = ["node_modules", "dist", "build", ".git", ".next", "out", "ai-merged"];
const ignoreFiles = [".env", ".DS_Store", "package-lock.json", "yarn.lock"];

/**
 * List directory entries with navigation options
 */
function listEntries(baseDir) {
  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => !ignoreDirs.includes(e.name) && !ignoreFiles.includes(e.name))
    .map((e) => ({
      name: e.isDirectory() ? `📁 ${e.name}` : `📄 ${e.name}`,
      value: { path: path.join(baseDir, e.name), isDir: e.isDirectory() },
    }));

  return [
    ...(baseDir !== projectPath ? [{ name: "⬅️  Go back", value: { back: true } }] : []),
    ...entries,
    new inquirer.Separator(),
    { name: "✅ Done (finish selection)", value: { done: true } },
  ];
}

/**
 * Interactive file/folder selection
 */
async function pickFiles() {
  let cwd = projectPath;
  let selected = [];

  while (true) {
    const choices = listEntries(cwd);

    const { choice } = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: `📂 ${path.relative(projectPath, cwd) || "."} — Select:`,
        choices,
      },
    ]);

    if (choice.done) break;
    if (choice.back) {
      cwd = path.dirname(cwd);
      continue;
    }

    if (choice.isDir) {
      // Ask if user wants to enter or select whole folder
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: `Folder "${path.basename(choice.path)}" — what to do?`,
          choices: [
            { name: "📂 Enter folder", value: "enter" },
            { name: "📌 Select this folder", value: "select" },
            { name: "❌ Cancel", value: "cancel" },
          ],
        },
      ]);

      if (action === "enter") {
        cwd = choice.path;
      } else if (action === "select") {
        selected.push(choice.path);
        console.log(`✅ Added folder: ${choice.path}`);
      }
    } else {
      selected.push(choice.path);
      console.log(`✅ Added file: ${choice.path}`);
    }
  }

  return selected;
}

/**
 * Recursively collect files
 */
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

/**
 * Merge files into output
 */
async function mergeFiles() {
  const selectedPaths = await pickFiles();
  if (!selectedPaths.length) {
    console.log("No files/folders selected. Exiting.");
    return;
  }

  let mergedContent = "";

  for (const item of selectedPaths) {
    const stat = fs.lstatSync(item);
    if (stat.isDirectory()) {
      walkDir(item, (filePath) => {
        const relativePath = path.relative(projectPath, filePath);
        try {
          const content = fs.readFileSync(filePath, "utf8");
          mergedContent += `\n\n--- FILE: ${relativePath} ---\n${content}\n`;
        } catch (err) {
          console.warn(`⚠️ Could not read ${filePath}: ${err.message}`);
        }
      });
    } else {
      const relativePath = path.relative(projectPath, item);
      try {
        const content = fs.readFileSync(item, "utf8");
        mergedContent += `\n\n--- FILE: ${relativePath} ---\n${content}\n`;
      } catch (err) {
        console.warn(`⚠️ Could not read ${item}: ${err.message}`);
      }
    }
  }

  if (!mergedContent.trim()) {
    console.log("No file contents to merge.");
    return;
  }

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

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
