#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ASSETS_DIR = 'assets';

// Discover scenic areas by scanning asset directories
function discoverScenicAreas(cityPath) {
  const discoveredAreas = new Set();
  
  // Check audio directory
  const audioDir = path.join(cityPath, 'audio');
  if (fs.existsSync(audioDir)) {
    const audioDirs = fs.readdirSync(audioDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    audioDirs.forEach(area => discoveredAreas.add(area));
  }
  
  // Check spots directory
  const spotsDir = path.join(cityPath, 'data', 'spots');
  if (fs.existsSync(spotsDir)) {
    const spotFiles = fs.readdirSync(spotsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    spotFiles.forEach(area => discoveredAreas.add(area));
  }
  
  // Check images directory (look for scenic area subdirectories)
  const imagesDir = path.join(cityPath, 'images');
  if (fs.existsSync(imagesDir)) {
    const imageDirs = fs.readdirSync(imagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    imageDirs.forEach(area => discoveredAreas.add(area));
  }
  
  return Array.from(discoveredAreas);
}

// Get existing scenic areas from scenic-area.json
function getExistingScenicAreas(cityPath) {
  const scenicAreaFile = path.join(cityPath, 'data', 'scenic-area.json');
  if (fs.existsSync(scenicAreaFile)) {
    try {
      const scenicAreas = JSON.parse(fs.readFileSync(scenicAreaFile, 'utf8'));
      return scenicAreas.map(area => area.name);
    } catch (error) {
      console.warn(`Warning: Could not read scenic area file for ${cityPath}:`, error.message);
    }
  }
  return [];
}

// Generate default scenic area entry
function generateScenicAreaEntry(areaName, cityPath) {
  // Try to get coordinates from existing spots file
  const spotsFile = path.join(cityPath, 'data', 'spots', `${areaName}.json`);
  let center = { lat: 36.666667, lng: 117.05 }; // Default济南 coordinates
  
  if (fs.existsSync(spotsFile)) {
    try {
      const spots = JSON.parse(fs.readFileSync(spotsFile, 'utf8'));
      if (spots.length > 0 && spots[0].location) {
        center = {
          lat: spots[0].location.lat,
          lng: spots[0].location.lng
        };
      }
    } catch (error) {
      console.warn(`Warning: Could not read spots file for ${areaName}:`, error.message);
    }
  }
  
  return {
    name: areaName,
    center: center,
    radius: 2000,
    level: 18,
    spotsFile: `spots/${areaName}.json`
  };
}

// Scan all cities and discover missing scenic areas
function discoverAllScenicAreas() {
  console.log('🔍 Discovering scenic areas across all cities...\n');
  
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`Assets directory ${ASSETS_DIR} not found!`);
    return;
  }
  
  const provinces = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
    .map(dirent => dirent.name);
  
  let totalDiscovered = 0;
  let totalMissing = 0;
  let totalUpdated = 0;
  
  for (const province of provinces) {
    const provincePath = path.join(ASSETS_DIR, province);
    
    // Skip backup directories
    if (province.includes('.bk') || province === 'preview') {
      continue;
    }
    
    const cityDirs = fs.readdirSync(provincePath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map(dirent => dirent.name);
    
    console.log(`📍 ${province} (${cityDirs.length} cities)`);
    
    for (const city of cityDirs) {
      const cityPath = path.join(provincePath, city);
      
      // Discover all scenic areas in this city
      const discoveredAreas = discoverScenicAreas(cityPath);
      const existingAreas = getExistingScenicAreas(cityPath);
      const missingAreas = discoveredAreas.filter(area => !existingAreas.includes(area));
      
      totalDiscovered += discoveredAreas.length;
      totalMissing += missingAreas.length;
      
      if (discoveredAreas.length > 0) {
        console.log(`  ${city}:`);
        console.log(`    📊 Discovered: ${discoveredAreas.length} areas`);
        console.log(`    ✅ Existing: ${existingAreas.length} areas`);
        console.log(`    ❌ Missing: ${missingAreas.length} areas`);
        
        if (missingAreas.length > 0) {
          console.log(`    🔍 Missing areas: ${missingAreas.join(', ')}`);
          
          // Auto-generate missing scenic area entries
          const scenicAreaFile = path.join(cityPath, 'data', 'scenic-area.json');
          let allAreas = [];
          
          // Load existing areas
          if (fs.existsSync(scenicAreaFile)) {
            try {
              allAreas = JSON.parse(fs.readFileSync(scenicAreaFile, 'utf8'));
            } catch (error) {
              console.warn(`    ⚠️  Could not read existing scenic-area.json: ${error.message}`);
            }
          }
          
          // Add missing areas
          for (const missingArea of missingAreas) {
            const newEntry = generateScenicAreaEntry(missingArea, cityPath);
            allAreas.push(newEntry);
            console.log(`    ➕ Added: ${missingArea}`);
          }
          
          // Write updated scenic-area.json
          try {
