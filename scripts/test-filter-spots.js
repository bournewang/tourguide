#!/usr/bin/env node

/**
 * Test script for the Enhanced Spots Filter Tool
 * Creates sample data and tests the filtering functionality
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample spots data for testing
const sampleSpots = [
    { name: "少林寺", address: "河南省登封市少林景区少林寺" },
    { name: "塔林", address: "河南省登封市少林景区塔林" },
    { name: "三皇寨", address: "河南省登封市三皇寨景区三皇寨" },
    { name: "少林寺武术馆", address: "河南省登封市少林景区武术馆" },
    { name: "三皇寨索道", address: "河南省登封市三皇寨景区索道站" },
    { name: "少林寺停车场", address: "河南省登封市少林景区停车场" },
    { name: "三皇寨停车场", address: "河南省登封市三皇寨景区停车场" },
    { name: "少林寺售票处", address: "河南省登封市少林景区售票处" },
    { name: "三皇寨售票处", address: "河南省登封市三皇寨景区售票处" },
    { name: "少林寺餐厅", address: "河南省登封市少林景区餐厅" },
    { name: "三皇寨餐厅", address: "河南省登封市三皇寨景区餐厅" },
    { name: "少林寺酒店", address: "河南省登封市少林景区酒店" },
    { name: "三皇寨酒店", address: "河南省登封市三皇寨景区酒店" },
    { name: "少林寺商店", address: "河南省登封市少林景区商店" },
    { name: "三皇寨商店", address: "河南省登封市三皇寨景区商店" }
];

// Filter function (copied from the main script)
function filterSpotsByAddress(spots, includeString, excludeString, caseSensitive = false, mode = 'exclude') {
    const filteredSpots = [];
    const removedSpots = [];
    
    for (const spot of spots) {
        if (!spot.address) {
            filteredSpots.push(spot);
            continue;
        }
        
        const address = caseSensitive ? spot.address : spot.address.toLowerCase();
        const includeStr = caseSensitive ? includeString : includeString.toLowerCase();
        const excludeStr = caseSensitive ? excludeString : excludeString.toLowerCase();
        
        const hasIncludeString = address.includes(includeStr);
        const hasExcludeString = address.includes(excludeStr);
        
        let shouldKeep = true;
        
        if (mode === 'exclude') {
            shouldKeep = !hasIncludeString || hasExcludeString;
        } else if (mode === 'include') {
            shouldKeep = hasIncludeString;
        } else if (mode === 'strict') {
            shouldKeep = hasIncludeString && hasExcludeString;
        }
        
        if (shouldKeep) {
            filteredSpots.push(spot);
        } else {
            removedSpots.push(spot);
        }
    }
    
    return { filteredSpots, removedSpots };
}

// Test function
function testFilter() {
    console.log('🧪 Testing Enhanced Spots Filter Tool\n');
    
    console.log('📊 Sample data:');
    console.log(`Total spots: ${sampleSpots.length}`);
    sampleSpots.forEach((spot, index) => {
        console.log(`  ${index + 1}. "${spot.name}" - ${spot.address}`);
    });
    
    console.log('\n🔍 Test 1: EXCLUDE mode - Remove "少林景区" spots but keep those also in "三皇寨景区"');
    const test1 = filterSpotsByAddress(sampleSpots, "少林景区", "三皇寨景区", false, 'exclude');
    console.log(`Results: ${test1.filteredSpots.length} kept, ${test1.removedSpots.length} removed`);
    console.log('Removed spots:');
    test1.removedSpots.forEach(spot => console.log(`  - "${spot.name}"`));
    
    console.log('\n🔍 Test 2: INCLUDE mode - Keep only "少林景区" spots');
    const test2 = filterSpotsByAddress(sampleSpots, "少林景区", "", false, 'include');
    console.log(`Results: ${test2.filteredSpots.length} kept, ${test2.removedSpots.length} removed`);
    console.log('Kept spots:');
    test2.filteredSpots.forEach(spot => console.log(`  - "${spot.name}"`));
    
    console.log('\n🔍 Test 3: STRICT mode - Keep only spots with BOTH "少林景区" AND "三皇寨景区"');
    const test3 = filterSpotsByAddress(sampleSpots, "少林景区", "三皇寨景区", false, 'strict');
    console.log(`Results: ${test3.filteredSpots.length} kept, ${test3.removedSpots.length} removed`);
    console.log('Kept spots:');
    test3.filteredSpots.forEach(spot => console.log(`  - "${spot.name}"`));
    
    console.log('\n🔍 Test 4: Case sensitive test');
    const test4 = filterSpotsByAddress(sampleSpots, "少林景区", "", true, 'include');
    console.log(`Results: ${test4.filteredSpots.length} kept, ${test4.removedSpots.length} removed`);
    
    console.log('\n✅ All tests completed!');
    console.log('\n💡 Usage examples:');
    console.log('  node scripts/filterSpotsByAddress.js spots.json "少林景区" "三皇寨景区"');
    console.log('  node scripts/filterSpotsByAddress.js spots.json "少林景区" "" false include');
    console.log('  node scripts/filterSpotsByAddress.js spots.json "少林景区" "三皇寨景区" false strict');
}

// Run test
testFilter(); 