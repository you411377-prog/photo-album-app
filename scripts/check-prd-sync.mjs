#!/usr/bin/env node
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const getArgValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const base = getArgValue('--base');
const head = getArgValue('--head');
const staged = args.includes('--staged');
const filesArg = getArgValue('--files');

const behaviorPrefixes = ['src/', 'server/', 'api/', 'routes/', 'app/'];
const behaviorFiles = new Set(['server.js']);
const prdPaths = [
  'docs/prd/current.md',
  'docs/prd/CHANGELOG.md',
  'docs/prd/deviations/',
  'docs/decisions/'
];

const runGit = (command) => {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
};

const parseChangedFiles = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const getChangedFiles = () => {
  if (filesArg) {
    return filesArg
      .split(',')
      .map((file) => file.trim())
      .filter(Boolean);
  }

  const isGitRepo = runGit('git rev-parse --is-inside-work-tree');
  if (isGitRepo !== 'true') {
    console.error('[prd-sync] This check requires a git repository or an explicit --files argument.');
    console.error('Examples:');
    console.error('  npm run check:prd-sync -- --files src/App.jsx');
    console.error('  npm run check:prd-sync -- --base origin/main --head HEAD');
    process.exit(1);
  }

  if (base && head) {
    return parseChangedFiles(runGit(`git diff --name-only ${base}...${head}`));
  }

  if (staged) {
    return parseChangedFiles(runGit('git diff --cached --name-only'));
  }

  const stagedFiles = parseChangedFiles(runGit('git diff --cached --name-only'));
  if (stagedFiles.length > 0) {
    return stagedFiles;
  }

  const workingTreeFiles = parseChangedFiles(runGit('git diff --name-only HEAD'));
  if (workingTreeFiles.length > 0) {
    return workingTreeFiles;
  }

  return [];
};

const changedFiles = getChangedFiles();

if (changedFiles.length === 0) {
  console.log('[prd-sync] No changed files detected. Skipping check.');
  process.exit(0);
}

const isBehaviorFile = (file) =>
  behaviorFiles.has(file) || behaviorPrefixes.some((prefix) => file.startsWith(prefix));

const isPrdSyncFile = (file) =>
  prdPaths.some((path) => (path.endsWith('/') ? file.startsWith(path) : file === path));

const behaviorFilesChanged = changedFiles.filter(isBehaviorFile);
const prdFilesChanged = changedFiles.filter(isPrdSyncFile);

if (behaviorFilesChanged.length === 0) {
  console.log('[prd-sync] No product-behavior files changed. Check passed.');
  process.exit(0);
}

if (prdFilesChanged.length > 0) {
  console.log('[prd-sync] PRD sync evidence found. Check passed.');
  console.log(`- Behavior files: ${behaviorFilesChanged.join(', ')}`);
  console.log(`- PRD docs: ${prdFilesChanged.join(', ')}`);
  process.exit(0);
}

console.error('[prd-sync] Detected behavior-related code changes without PRD sync evidence.');
console.error(`- Behavior files: ${behaviorFilesChanged.join(', ')}`);
console.error('- Expected at least one PRD governance update in one of these paths:');
for (const path of prdPaths) {
  console.error(`  - ${path}`);
}
console.error('Suggested fix: update docs/prd/current.md or add a docs/prd/deviations/ record before merging.');
process.exit(1);
