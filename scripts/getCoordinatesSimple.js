// Simple coordinate fetching script for Shaolin Temple spots
// Usage: Replace YOUR_API_KEY_HERE and run: node scripts/getCoordinatesSimple.js

import fetch from 'node-fetch';
import fs from 'fs';

// Get your API key from: https://console.cloud.google.com/
const GOOGLE_MAPS_API_KEY = 'AIzaSyDptifvK4dbZO9wQmrIIQePyq76FGuOX68';

const spots = [
  { name: '山门', query: 'Shaolin Temple Main Gate, Dengfeng, Henan, China' },
  { name: '天王殿', query: 'Shaolin Temple Heavenly Kings Hall, Dengfeng, Henan, China' },
  { name: '大雄宝殿', query: 'Shaolin Temple Main Buddha Hall, Dengfeng, Henan, China' },
  { name: '塔林', query: 'Shaolin Temple Pagoda Forest, Dengfeng, Henan, China' },
  { name: '碑林', query: 'Shaolin Temple Stele Forest, Dengfeng, Henan, China' },
  { name: '锤谱堂', query: 'Shaolin Temple Martial Arts Hall, Dengfeng, Henan, China' },
  { name: '藏经阁', query: 'Shaolin Temple Scripture Hall, Dengfeng, Henan, China' },
  { name: '方丈室', query: 'Shaolin Temple Abbot Quarters, Dengfeng, Henan, China' },
  { name: '达摩亭（立雪亭）', query: 'Shaolin Temple Damo Pavilion, Dengfeng, Henan, China' },
  { name: '千佛殿', query: 'Shaolin Temple Thousand Buddha Hall, Dengfeng, Henan, China' },
  { name: '初祖庵', query: 'Shaolin Temple First Patriarch Temple, Dengfeng, Henan, China' },
  { name: '二祖庵', query: 'Shaolin Temple Second Patriarch Temple, Dengfeng, Henan, China' },
  { name: '达摩洞', query: 'Shaolin Temple Damo Cave, Dengfeng, Henan, China' },
  { name: '十方禅院', query: 'Shaolin Temple Ten Directions Zen Temple, Dengfeng, Henan, China' }
];

async function fetchCoordinates() {
  if (GOOGLE_MAPS_API_KEY === 'YOUR_API_KEY_HERE') {
    console.log('❌ Please set your Google Maps API key first!');
    console.log('Get one from: https://console.cloud.google.com/');
    return;
  }

  console.log('🔍 Fetching accurate coordinates for Shaolin Temple spots...\n');
  
  const results = [];
  
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    console.log(`[${i + 1}/${spots.length}] Searching: ${spot.name}`);
    
    const url = `https://maps.googleapis.com/maps/api/geocoding/json?address=${encodeURIComponent(spot.query)}&key=${GOOGLE_MAPS_API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const result = {
          name: spot.name,
          latitude: location.lat,
          longitude: location.lng,
          formatted_address: data.results[0].formatted_address
        };
        
        results.push(result);
        console.log(`✅ Found: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
      } else {
        console.log(`❌ Not found (status: ${data.status})`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Rate limiting - wait 1 second between requests
    if (i < spots.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Save results
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `coordinates_${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf8');
  
  console.log(`\n📄 Results saved to: ${filename}`);
  console.log(`📊 Found coordinates for ${results.length}/${spots.length} spots`);
  
  // Show summary
  console.log('\n📋 Summary:');
  results.forEach(result => {
    console.log(`${result.name}: ${result.latitude}, ${result.longitude}`);
  });
  
  return results;
}

// Auto-run the function
fetchCoordinates().catch(error => {
  console.error('❌ Script failed:', error.message);
}); 