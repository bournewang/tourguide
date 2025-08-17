#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { amapSpotsService } from '../services/amapSpotsService.js';
import AIScenicAreasService from '../services/aiScenicAreasService.js';
import { amapCoordinateService } from '../services/amapCoordinateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize services
const aiScenicAreasService = new AIScenicAreasService();

/**
 * Search for spots in all scenic areas for a province/city
 * @param {string} province - Province name
 * @param {string} city - City name
 * @param {Object} options - Search options
 */
async function searchSpotsInAllScenicAreas(province, city, options = {}) {
  console.log(`🔍 Searching for spots in all scenic areas in ${province}/${city}`);
  
  try {
    // Get scenic areas from AI service
    console.log(`📊 Fetching scenic areas for ${province}...`);
    const scenicAreasData = await aiScenicAreasService.getScenicAreasByProvince(province);
    
    if (!scenicAreasData || !scenicAreasData.cities) {
      throw new Error(`No scenic areas data found for ${province}`);
    }
    
    // Filter for the specific city
    const cityAreas = scenicAreasData.cities[city];
    if (!cityAreas || cityAreas.length === 0) {
      throw new Error(`No scenic areas found for ${city} in ${province}`);
    }
    
    console.log(`📊 Found ${cityAreas.length} scenic areas in ${city}`);
    
    // Set output directory
    let outputDir = options.outputDir;
    if (!outputDir) {
      outputDir = path.join('assets', province, city, 'data', 'spots');
    }
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }
    
    // Scenic area file path
    const scenicAreaFilePath = path.join('assets', province, city, 'data', 'scenic-area.json');
    let scenicAreaFileData = { scenicAreas: [] };
    
    // Check if scenic area file exists
    if (fs.existsSync(scenicAreaFilePath)) {
      try {
        scenicAreaFileData = JSON.parse(fs.readFileSync(scenicAreaFilePath, 'utf8'));
        console.log(`📂 Loaded existing scenic area file: ${scenicAreaFilePath}`);
      } catch (error) {
        console.error(`❌ Error reading scenic area file: ${error.message}`);
        console.log(`🔄 Creating new scenic area file`);
      }
    } else {
      console.log(`🔄 Creating new scenic area file: ${scenicAreaFilePath}`);
      // Ensure directory exists
      const scenicAreaDir = path.dirname(scenicAreaFilePath);
      if (!fs.existsSync(scenicAreaDir)) {
        fs.mkdirSync(scenicAreaDir, { recursive: true });
      }
    }
    
    // Search for spots in each scenic area
    const results = [];
    for (const [index, scenicArea] of cityAreas.entries()) {
      console.log(`\n� Processing scenic area ${index + 1}/${cityAreas.length}: ${scenicArea.name}`);
      
      try {
        // Set output file path
        const fileName = `${scenicArea.name.replace(/[^\w\u4e00-\u9fff]/g, '')}.json`;
        const outputPath = path.join(outputDir, fileName);
        
        // Search for spots
        const searchOptions = {
          ...options,
          output: outputPath
        };
        
        // Check if the scenic area already exists in the file
        const existingAreaIndex = scenicAreaFileData.scenicAreas.findIndex(
          area => area.name === scenicArea.name
        );
        
        // Get proper coordinates for the scenic area
        let center = scenicArea.coordinates;
        
        // If coordinates are missing or invalid, fetch them using AMap geocoding
        if (!center || center.lat === 0 || center.lng === 0) {
          console.log(`🗺️ Getting coordinates for ${scenicArea.name}...`);
          
          try {
            const searchQuery = `${scenicArea.name} ${scenicArea.address || ''}`.trim();
            console.log(`🔍 Geocoding: "${searchQuery}"`);
            
            const coordinates = await amapCoordinateService.getCoordinates(searchQuery);
            
            if (coordinates && coordinates.lat && coordinates.lng) {
              center = {
                lat: coordinates.lat,
                lng: coordinates.lng
              };
              console.log(`✅ Got coordinates for ${scenicArea.name}: ${coordinates.lat}, ${coordinates.lng}`);
            } else {
              console.log(`❌ Could not get coordinates for ${scenicArea.name}, using fallback`);
              center = { lat: 34.7466, lng: 113.6253 }; // Fallback coordinates
            }
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`❌ Error getting coordinates for ${scenicArea.name}: ${error.message}`);
            center = { lat: 34.7466, lng: 113.6253 }; // Fallback coordinates
          }
        }
        
        // Prepare scenic area object with all required fields
        const scenicAreaObj = {
          name: scenicArea.name,
          level: scenicArea.level || '',
          address: scenicArea.address || '',
          center: center,
          description: scenicArea.description || '',
          spotsFile: `spots/${fileName}`,
          // coordinateInfo: {
          //   source: center.lat === 34.7466 && center.lng === 113.6253 ? 'fallback' : 'amap_geocoding',
          //   status: center.lat === 34.7466 && center.lng === 113.6253 ? 'fallback' : 'success',
          //   timestamp: new Date().toISOString()
          // }
        };
        
        // Update or add the scenic area
        if (existingAreaIndex >= 0) {
          console.log(`🔄 Updating existing scenic area: ${scenicArea.name}`);
          scenicAreaFileData.scenicAreas[existingAreaIndex] = {
            ...scenicAreaFileData.scenicAreas[existingAreaIndex],
            ...scenicAreaObj
          };
        } else {
          console.log(`➕ Adding new scenic area: ${scenicArea.name}`);
          scenicAreaFileData.scenicAreas.push(scenicAreaObj);
        }
        
        // Search for spots using AMap API
        const result = await amapSpotsService.searchSpotsInScenicArea(scenicAreaObj, searchOptions);
        
        results.push({
          scenicArea: scenicArea.name,
          count: result.count,
          outputPath
        });
        
        // Add delay between requests to avoid rate limiting
        if (index < cityAreas.length - 1) {
          const delay = options.delay || 1000;
          console.log(`⏱️ Adding delay of ${delay}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`❌ Error processing ${scenicArea.name}: ${error.message}`);
        results.push({
          scenicArea: scenicArea.name,
          error: error.message
        });
      }
    }
    
    // Save updated scenic area data
    fs.writeFileSync(scenicAreaFilePath, JSON.stringify(scenicAreaFileData, null, 2));
    console.log(`\n💾 Updated scenic area data with spots file paths: ${scenicAreaFilePath}`);
    
    return {
      status: 'success',
      province,
      city,
      scenicAreas: cityAreas.length,
      results
    };
  } catch (error) {
    console.error(`❌ Error searching spots in scenic areas: ${error.message}`);
    throw error;
  }
}

/**
 * Search for spots in a specific scenic area
 * @param {string} province - Province name
 * @param {string} city - City name
 * @param {string} scenicAreaName - Scenic area name
 * @param {Object} options - Search options
 */
async function searchSpotsInScenicArea(province, city, scenicAreaName, options = {}) {
  console.log(`� Searching for spots in scenic area: ${scenicAreaName} (${province}/${city})`);
  
  try {
    // Get scenic areas from AI service
    console.log(`📊 Fetching scenic areas for ${province}...`);
    const scenicAreasData = await aiScenicAreasService.getScenicAreasByProvince(province);
    
    if (!scenicAreasData || !scenicAreasData.cities) {
      throw new Error(`No scenic areas data found for ${province}`);
    }
    
    // Filter for the specific city
    const cityAreas = scenicAreasData.cities[city];
    if (!cityAreas || cityAreas.length === 0) {
      throw new Error(`No scenic areas found for ${city} in ${province}`);
    }
    
    // Find the specific scenic area
    const scenicArea = cityAreas.find(area => area.name === scenicAreaName);
    if (!scenicArea) {
      throw new Error(`Scenic area "${scenicAreaName}" not found in ${city}`);
    }
    
    console.log(`📊 Found scenic area: ${scenicArea.name}`);
    
    // Set output directory
    let outputDir = options.outputDir;
    if (!outputDir) {
      outputDir = path.join('assets', province, city, 'data', 'spots');
    }
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }
    
    // Scenic area file path
    const scenicAreaFilePath = path.join('assets', province, city, 'data', 'scenic-area.json');
    let scenicAreaFileData = { scenicAreas: [] };
    
    // Check if scenic area file exists
    if (fs.existsSync(scenicAreaFilePath)) {
      try {
        scenicAreaFileData = JSON.parse(fs.readFileSync(scenicAreaFilePath, 'utf8'));
        console.log(`📂 Loaded existing scenic area file: ${scenicAreaFilePath}`);
      } catch (error) {
        console.error(`❌ Error reading scenic area file: ${error.message}`);
        console.log(`🔄 Creating new scenic area file`);
      }
    } else {
      console.log(`🔄 Creating new scenic area file: ${scenicAreaFilePath}`);
      // Ensure directory exists
      const scenicAreaDir = path.dirname(scenicAreaFilePath);
      if (!fs.existsSync(scenicAreaDir)) {
        fs.mkdirSync(scenicAreaDir, { recursive: true });
      }
    }
    
    // Set output file path
    const fileName = `${scenicArea.name.replace(/[^\w\u4e00-\u9fff]/g, '')}.json`;
    const outputPath = path.join(outputDir, fileName);
    
    // Search for spots
    const searchOptions = {
      ...options,
      output: outputPath
    };
    
    // Get proper coordinates for the scenic area
    let center = scenicArea.coordinates;
    
    // If coordinates are missing or invalid, fetch them using AMap geocoding
    if (!center || center.lat === 0 || center.lng === 0) {
      console.log(`🗺️ Getting coordinates for ${scenicArea.name}...`);
      
      try {
        const searchQuery = `${scenicArea.name} ${scenicArea.address || ''}`.trim();
        console.log(`🔍 Geocoding: "${searchQuery}"`);
        
        const coordinates = await amapCoordinateService.getCoordinates(searchQuery);
        
        if (coordinates && coordinates.lat && coordinates.lng) {
          center = {
            lat: coordinates.lat,
            lng: coordinates.lng
          };
          console.log(`✅ Got coordinates for ${scenicArea.name}: ${coordinates.lat}, ${coordinates.lng}`);
        } else {
          console.log(`❌ Could not get coordinates for ${scenicArea.name}, using fallback`);
          center = { lat: 34.7466, lng: 113.6253 }; // Fallback coordinates
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error getting coordinates for ${scenicArea.name}: ${error.message}`);
        center = { lat: 34.7466, lng: 113.6253 }; // Fallback coordinates
      }
    }
    
    // Prepare scenic area object with all required fields
    const scenicAreaObj = {
      name: scenicArea.name,
      level: scenicArea.level || '',
      address: scenicArea.address || '',
      center: center,
      description: scenicArea.description || '',
      spotsFile: `spots/${fileName}`,
      // coordinateInfo: {
      //   source: center.lat === 34.7466 && center.lng === 113.6253 ? 'fallback' : 'amap_geocoding',
      //   status: center.lat === 34.7466 && center.lng === 113.6253 ? 'fallback' : 'success',
      //   timestamp: new Date().toISOString()
      // }
    };
    
    // Check if the scenic area already exists in the file
    const existingAreaIndex = scenicAreaFileData.scenicAreas.findIndex(
      area => area.name === scenicArea.name
    );
    
    // Update or add the scenic area
    if (existingAreaIndex >= 0) {
      console.log(`� Updating existing scenic area: ${scenicArea.name}`);
      scenicAreaFileData.scenicAreas[existingAreaIndex] = {
        ...scenicAreaFileData.scenicAreas[existingAreaIndex],
        ...scenicAreaObj
      };
    } else {
      console.log(`➕ Adding new scenic area: ${scenicArea.name}`);
      scenicAreaFileData.scenicAreas.push(scenicAreaObj);
    }
    
    // Search for spots using AMap API
    const result = await amapSpotsService.searchSpotsInScenicArea(scenicAreaObj, searchOptions);
    
    // Save updated scenic area data
    fs.writeFileSync(scenicAreaFilePath, JSON.stringify(scenicAreaFileData, null, 2));
    console.log(`\n� Updated scenic area data with spots file path: ${scenicAreaFilePath}`);
    
    return {
      status: 'success',
      province,
      city,
      scenicArea: scenicArea.name,
      count: result.count,
      outputPath
    };
  } catch (error) {
    console.error(`❌ Error searching spots in scenic area: ${error.message}`);
    throw error;
  }
}

