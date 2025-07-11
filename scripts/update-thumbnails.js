#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPOTS_DIR = path.join(__dirname, '../src/data/spots');

function updateImageThumbPaths() {
  console.log('🖼️  Updating image_thumb paths from /spots/ to /spots-thumb/...');
  
  let updatedFiles = 0;
  let updatedSpots = 0;
  
  try {
    // Read all JSON files in spots directory
    const files = fs.readdirSync(SPOTS_DIR).filter(file => file.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(SPOTS_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const spots = JSON.parse(fileContent);
      
      let fileChanged = false;
      
      // Update each spot's image_thumb path
      for (const spot of spots) {
        if (spot.image_thumb && spot.image_thumb.startsWith('/spots/')) {
          const oldPath = spot.image_thumb;
          spot.image_thumb = spot.image_thumb.replace('/spots/', '/spots-thumb/');
          console.log(`  Updated ${spot.name}: ${oldPath} -> ${spot.image_thumb}`);
          fileChanged = true;
          updatedSpots++;
        }
      }
      
      // Write back to file if changed
      if (fileChanged) {
        fs.writeFileSync(filePath, JSON.stringify(spots, null, 2), 'utf8');
        console.log(`✅ Updated file: ${file}`);
        updatedFiles++;
      }
    }
    
    console.log('\n📊 Update Summary:');
    console.log(`   • Files updated: ${updatedFiles}`);
    console.log(`   • Spots updated: ${updatedSpots}`);
    
    if (updatedFiles > 0) {
      console.log('\n🚀 Next steps:');
      console.log('   1. Run: cd cloudflare-worker && node migrate-data.js');
      console.log('   2. This will sync all updated data to Cloudflare KV storage');
    } else {
      console.log('\n✨ No updates needed - all image_thumb paths already use /spots-thumb/');
    }
    
  } catch (error) {
    console.error('❌ Error updating image_thumb paths:', error.message);
    process.exit(1);
  }
}

// Run the update
updateImageThumbPaths(); 