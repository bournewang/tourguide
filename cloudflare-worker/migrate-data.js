#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudflare Worker API endpoint
// const WORKER_URL = 'https://tourguide-backend.xiaopei0206.workers.dev';
// const WORKER_URL = 'http://localhost:8787';
const WORKER_URL = 'https://worker.qingfan.org';

// Data source paths
const DATA_DIR = path.join(__dirname, '../public/data');
const SPOTS_DIR = path.join(DATA_DIR, 'spots');
const SCENIC_AREAS_FILE = path.join(DATA_DIR, 'scenic-area.json');

async function uploadScenicAreas() {
  console.log('🏔️  Uploading scenic areas data...');
  
  try {
    const scenicAreasData = JSON.parse(fs.readFileSync(SCENIC_AREAS_FILE, 'utf8'));
    
    const response = await fetch(`${WORKER_URL}/api/scenic-areas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        areaData: scenicAreasData
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log('✅ Scenic areas uploaded successfully');
    return result;
  } catch (error) {
    console.error('❌ Failed to upload scenic areas:', error.message);
    throw error;
  }
}

async function uploadSpotData(areaName, spotsFile) {
  console.log(`📍 Uploading spots data for ${areaName}...`);
  
  try {
    const spotsFilePath = path.join(SPOTS_DIR, spotsFile);
    const spotsData = JSON.parse(fs.readFileSync(spotsFilePath, 'utf8'));
    
    const response = await fetch(`${WORKER_URL}/api/spots`, {
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
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log(`✅ Spots data uploaded for ${areaName} (${spotsData.length} spots)`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to upload spots data for ${areaName}:`, error.message);
    throw error;
  }
}

async function verifyData() {
  console.log('🔍 Verifying uploaded data...');
  
  try {
    // Verify scenic areas
    const scenicAreasResponse = await fetch(`${WORKER_URL}/api/scenic-areas`);
    if (!scenicAreasResponse.ok) {
      throw new Error('Failed to fetch scenic areas');
    }
    const scenicAreas = await scenicAreasResponse.json();
    console.log(`✅ Scenic areas verified: ${scenicAreas.length} areas`);

    // Verify each area's spots
    for (const area of scenicAreas) {
      const spotsResponse = await fetch(`${WORKER_URL}/api/spots?area=${encodeURIComponent(area.name)}`);
      if (!spotsResponse.ok) {
        throw new Error(`Failed to fetch spots for ${area.name}`);
      }
      const spots = await spotsResponse.json();
      console.log(`✅ Spots verified for ${area.name}: ${spots.length} spots`);
    }
    
    console.log('🎉 All data verification completed successfully!');
  } catch (error) {
    console.error('❌ Data verification failed:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting data migration to Cloudflare KV storage...');
  console.log(`📡 Worker URL: ${WORKER_URL}`);
  
  try {
    // Step 1: Upload scenic areas data
    await uploadScenicAreas();
    
    // Step 2: Read scenic areas to get the list of spot files
    const scenicAreasData = JSON.parse(fs.readFileSync(SCENIC_AREAS_FILE, 'utf8'));
    
    // Step 3: Upload each area's spots data
    for (const area of scenicAreasData) {
      const spotsFile = area.spotsFile.replace('spots/', ''); // Remove 'spots/' prefix
      await uploadSpotData(area.name, spotsFile);
    }
    
    // Step 4: Verify all data was uploaded correctly
    await verifyData();
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📋 Migration Summary:');
    console.log(`   • Scenic areas: ${scenicAreasData.length}`);
    console.log(`   • Spot files: ${scenicAreasData.length}`);
    console.log('');
    console.log('🔄 Next steps:');
    console.log('   1. Update frontend to load data from Cloudflare APIs');
    console.log('   2. Test the application with cloud-based data');
    console.log('   3. Remove local JSON files if everything works correctly');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { uploadScenicAreas, uploadSpotData, verifyData }; 