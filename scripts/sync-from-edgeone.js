#!/usr/bin/env node

/**
 * Sync script to download data from EdgeOne KV storage to local assets
 * Usage: node scripts/sync-from-edgeone.js [data-folder]
 * Example: node scripts/sync-from-edgeone.js assets/henan/dengfeng/data
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_BASE = process.env.EDGEONE_API_URL || 'https://df.qingfan.wang';
const PROVINCE_NAME = process.env.PROVINCE_NAME || 'henan';
const CITY_NAME = process.env.CITY_NAME || 'dengfeng';

// Get data folder from command line argument or use default
const DATA_FOLDER =
  process.argv[2] ||
  path.join(__dirname, '..', 'assets', PROVINCE_NAME, CITY_NAME, 'data');

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

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// API functions
async function fetchScenicAreas() {
  try {
    logInfo('Fetching scenic areas data from EdgeOne KV...');
    
    const response = await fetch(`${API_BASE}/api/scenic-areas`);
    
    if (!response.ok) {
      throw new Error(`API error (${response.status}): ${response.statusText}`);
    }

    const scenicAreas = await response.json();
    logSuccess(`Fetched ${scenicAreas.length} scenic areas`);
    return scenicAreas;
  } catch (error) {
    logError(`Failed to fetch scenic areas: ${error.message}`);
    throw error;
  }
}

async function fetchSpotsData(areaName) {
  try {
    const response = await fetch(`${API_BASE}/api/spots?area=${encodeURIComponent(areaName)}`);
    
    if (!response.ok) {
      throw new Error(`API error (${response.status}): ${response.statusText}`);
    }

    const spotsData = await response.json();
    return spotsData;
  } catch (error) {
    logError(`Failed to fetch spots for ${areaName}: ${error.message}`);
    throw error;
  }
}

// File operations
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
    logInfo(`Created directory: ${dirPath}`);
  }
}

async function writeJsonFile(filePath, data) {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonString, 'utf8');
    logSuccess(`Written: ${filePath}`);
  } catch (error) {
    logError(`Failed to write ${filePath}: ${error.message}`);
    throw error;
  }
}

async function backupExistingFile(filePath) {
  try {
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (exists) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await fs.copyFile(filePath, backupPath);
      logInfo(`Backed up: ${filePath} → ${backupPath}`);
    }
  } catch (error) {
    logWarning(`Failed to backup ${filePath}: ${error.message}`);
  }
}

// Main sync function
async function syncFromEdgeOne() {
  try {
    log('🔄 Starting sync from EdgeOne KV storage...', 'bright');
    log(`📁 Target folder: ${DATA_FOLDER}`, 'cyan');
    log(`🌐 API endpoint: ${API_BASE}`, 'cyan');
    log('');

    // Ensure target directory exists
    await ensureDirectoryExists(DATA_FOLDER);
    await ensureDirectoryExists(path.join(DATA_FOLDER, 'spots'));

    // Step 1: Fetch scenic areas data
    const scenicAreas = await fetchScenicAreas();
    
    if (scenicAreas.length === 0) {
      logWarning('No scenic areas found in KV storage');
      return;
    }

    // Step 2: Backup and write scenic areas file
    const scenicAreasPath = path.join(DATA_FOLDER, 'scenic-area.json');
    await backupExistingFile(scenicAreasPath);
    await writeJsonFile(scenicAreasPath, scenicAreas);
    log('');

    // Step 3: Fetch and write spots data for each area
    let totalSpots = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const area of scenicAreas) {
      try {
        logInfo(`Processing area: ${area.name}`);
        
        // Fetch spots data
        const spotsData = await fetchSpotsData(area.name);
        
        if (spotsData.length === 0) {
          logWarning(`No spots data found for ${area.name}`);
          continue;
        }

        // Determine the spots file path from the scenic area data
        const spotsFileName = area.spotsFile || `spots/${area.name}.json`;
        const spotsFilePath = path.join(DATA_FOLDER, spotsFileName);
        
        // Ensure spots directory exists
        const spotsDir = path.dirname(spotsFilePath);
        await ensureDirectoryExists(spotsDir);
        
        // Backup existing file
        await backupExistingFile(spotsFilePath);
        
        // Write spots data
        await writeJsonFile(spotsFilePath, spotsData);
        
        totalSpots += spotsData.length;
        successCount++;
        
        logSuccess(`Completed: ${area.name} (${spotsData.length} spots)`);
        log('');
      } catch (error) {
        errorCount++;
        logError(`Failed to process ${area.name}: ${error.message}`);
        log('');
      }
    }

    // Summary
    log('📊 Sync Summary:', 'bright');
    log(`   Scenic Areas: ${scenicAreas.length}`, 'cyan');
    log(`   Total Spots: ${totalSpots}`, 'cyan');
    log(`   Successful Areas: ${successCount}`, 'green');
    log(`   Failed Areas: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
    log(`   Target Folder: ${DATA_FOLDER}`, 'cyan');
    
    if (errorCount === 0) {
      log('🎉 Sync completed successfully!', 'bright');
    } else {
      log(`⚠️  Sync completed with ${errorCount} errors`, 'yellow');
    }

  } catch (error) {
    logError(`Sync failed: ${error.message}`);
    process.exit(1);
  }
}

// Validate command line arguments
function validateArgs() {
  if (process.argv.length > 3) {
    logError('Too many arguments. Usage: node scripts/sync-from-edgeone.js [data-folder]');
    process.exit(1);
  }
}

// Run sync if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateArgs();
  syncFromEdgeOne();
}

export { syncFromEdgeOne }; 