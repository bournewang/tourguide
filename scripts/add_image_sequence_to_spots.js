#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.argv.length < 4) {
  console.error('Usage: node add_image_sequence_to_spots.js <spots-json-file> <scenic-area-name>');
  console.error('Example: node add_image_sequence_to_spots.js assets/henan/kaifeng/data/spots/hanyuan.json 中国翰园');
  process.exit(1);
}

const spotsFile = process.argv[2];
const scenicAreaName = process.argv[3];

// Dynamically determine the images directory based on the JSON file path
function getImagesRoot(jsonFilePath) {
  const resolvedPath = path.resolve(jsonFilePath);
  const pathParts = resolvedPath.split(path.sep);
  
  // Look for common patterns in the path
  // Example: assets/henan/kaifeng/data/spots/hanyuan.json -> assets/henan/kaifeng/images
  // Example: assets/dengfeng/data/spots/songyangshuyuan.json -> assets/dengfeng/images
  
  // Find the index of 'data' or 'spots' to determine the base path
  let baseIndex = -1;
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i] === 'data' || pathParts[i] === 'spots') {
      baseIndex = i;
      break;
    }
  }
  
  if (baseIndex !== -1) {
    // Remove 'data' and 'spots' and everything after, then add 'images'
    const basePath = pathParts.slice(0, baseIndex).join(path.sep);
    return path.join(basePath, 'images');
  }
  
  // Fallback: try to find a pattern like assets/<city>/images
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (pathParts[i] === 'assets' && i + 1 < pathParts.length) {
      const cityName = pathParts[i + 1];
      return path.join('assets', cityName, 'images');
    }
  }
  
  // Default fallback
  return path.join('assets', 'dengfeng', 'images');
}

const imagesRoot = path.resolve(getImagesRoot(spotsFile), scenicAreaName);

if (!fs.existsSync(spotsFile)) {
  console.error('File not found:', spotsFile);
  process.exit(1);
}

console.log(`Using images directory: ${imagesRoot}`);

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
  if (!fs.existsSync(spotImageDir) || !fs.statSync(spotImageDir).isDirectory()) {
    console.log(`Skipping ${spot.name} - no image directory found at: ${spotImageDir}`);
    continue;
  }
  const files = fs.readdirSync(spotImageDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (files.length === 0) {
    console.log(`Skipping ${spot.name} - no image files found in: ${spotImageDir}`);
    continue;
  }
  files.sort(); // Optional: sort alphabetically
  // Set main image and thumbnail to the first image
  const firstImage = files[0];
  spot.image = `images/${scenicAreaName}/${spot.name}/${firstImage}`;
  spot.thumbnail = `thumb/${scenicAreaName}/${spot.name}/${firstImage}`;
  // Always replace imageSequence
  spot.imageSequence = files.map((filename, idx) => ({
    img: `images/${scenicAreaName}/${spot.name}/${filename}`,
    start: idx * 8,
    duration: 8,
    notes: path.parse(filename).name
  }));
  updated++;
  console.log(`Updated ${spot.name} with ${files.length} images`);
}

// Backup original file
const backupFile = spotsFile + '.bak';
fs.copyFileSync(spotsFile, backupFile);

// Write updated file
fs.writeFileSync(spotsFile, JSON.stringify(data, null, 2), 'utf-8');

console.log(`Processed ${spots.length} spots in ${spotsFile}`);
console.log(`Added/updated imageSequence for ${updated} spots.`);
console.log(`Backup saved as ${backupFile}`); 