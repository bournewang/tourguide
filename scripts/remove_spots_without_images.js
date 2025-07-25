#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SPOTS_DIR = 'public/assets/data/spots';
const BACKUP_DIR = 'public/assets/data/spots/backup';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`[INFO] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`[SUCCESS] ${message}`, 'green');
}

function logWarning(message) {
  log(`[WARNING] ${message}`, 'yellow');
}

function logError(message) {
  log(`[ERROR] ${message}`, 'red');
}

// Create backup directory if it doesn't exist
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logInfo(`Created backup directory: ${BACKUP_DIR}`);
  }
}

// Process a single JSON file
function processSpotFile(filePath) {
  try {
    const fileName = path.basename(filePath);
    logInfo(`Processing: ${fileName}`);
    
    // Read the JSON file
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Check if data has a 'results' array (new format) or is directly an array (old format)
    let spotsArray;
    if (data.results && Array.isArray(data.results)) {
      spotsArray = data.results;
      logInfo(`  Found ${spotsArray.length} spots in results array`);
    } else if (Array.isArray(data)) {
      spotsArray = data;
      logInfo(`  Found ${spotsArray.length} spots in direct array`);
    } else {
      logWarning(`${fileName}: No valid spots array found, skipping`);
      return { processed: false, removed: 0, total: 0 };
    }
    
    const originalCount = spotsArray.length;
    const filteredSpots = spotsArray.filter(spot => {
      // Check if spot has an 'image' field and it's not empty
      if (!spot.image || spot.image.trim() === '') {
        logWarning(`  Removing spot "${spot.name || 'unnamed'}" - no image field`);
        return false;
      }
      return true;
    });
    
    const removedCount = originalCount - filteredSpots.length;
    
    if (removedCount > 0) {
      // Create backup
      const backupPath = path.join(BACKUP_DIR, fileName);
      fs.writeFileSync(backupPath, content);
      logInfo(`  Created backup: ${backupPath}`);
      
      // Update the data structure with filtered spots
      if (data.results) {
        data.results = filteredSpots;
      } else {
        // If it was a direct array, replace the entire data
        Object.assign(data, filteredSpots);
      }
      
      // Write updated data back to file
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      logSuccess(`  Removed ${removedCount} spots from ${fileName}`);
    } else {
      logInfo(`  No spots removed from ${fileName}`);
    }
    
    return { 
      processed: true, 
      removed: removedCount, 
      total: originalCount 
    };
    
  } catch (error) {
    logError(`Failed to process ${filePath}: ${error.message}`);
    return { processed: false, removed: 0, total: 0 };
  }
}

// Main function
function main() {
  logInfo('Starting spot cleanup process...');
  logInfo(`Spots directory: ${SPOTS_DIR}`);
  logInfo(`Backup directory: ${BACKUP_DIR}`);
  console.log();
  
  // Check if spots directory exists
  if (!fs.existsSync(SPOTS_DIR)) {
    logError(`Spots directory '${SPOTS_DIR}' does not exist`);
    process.exit(1);
  }
  
  // Create backup directory
  ensureBackupDir();
  
  // Get all JSON files in the spots directory
  const files = fs.readdirSync(SPOTS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(SPOTS_DIR, file));
  
  if (files.length === 0) {
    logWarning('No JSON files found in spots directory');
    return;
  }
  
  logInfo(`Found ${files.length} JSON files to process`);
  console.log();
  
  // Process each file
  let totalProcessed = 0;
  let totalRemoved = 0;
  let totalSpots = 0;
  let failedFiles = 0;
  
  for (const filePath of files) {
    const result = processSpotFile(filePath);
    
    if (result.processed) {
      totalProcessed++;
      totalRemoved += result.removed;
      totalSpots += result.total;
    } else {
      failedFiles++;
    }
    
    console.log();
  }
  
  // Summary
  logInfo('=== SUMMARY ===');
  logSuccess(`Processed files: ${totalProcessed}/${files.length}`);
  if (failedFiles > 0) {
    logError(`Failed files: ${failedFiles}`);
  }
  logSuccess(`Total spots processed: ${totalSpots}`);
  logSuccess(`Total spots removed: ${totalRemoved}`);
  
  if (totalRemoved > 0) {
    logInfo(`Backups saved in: ${BACKUP_DIR}`);
  }
  
  console.log();
  logSuccess('Spot cleanup process completed!');
}

// Show help
function showHelp() {
  console.log(`
Usage: node scripts/remove_spots_without_images.js

This script removes spots from JSON files in ${SPOTS_DIR} that don't have an 'image' field.

Features:
- Creates backups before making changes
- Removes spots with missing or empty 'image' fields
- Provides detailed logging
- Shows summary of changes

Backup location: ${BACKUP_DIR}

Example:
  node scripts/remove_spots_without_images.js
`);
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Run main function
main(); 