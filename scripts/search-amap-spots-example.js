#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { searchSpotsInScenicArea } from './searchAmapSpots.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main function to search for spots in a specific scenic area
 */
async function main() {
  try {
    // Check command line arguments
    if (process.argv.length < 4) {
      console.error('Usage: ./search-amap-spots-example.js <city-file-path> <scenic-area-name> [options]');
      console.error('Options:');
      console.error('  --radius <number>    Search radius in meters (default: based on scenic area level)');
      console.error('  --query <string>     Search query (default: "景点")');
      console.error('  --type <string>      Place type (default: "风景名胜")');
      console.error('  --output <path>      Output file path (default: ./output/<scenic-area-name>.json)');
      process.exit(1);
    }

    const cityFilePath = process.argv[2];
    const scenicAreaName = process.argv[3];

    // Parse options
    const options = {};
    for (let i = 4; i < process.argv.length; i += 2) {
      if (process.argv[i] === '--radius') {
        options.radius = parseInt(process.argv[i + 1]);
      } else if (process.argv[i] === '--query') {
        options.query = process.argv[i + 1];
      } else if (process.argv[i] === '--type') {
        options.type = process.argv[i + 1];
      } else if (process.argv[i] === '--output') {
        options.output = process.argv[i + 1];
      }
    }

    // Read city data
    console.log(`📂 Reading city data from: ${cityFilePath}`);
    if (!fs.existsSync(cityFilePath)) {
      throw new Error(`City file not found: ${cityFilePath}`);
    }

    const cityData = JSON.parse(fs.readFileSync(cityFilePath, 'utf8'));
    
    // Find the specified scenic area
    let scenicArea;
    if (cityData.scenicAreas) {
      scenicArea = cityData.scenicAreas.find(area => area.name === scenicAreaName);
    } else if (Array.isArray(cityData)) {
      scenicArea = cityData.find(area => area.name === scenicAreaName);
    }

    if (!scenicArea) {
      throw new Error(`Scenic area "${scenicAreaName}" not found in city data`);
    }

    console.log(`🏞️ Found scenic area: ${scenicArea.name}`);
    console.log(`📍 Center coordinates: ${scenicArea.center ? `${scenicArea.center.lat}, ${scenicArea.center.lng}` : 'Not available'}`);
    console.log(`🏆 Level: ${scenicArea.level || 'Not specified'}`);

    // Set default output path if not provided
    if (!options.output) {
      const outputDir = path.join(__dirname, '..', 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 Created output directory: ${outputDir}`);
      }
      options.output = path.join(outputDir, `${scenicAreaName.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '')}.json`);
    }

    // Search for spots
    console.log(`\n🔍 Searching for spots in ${scenicAreaName}...`);
    const results = await searchSpotsInScenicArea(scenicArea, options);

    console.log(`\n✅ Found ${results.count} spots in ${scenicAreaName}`);
    console.log(`💾 Results saved to: ${options.output}`);

    // Display a few sample results
    if (results.results && results.results.length > 0) {
      console.log('\n📋 Sample results:');
      const sampleSize = Math.min(3, results.results.length);
      for (let i = 0; i < sampleSize; i++) {
        const spot = results.results[i];
        console.log(`   ${i + 1}. ${spot.name} (${spot.distance}m)`);
        console.log(`      📍 Location: ${spot.location.lat}, ${spot.location.lng}`);
        console.log(`      📝 Type: ${spot.type}`);
        if (spot.rating) {
          console.log(`      ⭐ Rating: ${spot.rating}`);
        }
        console.log('');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
