#!/usr/bin/env node

import process from 'process';
import { Command } from 'commander';
import { amapSpotsService } from '../services/amapSpotsService.js';

const program = new Command();

program
  .name('search-spots-in-city')
  .description('Search for spots in all scenic areas in a city using AMap API')
  .argument('<province>', 'Province name (e.g., henan)')
  .argument('<city>', 'City name (e.g., 洛阳)')
  .option('-r, --radius <number>', 'Search radius in meters (default: based on scenic area level)')
  .option('-q, --query <string>', 'Search query (default: "景点")')
  .option('-t, --type <string>', 'Place type (default: "风景名胜")')
  .option('-d, --delay <number>', 'Delay between requests in ms (default: 1000)')
  .option('-s, --scenic-area <name>', 'Search only in the specified scenic area')
  .action(async (province, city, options) => {
    try {
      console.log(`🔍 Searching for spots in ${province}/${city}...`);
      
      const searchOptions = {
        radius: options.radius ? parseInt(options.radius) : undefined,
        query: options.query,
        type: options.type,
        delay: options.delay ? parseInt(options.delay) : 1000
      };
      
      let result;
      
      if (options.scenicArea) {
        console.log(`🏞️ Searching only in scenic area: ${options.scenicArea}`);
        result = await amapSpotsService.queueSpotsSearch(province, city, options.scenicArea, searchOptions);
        console.log(`\n✅ Completed search for spots in ${options.scenicArea}`);
        console.log(`🔍 Found ${result.count} spots`);
        console.log(`💾 Saved to: ${result.outputPath}`);
      } else {
        result = await amapSpotsService.queueCitySpotsSearch(province, city, searchOptions);
        console.log(`\n✅ Completed search for spots in ${province}/${city}`);
        console.log(`🏞️ Scenic areas processed: ${result.scenicAreas}`);
        
        // Display results for each scenic area
        console.log('\n📊 Results by scenic area:');
        if (result.results && Array.isArray(result.results)) {
          for (const areaResult of result.results) {
            if (areaResult.error) {
              console.log(`   ❌ ${areaResult.scenicArea}: Error - ${areaResult.error}`);
            } else {
              console.log(`   ✅ ${areaResult.scenicArea}: Found ${areaResult.count} spots`);
              console.log(`      💾 Saved to: ${areaResult.outputPath}`);
            }
          }
        } else {
          console.log('   ❌ No results available');
        }
      }
      
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
