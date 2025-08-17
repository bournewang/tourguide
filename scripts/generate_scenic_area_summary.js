#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';

// Get city path from command line argument
const cityPath = process.argv[2];
if (!cityPath) {
  console.error('Usage: node generate_scenic_area_summary.js <cityPath>');
  process.exit(1);
}

const spotsDir = path.join(cityPath, 'data', 'spots');
const outputFile = path.join(cityPath, 'data', 'scenic-area.json');

// Check if spots directory exists
if (!fs.existsSync(spotsDir)) {
  console.error(`Spots directory not found: ${spotsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(spotsDir).filter(f => f.endsWith('.json'));
const summary = [];

for (const file of files) {
  const filePath = path.join(spotsDir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error('Failed to parse', file, e.message);
    continue;
  }
  // Try to get fields from the root object
  const name = data.name || path.basename(file, '.json');
  const center = data.center || undefined;
  const radius = data.radius || undefined;
  const level = data.level || 18;
  const spotsFile = 'spots/' + file;
  summary.push({ name, center, radius, level, spotsFile });
}

fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2), 'utf-8');
console.log(`Wrote summary for ${summary.length} areas to ${outputFile}`);
