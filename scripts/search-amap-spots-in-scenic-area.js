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
      console.error('Usage: node search-amap-spots-in-scenic-area.js <province> <city> <scenic-area-name> [options]');
      console.error('Options:');
      console.error('  --radius <number>    Search radius in meters (default: based on scenic area level)');
      console.error('  --query <string>     Search query (default: "景点")');
      console.error('  --type <string>      Place type (default: "风景名胜")');
      console.error('  --delay <number>     Delay between requests in ms (default: 1000)');
      process.exit(1);
    }

    const province = process.argv[2];
    const city = process.argv[3];
    const scenicAreaName = process.argv[4];

    // Parse options
    const options = {};
    for (let i = 5; i < process.argv.length; i += 2) {
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

    // Construct path to scenic area file
    const scenicAreaFilePath = path.join('assets', province, city, 'data', 'scenic-area.json');
    
    // Check if scenic area file exists
    console.log(`📂 Reading scenic area data from: ${scenicAreaFilePath}`);
    if (!fs.existsSync(scenicAreaFilePath)) {
      throw new Error(`Scenic area file not found: ${scenicAreaFilePath}`);
    }

    // Read scenic area data
    const scenicAreaData = JSON.parse(fs.readFileSync(scenicAreaFilePath, 'utf8'));
    
    if (!scenicAreaData.scenicAreas || !Array.isArray(scenicAreaData.scenicAreas)) {
      throw new Error(`No scenic areas found in data file`);
    }

    // Find the specific scenic area
    const scenicArea = scenicAreaData.scenicAreas.find(area => area.name === scenicAreaName);
    
    if (!scenicArea) {
      throw new Error(`Scenic area "${scenicAreaName}" not found in data file`);
    }

    console.log(`🏞️ Processing scenic area: ${scenicArea.name}`);

    // Set output directory
    const outputDir = path.join('assets', province, city, 'data', 'spots');
    console.log(`📁 Using output directory: ${outputDir}`);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }

    // Set output file path
    const outputFileName = `${scenicArea.name}.json`;
    const outputPath = path.join(outputDir, outputFileName);
    
    // Search for spots in the scenic area
    console.log(`\n🔍 Searching for spots in ${scenicArea.name}...`);
    const startTime = Date.now();
    
    const searchOptions = {
      ...options,
      output: outputPath,
      outputDir
    };
    
    const result = await searchSpotsInScenicArea(scenicArea, searchOptions);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Display results
    console.log(`\n✅ Completed search for spots in ${scenicArea.name}`);
    console.log(`⏱️ Total time: ${duration.toFixed(1)} seconds`);
    console.log(`🔍 Found ${result.count} spots`);
    console.log(`💾 Saved to: ${outputPath}`);

    // Update scenic area with spots file path
    scenicArea.spotsFile = `spots/${outputFileName}`;
    
    // Save updated scenic area data
    fs.writeFileSync(scenicAreaFilePath, JSON.stringify(scenicAreaData, null, 2));
    console.log(`\n💾 Updated scenic area data with spots file path: ${scenicAreaFilePath}`);
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
