#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Recursively find all TypeScript files in a directory
 */
function findTsFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
      findTsFiles(fullPath, files);
    } else if (extname(entry) === '.ts' && !entry.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a relative import needs .js extension
 */
function needsJsExtension(importPath) {
  if (importPath.match(/^cosmjs-types\/$/) && !importPath.endsWith('.js'))
    return true;
  if (!importPath.startsWith('./') && !importPath.startsWith('../'))
    return false;
  if (importPath.endsWith('.js'))
    return false;
  return true;
}

/**
 * Fix ESM imports in a file
 */
function fixImportsInFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  let modified = false;

  // Match import statements with relative paths
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const exportRegex = /export\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

  let newContent = content;

  // Fix import statements
  newContent = newContent.replace(importRegex, (match, importPath) => {
    if (needsJsExtension(importPath)) {
      let fixedPath = importPath.replace(/\.ts$/, '') + '.js';
      modified = true;
      return match.replace(importPath, fixedPath);
    }
    return match;
  });

  // Fix export statements
  newContent = newContent.replace(exportRegex, (match, importPath) => {
    if (needsJsExtension(importPath)) {
      let fixedPath = importPath.replace(/\.ts$/, '') + '.js';
      modified = true;
      return match.replace(importPath, fixedPath);
    }
    return match;
  });

  if (modified) {
    writeFileSync(filePath, newContent, 'utf8');
    console.log(`🔎 Fixed imports in: ${filePath}`);
  }

  return modified;
}

/**
 * Check ESM imports without fixing them (for CI)
 */
function checkImportsInFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const issues = [];

  // Match import statements with relative paths
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const exportRegex = /export\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

  let match;

  // Check import statements
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (needsJsExtension(importPath)) {
      issues.push({
        type: 'import',
        path: importPath,
        line: content.substring(0, match.index).split('\n').length,
        suggested: importPath.replace(/\.ts$/, '') + '.js'
      });
    }
  }

  // Check export statements
  while ((match = exportRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (needsJsExtension(importPath)) {
      issues.push({
        type: 'export',
        path: importPath,
        line: content.substring(0, match.index).split('\n').length,
        suggested: importPath.replace(/\.ts$/, '') + '.js'
      });
    }
  }

  return issues;
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const packagesDir = join(__dirname, '..', 'packages');

  console.log(`🔍 ${checkOnly ? 'Checking' : 'Fixing'} ESM imports in packages...`);

  let totalIssues = 0;
  let totalFiles = 0;

  // Find all TypeScript files in packages
  const tsFiles = findTsFiles(packagesDir);

  for (const filePath of tsFiles) {
    const relativePath = filePath.replace(process.cwd() + '/', '');
    console.log(`📁 Processing: ${relativePath}`);

    if (checkOnly) {
      const issues = checkImportsInFile(filePath);
      if (issues.length > 0) {
        totalIssues += issues.length;
        console.log(`❌ Found ${issues.length} issues:`);
        issues.forEach(issue => {
          console.log(`  Line ${issue.line}: ${issue.type} '${issue.path}' should be '${issue.suggested}'`);
        });
      }
    } else {
      const modified = fixImportsInFile(filePath);
      if (modified) {
        totalFiles++;
      }
    }
  }

  if (checkOnly) {
    if (totalIssues > 0) {
      console.log(`\n❌ Found ${totalIssues} ESM import issues that need fixing.`);
      process.exit(1);
    } else {
      console.log(`\n✅ No issues found.`);
    }
  } else {
    if (totalFiles > 0) {
      console.log(`\n✅ Fixed imports in ${totalFiles} files.`);
    } else {
      console.log(`\n✅ No issues found.`);
    }
  }
}

main();

