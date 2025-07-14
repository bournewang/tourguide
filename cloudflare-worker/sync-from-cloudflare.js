#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { Buffer } from 'buffer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudflare Worker API endpoint
const WORKER_URL = 'https://worker.qingfan.org';

// Local data paths
const LOCAL_DATA_DIR = path.join(__dirname, '../public/data');
const LOCAL_SPOTS_DIR = path.join(LOCAL_DATA_DIR, 'spots');
const LOCAL_SCENIC_AREAS_FILE = path.join(LOCAL_DATA_DIR, 'scenic-area.json');
const LOCAL_AUDIO_DIR = path.join(__dirname, '../public/audio');

// Create directories if they don't exist
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
}

// Download scenic areas data from Cloudflare
async function downloadScenicAreas() {
  console.log('🏔️  Downloading scenic areas data from Cloudflare...');
  
  try {
    const response = await fetch(`${WORKER_URL}/api/scenic-areas`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const scenicAreasData = await response.json();
    
    // Ensure local data directory exists
    ensureDirectoryExists(LOCAL_DATA_DIR);
    
    // Write to local file
    fs.writeFileSync(LOCAL_SCENIC_AREAS_FILE, JSON.stringify(scenicAreasData, null, 2), 'utf8');
    
    console.log(`✅ Downloaded scenic areas data (${scenicAreasData.length} areas)`);
    return scenicAreasData;
  } catch (error) {
    console.error('❌ Failed to download scenic areas:', error.message);
    throw error;
  }
}

// Download spot data for a specific area from Cloudflare
async function downloadSpotData(areaName, spotsFileName) {
  console.log(`📍 Downloading spots data for ${areaName}...`);
  
  try {
    const response = await fetch(`${WORKER_URL}/api/spots?area=${encodeURIComponent(areaName)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const spotsData = await response.json();
    
    // Ensure local spots directory exists
    ensureDirectoryExists(LOCAL_SPOTS_DIR);
    
    // Write to local file
    const localFilePath = path.join(LOCAL_SPOTS_DIR, spotsFileName);
    fs.writeFileSync(localFilePath, JSON.stringify(spotsData, null, 2), 'utf8');
    
    console.log(`✅ Downloaded spots data for ${areaName} (${spotsData.length} spots)`);
    return spotsData;
  } catch (error) {
    console.error(`❌ Failed to download spots data for ${areaName}:`, error.message);
    throw error;
  }
}

// Download audio file from Cloudflare R2
async function downloadAudioFile(fileName) {
  console.log(`🎵 Downloading audio file: ${fileName}`);
  
  try {
    const response = await fetch(`${WORKER_URL}/api/audio/${encodeURIComponent(fileName)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`⚠️  Audio file not found: ${fileName}`);
        return false;
      }
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Ensure local audio directory exists
    ensureDirectoryExists(LOCAL_AUDIO_DIR);
    
    // Write to local file
    const localFilePath = path.join(LOCAL_AUDIO_DIR, fileName);
    fs.writeFileSync(localFilePath, Buffer.from(audioBuffer));
    
    const fileSizeKB = (audioBuffer.byteLength / 1024).toFixed(2);
    console.log(`✅ Downloaded audio file: ${fileName} (${fileSizeKB} KB)`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to download audio file ${fileName}:`, error.message);
    return false;
  }
}

// Extract audio file names from spot data
function extractAudioFileNames(spotsData) {
  const audioFiles = new Set();
  
  for (const spot of spotsData) {
    if (spot.audioFile) {
      // Handle both formats: "/api/audio/filename.mp3" and "/audio/filename.mp3"
      let match = spot.audioFile.match(/\/(?:api\/)?audio\/(.+)$/);
      if (match) {
        audioFiles.add(decodeURIComponent(match[1]));
      }
      // Also handle full URLs like "https://worker.qingfan.org/api/audio/filename.mp3"
      else if (spot.audioFile.includes('/api/audio/')) {
        match = spot.audioFile.match(/\/api\/audio\/(.+)$/);
        if (match) {
          audioFiles.add(decodeURIComponent(match[1]));
        }
      }
    }
  }
  
  return Array.from(audioFiles);
}

// Sync all data from Cloudflare to local filesystem
async function syncFromCloudflare(options = {}) {
  const { downloadAudio = true, downloadJson = true } = options;
  
  console.log('🚀 Starting sync from Cloudflare to local filesystem...');
  console.log(`📡 Worker URL: ${WORKER_URL}`);
  console.log(`📁 Local data directory: ${LOCAL_DATA_DIR}`);
  console.log(`🎵 Local audio directory: ${LOCAL_AUDIO_DIR}`);
  console.log('');
  
  try {
    let allSpotsData = [];
    let totalAudioFiles = 0;
    let downloadedAudioFiles = 0;
    
    if (downloadJson) {
      // Step 1: Download scenic areas data
      const scenicAreasData = await downloadScenicAreas();
      
      // Step 2: Download each area's spots data
      for (const area of scenicAreasData) {
        const spotsFileName = area.spotsFile.replace('spots/', ''); // Remove 'spots/' prefix if present
        const spotsData = await downloadSpotData(area.name, spotsFileName);
        allSpotsData = allSpotsData.concat(spotsData);
      }
      
      console.log('');
    } else {
      // If not downloading JSON, we need to read existing local data to get audio files
      console.log('📖 Reading existing local data for audio file references...');
      
      if (fs.existsSync(LOCAL_SCENIC_AREAS_FILE)) {
        const scenicAreasData = JSON.parse(fs.readFileSync(LOCAL_SCENIC_AREAS_FILE, 'utf8'));
        
        for (const area of scenicAreasData) {
          const spotsFileName = area.spotsFile.replace('spots/', '');
          const spotsFilePath = path.join(LOCAL_SPOTS_DIR, spotsFileName);
          
          if (fs.existsSync(spotsFilePath)) {
            const spotsData = JSON.parse(fs.readFileSync(spotsFilePath, 'utf8'));
            allSpotsData = allSpotsData.concat(spotsData);
          }
        }
      }
    }
    
    if (downloadAudio && allSpotsData.length > 0) {
      // Step 3: Download audio files
      console.log('🎵 Downloading audio files...');
      
      const audioFileNames = extractAudioFileNames(allSpotsData);
      totalAudioFiles = audioFileNames.length;
      
      if (totalAudioFiles > 0) {
        console.log(`Found ${totalAudioFiles} audio files to download`);
        
        for (const fileName of audioFileNames) {
          const success = await downloadAudioFile(fileName);
          if (success) {
            downloadedAudioFiles++;
          }
        }
      } else {
        console.log('No audio files found in spot data');
      }
      
      console.log('');
    }
    
    // Summary
    console.log('🎉 Sync completed successfully!');
    console.log('');
    console.log('📋 Sync Summary:');
    
    if (downloadJson) {
      const scenicAreasData = JSON.parse(fs.readFileSync(LOCAL_SCENIC_AREAS_FILE, 'utf8'));
      console.log(`   • Scenic areas: ${scenicAreasData.length}`);
      console.log(`   • Total spots: ${allSpotsData.length}`);
      console.log(`   • JSON files: ${scenicAreasData.length + 1} (scenic-area.json + spot files)`);
    }
    
    if (downloadAudio) {
      console.log(`   • Audio files found: ${totalAudioFiles}`);
      console.log(`   • Audio files downloaded: ${downloadedAudioFiles}`);
      if (totalAudioFiles > downloadedAudioFiles) {
        console.log(`   • Audio files missing: ${totalAudioFiles - downloadedAudioFiles}`);
      }
    }
    
    console.log('');
    console.log('✨ Local filesystem is now synced with Cloudflare data!');
    
  } catch (error) {
    console.error('💥 Sync failed:', error.message);
    process.exit(1);
  }
}

// Command line interface
function showHelp() {
  console.log('Usage: node sync-from-cloudflare.js [OPTIONS]');
  console.log('');
  console.log('Sync data from Cloudflare KV storage and R2 bucket to local filesystem');
  console.log('');
  console.log('Options:');
  console.log('  --json-only     Download only JSON data (skip audio files)');
  console.log('  --audio-only    Download only audio files (skip JSON data)');
  console.log('  --help          Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node sync-from-cloudflare.js                # Sync everything');
  console.log('  node sync-from-cloudflare.js --json-only    # Sync only JSON files');
  console.log('  node sync-from-cloudflare.js --audio-only   # Sync only audio files');
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    showHelp();
    return;
  }
  
  const options = {
    downloadJson: !args.includes('--audio-only'),
    downloadAudio: !args.includes('--json-only')
  };
  
  await syncFromCloudflare(options);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { syncFromCloudflare, downloadScenicAreas, downloadSpotData, downloadAudioFile }; 