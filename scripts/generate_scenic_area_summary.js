#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const spotsDir = path.resolve('public/assets/data/spots');
const outputFile = path.resolve('public/assets/data/scenic-area.json');

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