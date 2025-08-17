#!/usr/bin/env node

/**
 * Fix scenic area coordinates by fetching actual coordinates for each scenic area
 * Usage: node scripts/fix-scenic-area-coordinates.js <province> <city>
 */

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { amapCoordinateService } from '../services/amapCoordinateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixScenicAreaCoordinates(province, city) {
  console.log(`🔧 Fixing scenic area coordinates for ${province}/${city}`);
  
  try {
    // Read scenic area file
    const scenicAreaFilePath = path.join(__dirname, '..', 'assets', province, city, 'data', 'scenic-area.json');
    
    if (!fs.existsSync(scenicAreaFilePath)) {
      throw new Error(`Scenic area file not found: ${scenicAreaFilePath}`);
    }
    
    const scenicAreaData = JSON.parse(fs.readFileSync(scenicAreaFilePath, 'utf8'));
    
    if (!scenicAreaData.scenicAreas || !Array.isArray(scenicAreaData.scenicAreas)) {
      throw new Error('No scenic areas found in data file');
    }
    
    console.log(`📊 Found ${scenicAreaData.scenicAreas.length} scenic areas to fix`);
    
    // Process each scenic area
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const [index, scenicArea] of scenicAreaData.scenicAreas.entries()) {
      console.log(`\n🔄 Processing ${index + 1}/${scenicAreaData.scenicAreas.length}: ${scenicArea.name}`);
      
      // Check if coordinates are fallback (all same coordinates)
      const isFallback = scenicArea.coordinateInfo?.source === 'fallback' ||
                        (scenicArea.center?.lat === 34.7466 && scenicArea.center?.lng === 113.6253);
      
      if (!isFallback) {
        console.log(`✅ ${scenicArea.name} already has valid coordinates, skipping`);
        continue;
      }
      
      try {
        // Build search query with name and address
        const searchQuery = `${scenicArea.name} ${scenicArea.address || ''}`.trim();
        console.log(`🔍 Searching coordinates for: "${searchQuery}"`);
        
        // Get coordinates using AMap service
        const coordinates = await amapCoordinateService.getCoordinates(searchQuery);
        
        if (coordinates && coordinates.lat && coordinates.lng) {
          // Update scenic area with new coordinates
          scenicArea.center = {
            lat: coordinates.lat,
            lng: coordinates.lng
          };
          
          scenicArea.coordinateInfo = {
            source: 'amap_geocoding',
            status: 'success',
            query: searchQuery,
            timestamp: new Date().toISOString()
          };
          
          console.log(`✅ Updated coordinates for ${scenicArea.name}:`);
          console.log(`   📍 ${coordinates.lat}, ${coordinates.lng}`);
          
          fixedCount++;
        } else {
          console.log(`❌ No coordinates found for ${scenicArea.name}`);
          errorCount++;
        }
        
        // Add delay to avoid rate limiting
        if (index < scenicAreaData.scenicAreas.length - 1) {
          console.log(`⏱️ Adding 1 second delay...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Error getting coordinates for ${scenicArea.name}: ${error.message}`);
        errorCount++;
      }
    }
    
    // Save updated data
    fs.writeFileSync(scenicAreaFilePath, JSON.stringify(scenicAreaData, null, 2));
    
    console.log(`\n✅ Coordinate fixing completed:`);
    console.log(`   🔧 Fixed: ${fixedCount} scenic areas`);
    console.log(`   ❌ Errors: ${errorCount} scenic areas`);
    console.log(`   💾 Updated file: ${scenicAreaFilePath}`);
    
    if (fixedCount > 0) {
      console.log(`\n🔄 Next steps:`);
      console.log(`   1. Re-run spots search for areas with updated coordinates:`);
      console.log(`      node scripts/search-spots-in-city.js ${province} ${city}`);
      console.log(`   2. Clear cache to see updated data in frontend:`);
      console.log(`      node scripts/clear-city-cache.js ${city}`);
    }
    
    return {
      total: scenicAreaData.scenicAreas.length,
      fixed: fixedCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error(`❌ Error fixing coordinates: ${error.message}`);
    throw error;
  }
}

// Main function
async function main() {
  if (process.argv.length < 4) {
    console.error('Usage: node scripts/fix-scenic-area-coordinates.js <province> <city>');
    console.error('Example: node scripts/fix-scenic-area-coordinates.js henan 郑州');
    process.exit(1);
  }
  
  const province = process.argv[2];
  const city = process.argv[3];
  
  try {
    const result = await fixScenicAreaCoordinates(province, city);
    console.log(`\n🎉 Successfully processed ${result.total} scenic areas`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fixScenicAreaCoordinates };
