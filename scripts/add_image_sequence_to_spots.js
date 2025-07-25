#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

if (process.argv.length < 4) {
  console.error('Usage: node add_image_sequence_to_spots.js <spots-json-file> <scenic-area-name>');
  console.error('Example: node add_image_sequence_to_spots.js public/assets/data/spots/songyangshuyuan.json 嵩阳书院');
  process.exit(1);
}

const spotsFile = process.argv[2];
const scenicAreaName = process.argv[3];
const imagesRoot = path.resolve('public/assets/images', scenicAreaName);

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
for (const spot of spots) {
  if (!spot.name) continue;
  const spotImageDir = path.join(imagesRoot, spot.name);
  if (!fs.existsSync(spotImageDir) || !fs.statSync(spotImageDir).isDirectory()) continue;
  const files = fs.readdirSync(spotImageDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (files.length === 0) continue;
  files.sort(); // Optional: sort alphabetically
  // Set main image and thumbnail to the first image
  const firstImage = files[0];
  spot.image = `/assets/images/${scenicAreaName}/${spot.name}/${firstImage}`;
  spot.thumbnail = `/assets/thumb/${scenicAreaName}/${spot.name}/${firstImage}`;
  // Always replace imageSequence
  spot.imageSequence = files.map((filename, idx) => ({
    img: `/assets/images/${scenicAreaName}/${spot.name}/${filename}`,
    start: idx * 8,
    duration: 8,
    notes: path.parse(filename).name
  }));
  updated++;
}

// Backup original file
const backupFile = spotsFile + '.bak';
fs.copyFileSync(spotsFile, backupFile);

// Write updated file
fs.writeFileSync(spotsFile, JSON.stringify(data, null, 2), 'utf-8');

console.log(`Processed ${spots.length} spots in ${spotsFile}`);
console.log(`Added/updated imageSequence for ${updated} spots.`);
console.log(`Backup saved as ${backupFile}`); 