/**
 * Main function to handle command line arguments
 */
async function main() {
  try {
    // Check command line arguments
    if (process.argv.length < 4) {
      console.error('Usage: node search-spots-in-scenic-areas.js <province> <city> [scenic-area-name] [options]');
      console.error('Options:');
      console.error('  --radius <number>    Search radius in meters (default: based on scenic area level)');
      console.error('  --query <string>     Search query (default: "景点")');
      console.error('  --type <string>      Place type (default: "风景名胜")');
      console.error('  --delay <number>     Delay between requests in ms (default: 1000)');
      process.exit(1);
    }

    const province = process.argv[2];
    const city = process.argv[3];
    let scenicAreaName = null;
    
    // Check if a specific scenic area is provided
    if (process.argv.length > 4 && !process.argv[4].startsWith('--')) {
      scenicAreaName = process.argv[4];
    }

    // Parse options
    const options = {};
    for (let i = scenicAreaName ? 5 : 4; i < process.argv.length; i += 2) {
      if (process.argv[i] === '--radius') {
        options.radius = parseInt(process.argv[i + 1]);
      } else if (process.argv[i] === '--query') {
        options.query = process.argv[i + 1];
      } else if (process.argv[i] === '--type') {
        options.type = process.argv[i + 1];
      } else if (process.argv[i] === '--delay') {
        options.delay = parseInt(process.argv[i + 1]);
      }
    }

    console.log(`🏞️ Starting spot search for ${province}/${city}${scenicAreaName ? `/${scenicAreaName}` : ''}`);
    console.log(`🔧 Options:`, options);

    const startTime = Date.now();
    
    let result;
    if (scenicAreaName) {
      // Search for spots in a specific scenic area
      result = await searchSpotsInScenicArea(province, city, scenicAreaName, options);
    } else {
      // Search for spots in all scenic areas
      result = await searchSpotsInAllScenicAreas(province, city, options);
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Display results
    console.log(`\n✅ Completed spot search`);
    console.log(`⏱️ Total time: ${duration.toFixed(1)} seconds`);
    
    if (scenicAreaName) {
      console.log(`🔍 Found ${result.count} spots in ${scenicAreaName}`);
      console.log(`💾 Saved to: ${result.outputPath}`);
    } else {
      console.log(`🔍 Processed ${result.results.length} scenic areas in ${city}`);
      
      // Count successful and failed searches
      const successful = result.results.filter(r => !r.error).length;
      const failed = result.results.filter(r => r.error).length;
      
      console.log(`✅ Successful searches: ${successful}`);
      if (failed > 0) {
        console.log(`❌ Failed searches: ${failed}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export functions for use in other scripts
export {
  searchSpotsInAllScenicAreas,
  searchSpotsInScenicArea
};
