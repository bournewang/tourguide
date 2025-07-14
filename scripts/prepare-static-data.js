#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use public/data as both source and destination since it's already the correct location
const PUBLIC_DATA_DIR = path.join(__dirname, '../public/data');

// Update image and audio paths in JSON files for static serving
function updatePathsInJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    let updated = false;
    
    // Process array of spots
    if (Array.isArray(data)) {
      for (const spot of data) {
        // Update image_thumb paths - keep as-is for static serving
        if (spot.image_thumb && spot.image_thumb.startsWith('/spots-thumb/')) {
          // Keep as-is for static serving
          continue;
        }
        
        // Update audioFile paths to be relative for static serving
        if (spot.audioFile && spot.audioFile.startsWith('/api/audio/')) {
          spot.audioFile = spot.audioFile.replace('/api/audio/', '/audio/');
          updated = true;
        }
        
        // Also handle full worker URLs and convert them to /audio/ format
        if (spot.audioFile && spot.audioFile.includes('/api/audio/')) {
          const match = spot.audioFile.match(/\/api\/audio\/(.+)$/);
          if (match) {
            spot.audioFile = `/audio/${match[1]}`;
            updated = true;
          }
        }
        
        // Update imageSequence paths if needed
        if (spot.imageSequence && Array.isArray(spot.imageSequence)) {
          for (const image of spot.imageSequence) {
            if (image.img && image.img.startsWith('/api/')) {
              // Convert API paths to static paths
              image.img = image.img.replace('/api/', '/');
              updated = true;
            }
          }
        }
      }
    }
    
    if (updated) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`🔄 Updated paths in: ${path.basename(filePath)}`);
    }
    
    return updated;
  } catch (error) {
    console.error(`❌ Failed to update paths in ${path.basename(filePath)}:`, error.message);
    return false;
  }
}

// Main function
function prepareStaticData() {
  console.log('🚀 Fixing audio and image paths in static data...');
  console.log(`📂 Data directory: ${PUBLIC_DATA_DIR}`);
  console.log('');
  
  try {
    // Check if public/data directory exists
    if (!fs.existsSync(PUBLIC_DATA_DIR)) {
      console.error(`❌ Data directory not found: ${PUBLIC_DATA_DIR}`);
      console.log('💡 Tip: Run "cd cloudflare-worker && node sync-from-cloudflare.js" first to sync data from Cloudflare');
      process.exit(1);
    }
    
    // Check if scenic-area.json exists
    const scenicAreaFile = path.join(PUBLIC_DATA_DIR, 'scenic-area.json');
    if (!fs.existsSync(scenicAreaFile)) {
      console.error(`❌ scenic-area.json not found in data directory`);
      console.log('💡 Tip: Run "cd cloudflare-worker && node sync-from-cloudflare.js" first to sync data from Cloudflare');
      process.exit(1);
    }
    
    console.log('🔄 Updating file paths for static serving...');
    
    // Update paths in JSON files
    let updatedFiles = 0;
    
    // Update scenic-area.json
    if (fs.existsSync(scenicAreaFile)) {
      if (updatePathsInJson(scenicAreaFile)) {
        updatedFiles++;
      }
    }
    
    // Update spot files
    const spotsDir = path.join(PUBLIC_DATA_DIR, 'spots');
    if (fs.existsSync(spotsDir)) {
      const spotFiles = fs.readdirSync(spotsDir).filter(file => file.endsWith('.json'));
      
      for (const file of spotFiles) {
        const filePath = path.join(spotsDir, file);
        if (updatePathsInJson(filePath)) {
          updatedFiles++;
        }
      }
    }
    
    console.log('');
    console.log('🎉 Static data path fixing completed!');
    console.log(`📊 Updated ${updatedFiles} files`);
    console.log('');
    console.log('✅ Your static data is now ready for production deployment');
    console.log('');
    console.log('📋 Summary:');
    console.log('  • Fixed /api/audio/ → /audio/ paths');
    console.log('  • Fixed /api/ → / paths for images');
    console.log('  • Data files are in public/data/');
    
  } catch (error) {
    console.error('❌ Error preparing static data:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  prepareStaticData();
} 