#!/usr/bin/env node

/**
 * Migration script to upload local data to EdgeOne KV storage
 * Usage: 
 *   node scripts/migrate-to-edgeone.js                    # Migrate all data
 *   node scripts/migrate-to-edgeone.js <spot-file>        # Migrate specific spot file
 * 
 * Examples:
 *   node scripts/migrate-to-edgeone.js
 *   node scripts/migrate-to-edgeone.js spots/fawangsi.json
 *   node scripts/migrate-to-edgeone.js spots/songyangshuyuan.json
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_BASE = process.env.EDGEONE_API_URL || 'https://worker.qingfan.org';
const DATA_SOURCE_PATH = path.join(__dirname, '../assets/dengfeng/data');

// Get command line arguments
const TARGET_SPOT_FILE = process.argv[2]; // Optional: specific spot file to migrate

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}



// API functions
async function uploadScenicAreas(scenicAreasData) {
  try {
    logInfo('Uploading scenic areas data...');
    
    const response = await fetch(`${API_BASE}/api/scenic-areas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        areaData: scenicAreasData
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error (${response.status}): ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    logSuccess(`Scenic areas uploaded successfully: ${scenicAreasData.length} areas`);
    return result;
  } catch (error) {
    logError(`Failed to upload scenic areas: ${error.message}`);
    throw error;
  }
}

async function checkSpotsExist(areaName) {
  try {
    const response = await fetch(`${API_BASE}/api/spots?area=${encodeURIComponent(areaName)}`);
    
    if (!response.ok) {
      return false;
    }

    const existingData = await response.json();
    const exists = Array.isArray(existingData) && existingData.length > 0;
    
    if (exists) {
      logInfo(`Spots data for ${areaName} already exists (${existingData.length} spots). Will overwrite.`);
    }
    
    return exists;
  } catch {
    return false;
  }
}

async function uploadSpotsData(areaName, spotsData) {
  try {
    logInfo(`Uploading spots data for area: ${areaName}`);
    
    const response = await fetch(`${API_BASE}/api/spots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        areaName,
        spotData: spotsData
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error (${response.status}): ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    const spotCount = spotsData.results ? spotsData.results.length : spotsData.length;
    logSuccess(`Spots data uploaded for ${areaName}: ${spotCount} spots`);
    return result;
  } catch (error) {
    logError(`Failed to upload spots for ${areaName}: ${error.message}`);
    throw error;
  }
}

// Data loading functions
async function loadScenicAreas() {
  try {
    const filePath = path.join(DATA_SOURCE_PATH, 'scenic-area.json');
    const data = await fs.readFile(filePath, 'utf8');
    const scenicAreas = JSON.parse(data);
    logSuccess(`Loaded scenic areas data: ${scenicAreas.length} areas`);
    return scenicAreas;
  } catch (error) {
    logError(`Failed to load scenic areas: ${error.message}`);
    throw error;
  }
}

function normalizeSpotFileName(spotFileName) {
  // Remove the data source path prefix if present
  if (spotFileName.startsWith(DATA_SOURCE_PATH)) {
    return path.relative(DATA_SOURCE_PATH, spotFileName);
  }
  
  // Remove leading slash and normalize path separators
  return spotFileName.replace(/^\/+/, '').replace(/\\/g, '/');
}

async function loadSpotsData(spotsFilePath) {
  try {
    const filePath = path.join(DATA_SOURCE_PATH, spotsFilePath);
    const data = await fs.readFile(filePath, 'utf8');
    const spotsData = JSON.parse(data);
    
    // Handle both old format (array) and new format (Baidu Map search result)
    const spotCount = spotsData.results ? spotsData.results.length : spotsData.length;
    logInfo(`Loaded spots data: ${spotCount} spots`);
    return spotsData;
  } catch (error) {
    logError(`Failed to load spots data from ${spotsFilePath}: ${error.message}`);
    throw error;
  }
}

// Main migration function
async function migrateData() {
  try {
    log('🚀 Starting data migration to EdgeOne KV storage...', 'bright');
    log(`📁 Source path: ${DATA_SOURCE_PATH}`, 'cyan');
    log(`🌐 API endpoint: ${API_BASE}`, 'cyan');
    
    if (TARGET_SPOT_FILE) {
      log(`🎯 Target spot file: ${TARGET_SPOT_FILE}`, 'magenta');
    }
    log('');

    // Step 1: Load scenic areas data
    const scenicAreas = await loadScenicAreas();
    
    // Step 2: Always upload scenic areas data first (spots data depends on it)
    await uploadScenicAreas(scenicAreas);
    log('');

    if (TARGET_SPOT_FILE) {
      // Migrate specific spot file only
      await migrateSpecificSpotFile(TARGET_SPOT_FILE, scenicAreas);
    } else {
      // Migrate all spot files
      await migrateAllSpotFiles(scenicAreas);
    }

  } catch (error) {
    logError(`Migration failed: ${error.message}`);
    process.exit(1);
  }
}

async function migrateSpecificSpotFile(spotFileName, scenicAreas) {
  try {
    log('🎯 Migrating specific spot file...', 'bright');
    
    // Normalize the spot file name to handle both relative and absolute paths
    const normalizedSpotFileName = normalizeSpotFileName(spotFileName);
    logInfo(`Normalized spot file name: ${normalizedSpotFileName}`);
    
    // Find the area that contains this spot file
    const area = scenicAreas.find(area => area.spotsFile === normalizedSpotFileName);
    
    if (!area) {
      // Try to find by just the filename
      const fileName = path.basename(spotFileName);
      const areaByFileName = scenicAreas.find(area => path.basename(area.spotsFile) === fileName);
      
      if (areaByFileName) {
        logInfo(`Found area by filename: ${areaByFileName.name} (${areaByFileName.spotsFile})`);
        const area = areaByFileName;
        
        // Check if spots data for this area already exists (for info only)
        await checkSpotsExist(area.name);

        // Load spots data
        const spotsData = await loadSpotsData(area.spotsFile);
        
        // Upload spots data (will overwrite if exists)
        await uploadSpotsData(area.name, spotsData);
        
        // Update counters
        const spotCount = spotsData.results ? spotsData.results.length : spotsData.length;
        
        logSuccess(`Completed: ${area.name} (${spotCount} spots)`);
        log('📊 Migration Summary:', 'bright');
        log(`   Scenic Areas: ${scenicAreas.length}`, 'cyan');
        log(`   Total Spots: ${spotCount}`, 'cyan');
        log(`   Successful Areas: 1`, 'green');
        log(`   Failed Areas: 0`, 'green');
        log('🎉 Migration completed successfully!', 'bright');
      } else {
        throw new Error(`No area found with spots file: ${spotFileName} (tried: ${normalizedSpotFileName} and filename: ${fileName})`);
      }
    } else {
      logInfo(`Found area: ${area.name} for spot file: ${normalizedSpotFileName}`);
      
      // Check if spots data for this area already exists (for info only)
      await checkSpotsExist(area.name);

      // Load spots data
      const spotsData = await loadSpotsData(area.spotsFile);
      
      // Upload spots data (will overwrite if exists)
      await uploadSpotsData(area.name, spotsData);
      
      // Update counters
      const spotCount = spotsData.results ? spotsData.results.length : spotsData.length;
      
      logSuccess(`Completed: ${area.name} (${spotCount} spots)`);
      log('📊 Migration Summary:', 'bright');
      log(`   Scenic Areas: ${scenicAreas.length}`, 'cyan');
      log(`   Total Spots: ${spotCount}`, 'cyan');
      log(`   Successful Areas: 1`, 'green');
      log(`   Failed Areas: 0`, 'green');
      log('🎉 Migration completed successfully!', 'bright');
    }
    
  } catch (error) {
    logError(`Failed to migrate spot file ${spotFileName}: ${error.message}`);
    throw error;
  }
}

async function migrateAllSpotFiles(scenicAreas) {
  // Step 3: Load and upload spots data for each area
  let totalSpots = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const area of scenicAreas) {
    try {
      logInfo(`Processing area: ${area.name}`);
      
      // Check if spots data for this area already exists (for info only)
      await checkSpotsExist(area.name);

      // Load spots data
      const spotsData = await loadSpotsData(area.spotsFile);
      
      // Upload spots data (will overwrite if exists)
      await uploadSpotsData(area.name, spotsData);
      
      // Update counters
      const spotCount = spotsData.results ? spotsData.results.length : spotsData.length;
      totalSpots += spotCount;
      successCount++;
      
      logSuccess(`Completed: ${area.name} (${spotCount} spots)`);
      log('');
    } catch (error) {
      errorCount++;
      logError(`Failed to process ${area.name}: ${error.message}`);
      log('');
    }
  }

  // Summary
  log('📊 Migration Summary:', 'bright');
  log(`   Scenic Areas: ${scenicAreas.length}`, 'cyan');
  log(`   Total Spots: ${totalSpots}`, 'cyan');
  log(`   Successful Areas: ${successCount}`, 'green');
  log(`   Failed Areas: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
  
  if (errorCount === 0) {
    log('🎉 Migration completed successfully!', 'bright');
  } else {
    log(`⚠️  Migration completed with ${errorCount} errors`, 'yellow');
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateData();
}

export { migrateData }; 