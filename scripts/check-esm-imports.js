#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ignoredPackages = [
  '@noble/hashes',
];

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
 * Check if an import uses illegal baseUrl path (starts with src/)
 */
function isIllegalBaseUrlImport(importPath) {
  return importPath.startsWith('src/');
}

/**
 * Check if a relative import needs .js extension
 */
function needsJsExtension(importPath) {
  if (importPath.match(/^cosmjs-types\/$/) && !importPath.endsWith('.js'))
    return true;
  if (!importPath.startsWith('./') && !importPath.startsWith('../'))
    return false;
  if (importPath.endsWith('.js') || ignoredPackages.some(pkg => importPath.startsWith(pkg + '/')))
    return false;
  return true;
}

/**
 * Fix ESM imports in a file
 * Returns { modified: boolean, illegalImports: Array }
 */
function fixImportsInFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  let modified = false;

  // Match import statements with relative paths
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const exportRegex = /export\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

  let newContent = content;
  const illegalImports = [];

  // First, collect illegal imports with line numbers
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (isIllegalBaseUrlImport(importPath)) {
      illegalImports.push({
        type: 'import',
        path: importPath,
        line: content.substring(0, match.index).split('\n').length,
        filePath
      });
    }
  }

  while ((match = exportRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (isIllegalBaseUrlImport(importPath)) {
      illegalImports.push({
        type: 'export',
        path: importPath,
        line: content.substring(0, match.index).split('\n').length,
        filePath
      });
    }
  }

  // Fix import statements (only .js extensions, illegal imports are left as-is)
  newContent = newContent.replace(importRegex, (match, importPath) => {
    if (isIllegalBaseUrlImport(importPath)) {
      return match; // Don't modify, just report
    } else if (needsJsExtension(importPath)) {
      let fixedPath = importPath.replace(/\.ts$/, '') + '.js';
      modified = true;
      return match.replace(importPath, fixedPath);
    }
    return match;
  });

  // Fix export statements (only .js extensions, illegal imports are left as-is)
  newContent = newContent.replace(exportRegex, (match, importPath) => {
    if (isIllegalBaseUrlImport(importPath)) {
      return match; // Don't modify, just report
    } else if (needsJsExtension(importPath)) {
      let fixedPath = importPath.replace(/\.ts$/, '') + '.js';
      modified = true;
      return match.replace(importPath, fixedPath);
    }
    return match;
  });

  if (modified) {
    writeFileSync(filePath, newContent, 'utf8');
  }

  return { modified, illegalImports };
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
    if (isIllegalBaseUrlImport(importPath)) {
      issues.push({
        type: 'import',
        path: importPath,
        line: content.substring(0, match.index).split('\n').length,
        issue: 'illegal_baseurl',
        message: `Illegal baseUrl import '${importPath}' - must use relative path (./ or ../)`,
        filePath
      });
    } else if (needsJsExtension(importPath)) {
      issues.push({
        type: 'import',
        path: importPath,
        line: content.substring(0, match.index).split('\n').length,
        issue: 'missing_js_extension',
        suggested: importPath.replace(/\.ts$/, '') + '.js',
        filePath
      });
    }
  }

  // Check export statements
  while ((match = exportRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (isIllegalBaseUrlImport(importPath)) {
      issues.push({
        type: 'export',
        path: importPath,
        line: content.substring(0, match.index).split('\n').length,
        issue: 'illegal_baseurl',
        message: `Illegal baseUrl import '${importPath}' - must use relative path (./ or ../)`,
        filePath
      });
    } else if (needsJsExtension(importPath)) {
      issues.push({
        type: 'export',
        path: importPath,
        line: content.substring(0, match.index).split('\n').length,
        issue: 'missing_js_extension',
        suggested: importPath.replace(/\.ts$/, '') + '.js',
        filePath
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

  let totalFiles = 0;
  const allIssues = [];

  // Find all TypeScript files in packages
  const tsFiles = findTsFiles(packagesDir);

  for (const filePath of tsFiles) {
    const relativePath = filePath.replace(process.cwd() + '/', '');
    console.log(`📁 Processing: ${relativePath}`);

    if (checkOnly) {
      const issues = checkImportsInFile(filePath);
      allIssues.push(...issues);
    } else {
      const result = fixImportsInFile(filePath);
      if (result.modified) {
        totalFiles++;
      }
      // Convert illegal imports to the same format as check mode
      allIssues.push(...result.illegalImports.map(imp => ({
        ...imp,
        issue: 'illegal_baseurl',
        message: `Illegal baseUrl import '${imp.path}' - must use relative path (./ or ../)`
      })));
    }
  }

  // Log all issues at the end
  if (allIssues.length > 0) {
    console.log(`\n❌ Found ${allIssues.length} ESM import issue(s):\n`);

    // Group by file for better readability
    const issuesByFile = {};
    allIssues.forEach(issue => {
      const relativePath = issue.filePath.replace(process.cwd() + '/', '');
      if (!issuesByFile[relativePath]) {
        issuesByFile[relativePath] = [];
      }
      issuesByFile[relativePath].push(issue);
    });

    // Log issues grouped by file
    for (const [filePath, issues] of Object.entries(issuesByFile)) {
      console.log(`  ${filePath}:`);
      issues.forEach(issue => {
        if (issue.issue === 'illegal_baseurl') {
          console.log(`    Line ${issue.line}: ${issue.type} '${issue.path}' - ${issue.message}`);
        } else {
          console.log(`    Line ${issue.line}: ${issue.type} '${issue.path}' should be '${issue.suggested}'`);
        }
      });
      console.log('');
    }

    if (checkOnly) {
      console.log(`❌ Found ${allIssues.length} ESM import issues that need fixing.`);
    } else {
      if (totalFiles > 0) {
        console.log(`✅ Fixed imports in ${totalFiles} files.`);
      }
      console.log(`❌ Found ${allIssues.length} issue(s) that require manual fixes.`);
    }
    process.exit(1);
  } else {
    if (checkOnly) {
      console.log(`\n✅ No issues found.`);
    } else {
      if (totalFiles > 0) {
        console.log(`\n✅ Fixed imports in ${totalFiles} files.`);
      } else {
        console.log(`\n✅ No issues found.`);
      }
    }
  }
}

main();

