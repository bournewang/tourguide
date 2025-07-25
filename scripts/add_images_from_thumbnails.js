#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

if (process.argv.length < 3 || !process.argv[2]) {
  console.error('Usage: node add_images_from_thumbnails.js <spots-json-file>');
  console.error('Example: node add_images_from_thumbnails.js public/assets/data/spots/songyangshuyuan.json');
  process.exit(1);
}

const spotsFile = process.argv[2];
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

let spots = Array.isArray(data) ? data : data.results;
if (!Array.isArray(spots)) {
  console.error('No spots array found in JSON');
  process.exit(1);
}

let updated = 0;
spots.forEach(spot => {
  if (
    spot.thumbnail &&
    typeof spot.thumbnail === 'string' &&
    spot.thumbnail.startsWith('/assets/thumb/')
  ) {
    const imagePath = spot.thumbnail.replace('/assets/thumb/', '/assets/images/');
    if (spot.image !== imagePath) {
      spot.image = imagePath;
      updated++;
    }
  }
});

// Backup original file
const backupFile = spotsFile + '.bak';
fs.copyFileSync(spotsFile, backupFile);

// Write updated file
fs.writeFileSync(spotsFile, JSON.stringify(data, null, 2), 'utf-8');

console.log(`Processed ${spots.length} spots in ${spotsFile}`);
console.log(`Added/updated image field for ${updated} spots.`);
console.log(`Backup saved as ${backupFile}`); 