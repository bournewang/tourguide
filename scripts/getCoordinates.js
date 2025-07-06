import fetch from 'node-fetch';
import fs from 'fs';

// You need to get a Google Maps API key from: https://console.cloud.google.com/
const GOOGLE_MAPS_API_KEY = 'AIzaSyDptifvK4dbZO9wQmrIIQePyq76FGuOX68';

const spots = [
  { name: '少林寺山门', query: 'Shaolin Temple Gate, Dengfeng, Henan, China' },
  { name: '少林寺天王殿', query: 'Shaolin Temple Tianwang Hall, Dengfeng, Henan, China' },
  { name: '少林寺大雄宝殿', query: 'Shaolin Temple Main Hall, Dengfeng, Henan, China' },
  { name: '少林寺塔林', query: 'Shaolin Temple Pagoda Forest, Dengfeng, Henan, China' },
  { name: '少林寺碑林', query: 'Shaolin Temple Stele Forest, Dengfeng, Henan, China' },
  { name: '少林寺锤谱堂', query: 'Shaolin Temple Chuipu Hall, Dengfeng, Henan, China' },
  { name: '少林寺藏经阁', query: 'Shaolin Temple Scripture Repository, Dengfeng, Henan, China' },
  { name: '少林寺方丈室', query: 'Shaolin Temple Abbot Room, Dengfeng, Henan, China' },
  { name: '少林寺达摩亭', query: 'Shaolin Temple Damo Pavilion, Dengfeng, Henan, China' },
  { name: '少林寺千佛殿', query: 'Shaolin Temple Thousand Buddha Hall, Dengfeng, Henan, China' },
  { name: '少林寺初祖庵', query: 'Shaolin Temple Chuzu Temple, Dengfeng, Henan, China' },
  { name: '少林寺二祖庵', query: 'Shaolin Temple Erzu Temple, Dengfeng, Henan, China' },
  { name: '少林寺达摩洞', query: 'Shaolin Temple Damo Cave, Dengfeng, Henan, China' },
  { name: '少林寺十方禅院', query: 'Shaolin Temple Shifang Zen Temple, Dengfeng, Henan, China' }
];

async function getCoordinates(query) {
  const url = `https://maps.googleapis.com/maps/api/geocoding/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formatted_address: data.results[0].formatted_address
      };
    } else {
      console.error(`No results for: ${query}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching coordinates for ${query}:`, error);
    return null;
  }
}

async function getAllCoordinates() {
  console.log('Fetching coordinates for Shaolin Temple spots...\n');
  
  const results = [];
  
  for (const spot of spots) {
    console.log(`Searching for: ${spot.name}`);
    const coords = await getCoordinates(spot.query);
    
    if (coords) {
      results.push({
        name: spot.name,
        ...coords
      });
      console.log(`✅ Found: ${coords.latitude}, ${coords.longitude}`);
    } else {
      console.log(`❌ Not found`);
    }
    
    // Add delay to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save results to file
  fs.writeFileSync('coordinates_results.json', JSON.stringify(results, null, 2));
  console.log('\n📄 Results saved to coordinates_results.json');
  
  return results;
}

// Export functions for use
export { getCoordinates, getAllCoordinates };

// Run the script if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule && process.argv[2] === 'run') {
  getAllCoordinates().catch(console.error);
} else if (isMainModule) {
  console.log('To run this script:');
  console.log('1. Get Google Maps API key from: https://console.cloud.google.com/');
  console.log('2. Replace YOUR_API_KEY_HERE with your actual API key');
  console.log('3. Run: node scripts/getCoordinates.js run');
} 