// Test Baidu coordinate conversion (no API key needed)
// This shows how the coordinate conversion works

import fs from 'fs';

// Sample Baidu BD-09 coordinates for Shaolin Temple (as examples)
const sampleBaiduCoords = {
  '山门': { bdLat: 34.508234, bdLng: 112.942156, source: 'sample' },
  '天王殿': { bdLat: 34.508356, bdLng: 112.942267, source: 'sample' },
  '大雄宝殿': { bdLat: 34.508512, bdLng: 112.942189, source: 'sample' },
  '塔林': { bdLat: 34.509234, bdLng: 112.942634, source: 'sample' }
};

// Convert Baidu BD-09 coordinates to WGS-84 (GPS standard)
function baiduToWgs84(bdLat, bdLng) {
  const X_PI = Math.PI * 3000.0 / 180.0;
  const PI = Math.PI;
  const A = 6378245.0;
  const EE = 0.006693421622965943;
  
  // BD-09 to GCJ-02
  const x = bdLng - 0.0065;
  const y = bdLat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  const gcjLng = z * Math.cos(theta);
  const gcjLat = z * Math.sin(theta);
  
  // GCJ-02 to WGS-84
  const dlat = transformLat(gcjLng - 105.0, gcjLat - 35.0);
  const dlng = transformLng(gcjLng - 105.0, gcjLat - 35.0);
  const radlat = gcjLat / 180.0 * PI;
  let magic = Math.sin(radlat);
  magic = 1 - EE * magic * magic;
  const sqrtmagic = Math.sqrt(magic);
  const dlat2 = (dlat * 180.0) / ((A * (1 - EE)) / (magic * sqrtmagic) * PI);
  const dlng2 = (dlng * 180.0) / (A / sqrtmagic * Math.cos(radlat) * PI);
  const mglat = gcjLat - dlat2;
  const mglng = gcjLng - dlng2;
  
  return {
    lat: Number(mglat.toFixed(6)),
    lng: Number(mglng.toFixed(6))
  };
}

function transformLat(lng, lat) {
  const PI = Math.PI;
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(lng, lat) {
  const PI = Math.PI;
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

function testBaiduConversion() {
  console.log('🧪 Testing Baidu BD-09 to WGS-84 Coordinate Conversion');
  console.log('📍 This demonstrates how Baidu coordinates are converted to GPS standard\n');
  
  const results = [];
  
  Object.entries(sampleBaiduCoords).forEach(([name, coords]) => {
    const { lat, lng } = baiduToWgs84(coords.bdLat, coords.bdLng);
    
    results.push({
      name,
      latitude: lat,
      longitude: lng,
      original_bd09: { lat: coords.bdLat, lng: coords.bdLng },
      source: 'converted_sample'
    });
    
    console.log(`✅ ${name}:`);
    console.log(`   Baidu BD-09: ${coords.bdLat.toFixed(6)}, ${coords.bdLng.toFixed(6)}`);
    console.log(`   WGS-84 GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    // Calculate conversion difference
    const latDiff = Math.abs(coords.bdLat - lat) * 111000; // rough meters
    const lngDiff = Math.abs(coords.bdLng - lng) * 111000;
    console.log(`   📏 Conversion shift: ~${Math.round(latDiff)}m lat, ~${Math.round(lngDiff)}m lng\n`);
  });
  
  // Save test results
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `coordinates_baidu_test_${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf8');
  
  console.log(`📄 Test results saved to: ${filename}`);
  console.log('🇨🇳 This shows how Baidu coordinates get converted to GPS standard');
  console.log('\n💡 To use real Baidu API:');
  console.log('1. Get API key from: https://lbsyun.baidu.com/');
  console.log('2. Use scripts/baiduCoordinates.js with your API key');
  console.log('3. Baidu Maps has the best accuracy for Chinese locations');
  
  return results;
}

// Auto-run test
testBaiduConversion(); 