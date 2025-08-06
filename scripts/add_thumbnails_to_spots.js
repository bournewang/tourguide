#!/usr/bin/env node

import fs from 'fs';

const PROVINCE_NAME = process.env.PROVINCE_NAME || 'henan';
const CITY_NAME = process.env.CITY_NAME || 'dengfeng';
const ASSET_PREFIX = `/assets/${PROVINCE_NAME}/${CITY_NAME}`;

if (process.argv.length < 4) {
  console.error('Usage: node add_thumbnails_to_spots.js <spots-json-file> <scenic-area-name>');
  process.exit(1);
}

const spotsFile = process.argv[2];
const scenicAreaName = process.argv[3];

if (!fs.existsSync(spotsFile)) {
  console.error('File not found:', spotsFile);
  process.exit(1);
}

const raw = fs.readFileSync(spotsFile, 'utf-8');
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('Failed to parse JSON:', e.message);
  process.exit(1);
}

if (!Array.isArray(data.results)) {
  console.error('No results array found in JSON');
  process.exit(1);
}

let updated = 0;
data.results.forEach(spot => {
  if (!spot.name) {
    console.warn('Skipping spot with no name:', spot);
    return;
  }
  const thumbPath = `${ASSET_PREFIX}/thumb/${scenicAreaName}/${spot.name}/主图.jpg`;
  if (spot.thumbnail !== thumbPath) {
    spot.thumbnail = thumbPath;
    updated++;
  }
});

// Backup original file
const backupFile = spotsFile + '.bak';
fs.copyFileSync(spotsFile, backupFile);

// Write updated file
fs.writeFileSync(spotsFile, JSON.stringify(data, null, 2), 'utf-8');

console.log(`Processed ${data.results.length} spots in ${spotsFile}`);
console.log(`Updated/added thumbnail for ${updated} spots.`);
console.log(`Backup saved as ${backupFile}`); 