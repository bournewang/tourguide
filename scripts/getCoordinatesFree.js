// Free coordinate fetching using OpenStreetMap Nominatim API
// No API key required! Just run: node scripts/getCoordinatesFree.js

import fetch from 'node-fetch';
import fs from 'fs';

const spots = [
  { name: '山门', query: 'Shaolin Temple, Dengfeng, Henan, China' },
  { name: '天王殿', query: 'Shaolin Temple Tianwang Hall, Dengfeng, Henan, China' },
  { name: '大雄宝殿', query: 'Shaolin Temple Main Hall, Dengfeng, Henan, China' },
  { name: '塔林', query: 'Shaolin Temple Pagoda Forest, Dengfeng, Henan, China' },
  { name: '碑林', query: 'Shaolin Temple Stele Forest, Dengfeng, Henan, China' },
  { name: '锤谱堂', query: 'Shaolin Temple Martial Arts Hall, Dengfeng, Henan, China' },
  { name: '藏经阁', query: 'Shaolin Temple Scripture Hall, Dengfeng, Henan, China' },
  { name: '方丈室', query: 'Shaolin Temple Abbot Room, Dengfeng, Henan, China' },
  { name: '达摩亭（立雪亭）', query: 'Shaolin Temple Damo Pavilion, Dengfeng, Henan, China' },
  { name: '千佛殿', query: 'Shaolin Temple Thousand Buddha Hall, Dengfeng, Henan, China' },
  { name: '初祖庵', query: 'Shaolin Temple First Patriarch Temple, Dengfeng, Henan, China' },
  { name: '二祖庵', query: 'Shaolin Temple Second Patriarch Temple, Dengfeng, Henan, China' },
  { name: '达摩洞', query: 'Shaolin Temple Damo Cave, Dengfeng, Henan, China' },
  { name: '十方禅院', query: 'Shaolin Temple Ten Directions Zen Temple, Dengfeng, Henan, China' }
];

async function fetchCoordinatesFree() {
  console.log('🔍 Fetching coordinates using OpenStreetMap (FREE)...\n');
  
  const results = [];
  
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    console.log(`[${i + 1}/${spots.length}] Searching: ${spot.name}`);
    
    // Using Nominatim API (OpenStreetMap)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(spot.query)}&limit=1`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TourGuideApp/1.0 (your-email@example.com)' // Required by Nominatim
        }
      });
      
      const data = await response.json();
      
      if (data.length > 0) {
        const location = data[0];
        const result = {
          name: spot.name,
          latitude: parseFloat(location.lat),
          longitude: parseFloat(location.lon),
          display_name: location.display_name,
          osm_type: location.osm_type,
          osm_id: location.osm_id
        };
        
        results.push(result);
        console.log(`✅ Found: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`);
      } else {
        console.log(`❌ Not found`);
        
        // Fallback to general Shaolin Temple location
        const fallbackResult = {
          name: spot.name,
          latitude: 34.507083, // Current approximate coordinates
          longitude: 112.935694,
          display_name: 'Shaolin Temple (fallback)',
          note: 'Using fallback coordinates - manual verification needed'
        };
        results.push(fallbackResult);
        console.log(`⚠️  Using fallback coordinates`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Rate limiting - be respectful to free API
    if (i < spots.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  // Save results
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `coordinates_free_${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf8');
  
  console.log(`\n📄 Results saved to: ${filename}`);
  console.log(`📊 Found coordinates for ${results.length}/${spots.length} spots`);
  
  // Show summary
  console.log('\n📋 Summary:');
  results.forEach(result => {
    const note = result.note ? ` (${result.note})` : '';
    console.log(`${result.name}: ${result.latitude}, ${result.longitude}${note}`);
  });
  
  console.log('\n💡 Tips:');
  console.log('- These coordinates may be approximate');
  console.log('- For higher accuracy, use Google Maps API or on-site GPS');
  console.log('- Verify locations manually if needed');
  
  return results;
}

// Auto-run the function
fetchCoordinatesFree().catch(error => {
  console.error('❌ Script failed:', error.message);
}); 