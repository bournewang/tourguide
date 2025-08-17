import BaiduCoordinateService from '../services/baiduCoordinateService.js';
import fs from 'fs';
import path from 'path';

/**
 * Test script for Baidu Coordinate Service
 * This script tests the Baidu Map API key and coordinate fetching functionality
 */
async function testBaiduCoordinates() {
  console.log('🧪 Testing Baidu Coordinate Service');
  console.log('==================================');
  
  // Initialize the service
  const coordinateService = new BaiduCoordinateService();
  
  // Test locations - famous scenic areas in China
  const testLocations = [
    {
      name: '少林寺',
      level: '5A',
      address: '河南省郑州市登封市嵩山少林景区',
      city: '郑州',
      province: '河南省'
    },
    {
      name: '龙门石窟',
      level: '5A',
      address: '河南省洛阳市洛龙区龙门镇',
      city: '洛阳',
      province: '河南省'
    },
    {
      name: '开封清明上河园',
      level: '5A',
      address: '河南省开封市龙亭区龙亭北路5号',
      city: '开封',
      province: '河南省'
    },
    {
      name: '泰山',
      level: '5A',
      address: '山东省泰安市泰山区红门路',
      city: '泰安',
      province: '山东省'
    },
    {
      name: '西湖',
      level: '5A',
      address: '浙江省杭州市西湖区',
      city: '杭州',
      province: '浙江省'
    }
  ];
  
  console.log(`\n📍 Testing with ${testLocations.length} sample locations`);
  
  // Test individual coordinate fetching
  console.log('\n🔍 Testing individual coordinate fetching:');
  for (const location of testLocations) {
    console.log(`\n📌 Testing location: ${location.name} (${location.address})`);
    
    try {
      const result = await coordinateService.fetchCoordinate(location);
      
      if (result.status === 'found') {
        console.log(`✅ SUCCESS: Found coordinates for ${location.name}`);
        console.log(`   📍 Coordinates: ${result.coordinates.lat}, ${result.coordinates.lng}`);
        console.log(`   📊 Confidence: ${result.confidence}, Precise: ${result.precise ? 'Yes' : 'No'}`);
        console.log(`   🏙️ Formatted address: ${result.formatted_address}`);
      } else {
        console.log(`⚠️ FALLBACK: Using fallback coordinates for ${location.name}`);
        console.log(`   📍 Fallback coordinates: ${result.coordinates.lat}, ${result.coordinates.lng}`);
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        }
      }
    } catch (error) {
      console.error(`❌ ERROR: Failed to fetch coordinates for ${location.name}:`, error.message);
    }
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test batch coordinate fetching
  console.log('\n\n🔍 Testing batch coordinate fetching:');
  try {
    await coordinateService.fetchCoordinatesForScenicAreas(testLocations);
    
    console.log('\n📊 Results after batch processing:');
    testLocations.forEach(location => {
      console.log(`📌 ${location.name}:`);
      console.log(`   📍 Center: ${JSON.stringify(location.center)}`);
      console.log(`   🔍 Source: ${location.coordinateInfo?.source || 'Unknown'}`);
      console.log(`   📊 Status: ${location.coordinateInfo?.status || 'Unknown'}`);
      if (location.coordinateInfo?.error) {
        console.log(`   ❌ Error: ${location.coordinateInfo.error}`);
      }
    });
  } catch (error) {
    console.error('❌ ERROR: Failed to fetch coordinates in batch:', error.message);
  }
  
  // Test city file update
  console.log('\n\n🔍 Testing city file update:');
  
  // Create a temporary test file
  const tempDir = path.join('temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const testCityFile = path.join(tempDir, 'test-city.json');
  const testCityData = {
    city: '测试城市',
    province: '测试省份',
    scenicAreas: testLocations
  };
  
  fs.writeFileSync(testCityFile, JSON.stringify(testCityData, null, 2));
  console.log(`📄 Created test city file: ${testCityFile}`);
  
  try {
    await coordinateService.updateCityCoordinates(testCityFile);
    
    // Read the updated file
    const updatedData = JSON.parse(fs.readFileSync(testCityFile, 'utf8'));
    
    console.log('\n📊 Final results after city file update:');
    updatedData.scenicAreas.forEach(area => {
      console.log(`📌 ${area.name}:`);
      console.log(`   📍 Center: ${JSON.stringify(area.center)}`);
      console.log(`   🔍 Source: ${area.coordinateInfo?.source || 'Unknown'}`);
    });
    
    console.log(`\n✅ Test completed successfully!`);
    console.log(`📋 You can examine the test city file at: ${testCityFile}`);
  } catch (error) {
    console.error('❌ ERROR: Failed to update city file:', error.message);
  }
}

// Run the test
testBaiduCoordinates().catch(error => {
  console.error('❌ Test failed with error:', error);
});
