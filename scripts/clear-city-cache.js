#!/usr/bin/env node

/**
 * Clear cache for a specific city to force data refresh
 * Usage: node scripts/clear-city-cache.js [cityId]
 */

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function clearCityCache(cityId) {
  if (!cityId) {
    console.error('❌ Usage: node scripts/clear-city-cache.js [cityId]');
    console.error('   Example: node scripts/clear-city-cache.js 郑州');
    process.exit(1);
  }

  console.log(`🧹 Clearing cache for city: ${cityId}`);

  // Cache keys that need to be cleared
  const cacheKeys = [
    `tourguide_scenic_areas_${cityId}`,
    `tourguide_scenic_areas_fetched_${cityId}`,
  ];

  // Also clear spots cache for all scenic areas in this city
  // We'll need to check what scenic areas exist and clear their spots cache
  try {
    // Try to read the scenic area file to get area names
    const provinceDirs = ['henan', 'shandong', 'jiangsu', 'zhejiang'];
    let scenicAreas = [];
    
    for (const province of provinceDirs) {
      const scenicAreaPath = path.join(__dirname, '..', 'assets', province, cityId, 'data', 'scenic-area.json');
      if (fs.existsSync(scenicAreaPath)) {
        const data = JSON.parse(fs.readFileSync(scenicAreaPath, 'utf8'));
        if (Array.isArray(data)) {
          scenicAreas = data;
        } else if (data.scenicAreas && Array.isArray(data.scenicAreas)) {
          scenicAreas = data.scenicAreas;
        }
        console.log(`📍 Found scenic areas file: ${scenicAreaPath}`);
        break;
      }
    }

    // Add spots cache keys for each scenic area
    scenicAreas.forEach(area => {
      cacheKeys.push(`tourguide_spots_${cityId}_${area.name}`);
    });

    console.log(`🎯 Will clear ${cacheKeys.length} cache keys`);
    
  } catch (error) {
    console.warn(`⚠️  Could not read scenic areas file: ${error.message}`);
    console.log('🔄 Will clear basic cache keys only');
  }

  // Clear localStorage cache (simulate browser localStorage)
  
  console.log('\n📋 Cache keys to clear:');
  cacheKeys.forEach((key, index) => {
    console.log(`  ${index + 1}. ${key}`);
  });

  console.log('\n💡 To clear these cache entries in the browser:');
  console.log('   1. Open browser Developer Tools (F12)');
  console.log('   2. Go to Console tab');
  console.log('   3. Run the following commands:');
  console.log('');
  
  cacheKeys.forEach(key => {
    console.log(`   localStorage.removeItem('${key}');`);
  });
  
  console.log('');
  console.log('   // Or clear all tourguide cache:');
  console.log('   Object.keys(localStorage).filter(k => k.startsWith("tourguide_")).forEach(k => localStorage.removeItem(k));');
  console.log('');
  console.log('   // Then refresh the page');
  console.log('   location.reload();');

  console.log('\n✅ Cache clearing instructions provided');
  console.log('🔄 After clearing cache, the app will reload data from the updated files');
}

// Get city from command line arguments
const cityId = process.argv[2];
clearCityCache(cityId);
