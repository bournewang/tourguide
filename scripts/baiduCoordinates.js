// Baidu Maps API coordinate fetching for Chinese locations
// More accurate than Google Maps for China locations
// Get API key from: https://lbsyun.baidu.com/

import fetch from 'node-fetch';
import fs from 'fs';

// Get your Baidu Maps API key from: https://lbsyun.baidu.com/
const BAIDU_API_KEY = 'Cl5iurg6EmFjYEWh2KgnwDkeB9DjNZqn';

const spots = [
  { name: '山门', query: '河南省登封市少林寺山门' },
  { name: '天王殿', query: '河南省登封市少林寺天王殿' },
  { name: '大雄宝殿', query: '河南省登封市少林寺大雄宝殿' },
  { name: '塔林', query: '河南省登封市少林寺塔林' },
  { name: '碑林', query: '河南省登封市少林寺碑林' },
  { name: '锤谱堂', query: '河南省登封市少林寺锤谱堂' },
  { name: '藏经阁', query: '河南省登封市少林寺藏经阁' },
  { name: '方丈室', query: '河南省登封市少林寺方丈室' },
  { name: '达摩亭（立雪亭）', query: '河南省登封市少林寺达摩亭' },
  { name: '千佛殿', query: '河南省登封市少林寺千佛殿' },
  { name: '初祖庵', query: '河南省登封市少林寺初祖庵' },
  { name: '二祖庵', query: '河南省登封市少林寺二祖庵' },
  { name: '达摩洞', query: '河南省登封市少林寺达摩洞' },
  { name: '十方禅院', query: '河南省登封市少林寺十方禅院' }
];

async function fetchBaiduCoordinate(spot, delay = 0) {
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // Baidu Geocoding API endpoint
  const url = `https://api.map.baidu.com/geocoding/v3/?address=${encodeURIComponent(spot.query)}&output=json&ak=${BAIDU_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 0 && data.result && data.result.location) {
      // Baidu uses BD-09 coordinate system, convert to WGS-84 (GPS)
      const { lat, lng } = baiduToWgs84(data.result.location.lat, data.result.location.lng);
      
      return {
        name: spot.name,
        latitude: lat,
        longitude: lng,
        formatted_address: data.result.formatted_address,
        confidence: data.result.confidence,
        precise: data.result.precise,
        status: 'found',
        source: 'baidu'
      };
    } else {
      console.log(`API Error for ${spot.name}: Status ${data.status}, Message: ${data.message || 'Unknown error'}`);
      return {
        name: spot.name,
        latitude: 34.507083,
        longitude: 112.935694,
        status: 'fallback',
        error: `Baidu API error: ${data.message || data.status}`
      };
    }
  } catch (error) {
    console.log(`Network Error for ${spot.name}: ${error.message}`);
    return {
      name: spot.name,
      latitude: 34.507083,
      longitude: 112.935694,
      status: 'error',
      error: error.message
    };
  }
}

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

async function fetchBaiduCoordinates() {
  if (BAIDU_API_KEY === 'YOUR_BAIDU_API_KEY_HERE') {
    console.log('❌ Please set your Baidu Maps API key first!');
    console.log('Get one from: https://lbsyun.baidu.com/');
    console.log('1. Register/login to Baidu LBS Cloud');
    console.log('2. Create an application');
    console.log('3. Get your API key (AK)');
    console.log('4. Replace YOUR_BAIDU_API_KEY_HERE in this script');
    return;
  }

  console.log('🗺️  Fetching coordinates using Baidu Maps API');
  console.log('📍 Using Chinese location names for better accuracy\n');
  
  const startTime = Date.now();
  
  // Parallel requests with staggered delays
  const promises = spots.map((spot, index) => 
    fetchBaiduCoordinate(spot, index * 300) // 300ms delay between requests
  );
  
  const results = await Promise.all(promises);
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  console.log(`⏱️  Completed in ${duration} seconds\n`);
  
  // Show results
  let foundCount = 0;
  results.forEach(result => {
    const status = result.status === 'found' ? '✅' : 
                  result.status === 'fallback' ? '⚠️' : '❌';
    console.log(`${status} ${result.name}: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`);
    
    if (result.status === 'found') {
      foundCount++;
      if (result.confidence) {
        console.log(`   📊 Confidence: ${result.confidence}, Precise: ${result.precise ? 'Yes' : 'No'}`);
      }
    } else if (result.error) {
      console.log(`   ❗ ${result.error}`);
    }
  });
  
  // Save results
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `coordinates_baidu_${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf8');
  
  console.log(`\n📄 Results saved to: ${filename}`);
  console.log(`📊 Found accurate coordinates for ${foundCount}/${spots.length} spots`);
  console.log(`🇨🇳 Coordinates converted from BD-09 to WGS-84 (GPS standard)`);
  
  return results;
}

// Auto-run
fetchBaiduCoordinates().catch(error => {
  console.error('❌ Script failed:', error.message);
}); 