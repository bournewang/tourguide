#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printUsage() {
  console.log(`
Create spot-name folders from a spots JSON file.

Usage:
  node scripts/create_spot_dirs_from_json.js <spots_json_file> <target_dir>

Args:
  spots_json_file   Path to spots JSON (array or { results: [] })
  target_dir        Directory under which to create spot folders

Example:
  node scripts/create_spot_dirs_from_json.js \
    assets/henan/kaifeng/data/spots/hanyuan.json \
    assets/henan/kaifeng/images/中国翰园
`);
}

if (process.argv.length < 4) {
  printUsage();
  process.exit(1);
}

const spotsFile = process.argv[2];
const targetDir = process.argv[3];

if (!fs.existsSync(spotsFile)) {
  console.error(`Spots JSON not found: ${spotsFile}`);
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  console.log(`Target dir not found, creating: ${targetDir}`);
  fs.mkdirSync(targetDir, { recursive: true });
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(spotsFile, 'utf8'));
} catch (e) {
  console.error(`Failed to parse JSON: ${e.message}`);
  process.exit(1);
}

const spots = Array.isArray(parsed) ? parsed : (parsed.results || []);
if (!Array.isArray(spots)) {
  console.error('Invalid spots JSON: expected an array or an object with results[]');
  process.exit(1);
}

let created = 0;
let skipped = 0;
let hidden = 0;
let errors = 0;

for (const spot of spots) {
  const name = spot && spot.name ? String(spot.name).trim() : '';
  if (!name) {
    skipped++;
    continue;
  }
  if (spot.display === 'hide') {
    hidden++;
    continue; // skip hidden spots
  }
  // Sanitize only path separators; keep original characters (e.g., Chinese)
  const safeName = name.replace(/[\/]/g, '_');
  const dirPath = path.join(targetDir, safeName);
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created: ${dirPath}`);
      created++;
    } else {
      // Already exists
      skipped++;
    }
  } catch (e) {
    console.error(`Failed to create: ${dirPath} -> ${e.message}`);
    errors++;
  }
}

console.log('\nSummary:');
console.log(`  Created: ${created}`);
console.log(`  Skipped (exists/invalid): ${skipped}`);
console.log(`  Hidden (ignored): ${hidden}`);
if (errors > 0) console.log(`  Errors: ${errors}`);
