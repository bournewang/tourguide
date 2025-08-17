#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { amapSpotsService } from '../services/amapSpotsService.js';

/**
 * Test script to demonstrate enhanced filtering functionality
 */
async function testEnhancedFiltering() {
  console.log('🧪 Testing Enhanced Filtering for AMap Spots Search');
  console.log('=' .repeat(60));
  
  // Test scenic area (you can modify this for your specific test case)
  const testScenicArea = {
    name: '龙门石窟',
    level: '5A',
    address: '河南省洛阳市洛龙区伊河两岸的龙门山与香山上',
    center: {
      lat: 34.5553,
      lng: 112.4747
    },
    radius: 1000,
    description: '中国石刻艺术宝库之一，世界文化遗产'
  };
  
  console.log(`🏛️ Test Scenic Area: ${testScenicArea.name}`);
  console.log(`📍 Location: ${testScenicArea.center.lat}, ${testScenicArea.center.lng}`);
  console.log(`🎯 Radius: ${testScenicArea.radius}m`);
  console.log('');
  
  try {
    // Test with different filter configurations
    const filterConfigs = [
      {
        name: 'Strict Filtering',
        config: {
          enableFiltering: true,
          filterStrength: 'strict',
          useEnhancedQueries: true,
          maxResults: 20,
          minRelevanceScore: 0.5
        }
      },
      {
        name: 'Moderate Filtering (Default)',
        config: {
          enableFiltering: true,
          filterStrength: 'moderate',
          useEnhancedQueries: true,
          maxResults: 30,
          minRelevanceScore: 0.3
        }
      },
      {
        name: 'Loose Filtering',
        config: {
          enableFiltering: true,
          filterStrength: 'loose',
          useEnhancedQueries: true,
          maxResults: 50,
          minRelevanceScore: 0.1
        }
      },
      {
        name: 'No Filtering (Original)',
        config: {
          enableFiltering: false,
          useEnhancedQueries: false
        }
      }
    ];
    
    const results = [];
    
    for (const [index, filterTest] of filterConfigs.entries()) {
      console.log(`\n🔬 Test ${index + 1}: ${filterTest.name}`);
      console.log('-'.repeat(40));
      
      const startTime = Date.now();
      
      try {
        const result = await amapSpotsService.searchSpotsInScenicArea(testScenicArea, {
          filterConfig: filterTest.config
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Search completed in ${duration}ms`);
        console.log(`📊 Results: ${result.count} spots (from ${result.total} total)`);
        
        if (result.filtering) {
          console.log(`🔍 Filtering: ${result.filtering.enabled ? 'Enabled' : 'Disabled'}`);
          if (result.filtering.enabled) {
            console.log(`   📈 Filter ratio: ${result.filtering.filterRatio}`);
            console.log(`   🎯 Strength: ${result.filtering.strength}`);
          }
        }
        
        // Show top 3 results
        if (result.results && result.results.length > 0) {
          console.log(`🏆 Top ${Math.min(3, result.results.length)} results:`);
          result.results.slice(0, 3).forEach((spot, i) => {
            const score = spot.relevanceScore ? ` (score: ${spot.relevanceScore.toFixed(2)})` : '';
            console.log(`   ${i + 1}. ${spot.name}${score}`);
            console.log(`      📍 ${spot.address}`);
            console.log(`      📏 Distance: ${spot.distance}m`);
          });
        }
        
        results.push({
          test: filterTest.name,
          count: result.count,
          total: result.total,
          duration,
          filtering: result.filtering
        });
        
        // Add delay between tests
        if (index < filterConfigs.length - 1) {
          console.log('⏱️ Waiting 2 seconds before next test...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Error in test: ${error.message}`);
        results.push({
          test: filterTest.name,
          error: error.message
        });
      }
    }
    
    // Summary
    console.log('\n📋 Test Summary');
    console.log('='.repeat(60));
    results.forEach(result => {
      if (result.error) {
        console.log(`❌ ${result.test}: Error - ${result.error}`);
      } else {
        const filterInfo = result.filtering?.enabled ? 
          ` (${result.filtering.filterRatio} ratio, ${result.filtering.strength})` : ' (no filtering)';
        console.log(`✅ ${result.test}: ${result.count}/${result.total} spots in ${result.duration}ms${filterInfo}`);
      }
    });
    
    // Save detailed results
    const outputFile = 'output/enhanced-filtering-test-results.json';
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const detailedResults = {
      testScenicArea,
      timestamp: new Date().toISOString(),
      results
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(detailedResults, null, 2));
    console.log(`\n💾 Detailed results saved to: ${outputFile}`);
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnhancedFiltering()
    .then(() => {
      console.log('\n🎉 Enhanced filtering test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error(`❌ Test failed: ${error.message}`);
      process.exit(1);
    });
}

export { testEnhancedFiltering };
