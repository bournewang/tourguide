#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { searchSpotsInCity } from './searchAmapSpots.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main function to search for spots in all scenic areas within a city
 */
async function main() {
  try {
    // Check command line arguments
    if (process.argv.length < 3) {
      console.error('Usage: ./search-amap-spots-in-city.js <city-file-path> [options]');
      console.error('Options:');
      console.error('  --radius <number>    Search radius in meters (default: based on scenic area level)');
      console.error('  --query <string>     Search query (default: "景点")');
      console.error('  --type <string>      Place type (default: "风景名胜")');
      console.error('  --output-dir <path>  Output directory (default: <city-dir>/data/spots)');
      console.error('  --delay <number>     Delay between requests in ms (default: 1000)');
      process.exit(1);
    }

    const cityFilePath = process.argv[2];

    // Parse options
    const options = {};
    for (let i = 3; i < process.argv.length; i += 2) {
      if (process.argv[i] === '--radius') {
        options.radius = parseInt(process.argv[i + 1]);
      } else if (process.argv[i] === '--query') {
        options.query = process.argv[i + 1];
      } else if (process.argv[i] === '--type') {
        options.type = process.argv[i + 1];
      } else if (process.argv[i] === '--output-dir') {
        options.outputDir = process.argv[i + 1];
      } else if (process.argv[i] === '--delay') {
        options.delay = parseInt(process.argv[i + 1]);
      }
    }

    // Check if city file exists
    console.log(`📂 Reading city data from: ${cityFilePath}`);
    if (!fs.existsSync(cityFilePath)) {
      throw new Error(`City file not found: ${cityFilePath}`);
    }

    // Extract city name from file path
    const cityFileName = path.basename(cityFilePath);
    const cityName = cityFileName.replace('.json', '');
    console.log(`🏙️ Processing city: ${cityName}`);

    // Set default output directory if not provided
    if (!options.outputDir) {
      const cityDir = path.dirname(cityFilePath);
      // Check if cityDir already ends with 'data' to avoid duplication
      if (cityDir.endsWith('/data') || cityDir.endsWith('\\data')) {
        options.outputDir = path.join(cityDir, 'spots');
      } else {
        options.outputDir = path.join(cityDir, 'data', 'spots');
      }
      console.log(`📁 Using default output directory: ${options.outputDir}`);
    } else {
      console.log(`📁 Using specified output directory: ${options.outputDir}`);
    }

    // Ensure output directory exists
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${options.outputDir}`);
    }

    // Search for spots in all scenic areas
    console.log(`\n🔍 Searching for spots in all scenic areas in ${cityName}...`);
    const startTime = Date.now();
    const results = await searchSpotsInCity(cityFilePath, options);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Display results summary
    console.log(`\n✅ Completed search for spots in ${cityName}`);
    console.log(`⏱️ Total time: ${duration.toFixed(1)} seconds`);
    console.log(`🏞️ Scenic areas processed: ${results.scenicAreas}`);
    
    // Display results for each scenic area
    console.log('\n📊 Results by scenic area:');
    for (const result of results.results) {
      if (result.error) {
        console.log(`   ❌ ${result.scenicArea}: Error - ${result.error}`);
      } else {
        console.log(`   ✅ ${result.scenicArea}: Found ${result.count} spots`);
        console.log(`      💾 Saved to: ${result.outputPath}`);
      }
    }

    console.log(`\n💾 Updated city data with spots file paths: ${cityFilePath}`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
