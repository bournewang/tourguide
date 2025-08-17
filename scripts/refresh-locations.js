#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ASSETS_DIR = 'assets';
const CITIES_DIR = 'cities';
const SRC_DATA_DIR = 'src/data';
const ASSETS_INDEX_FILE = path.join(ASSETS_DIR, 'index.json');
const LOCATIONS_FILE = path.join(SRC_DATA_DIR, 'locations.json');

// Province name mappings (Chinese to English)
const PROVINCE_MAPPINGS = {
  'henan': '河南',
  'shandong': '山东',
  'jiangsu': '江苏',
  'shanxi': '山西',
  'zhejiang': '浙江'
};

// City name mappings (pinyin to Chinese)
const CITY_MAPPINGS = {
  // Henan cities
  'kaifeng': '开封',
  'luoyang': '洛阳',
  'dengfeng': '登封',
  
  // Shandong cities
  'jinan': '济南',
  'qingdao': '青岛',
  'yantai': '烟台',
  'weifang': '潍坊',
  'jining': '济宁',
  'taian': '泰安',
  'weihai': '威海',
  'rizhao': '日照',
  'linyi': '临沂',
  'dezhou': '德州',
  'liaocheng': '聊城',
  'binzhou': '滨州',
  'heze': '菏泽',
  'zaozhuang': '枣庄',
  'dongying': '东营',
  'zibo': '淄博',
  'laiwu': '莱芜',
  'qufu': '曲阜',
  
  // Jiangsu cities
  'nanjing': '南京',
  'suzhou': '苏州',
  'wuxi': '无锡',
  'changzhou': '常州',
  'nantong': '南通',
  'yangzhou': '扬州',
  'yancheng': '盐城',
  'huaian': '淮安',
  'xuzhou': '徐州',
  'zhenjiang': '镇江'
};

// Get default scenic area from scenic-area.json
function getDefaultScenicArea(cityPath) {
  const scenicAreaFile = path.join(cityPath, 'data', 'scenic-area.json');
  if (fs.existsSync(scenicAreaFile)) {
    try {
      const scenicAreas = JSON.parse(fs.readFileSync(scenicAreaFile, 'utf8'));
      if (scenicAreas && scenicAreas.length > 0) {
        return scenicAreas[0].name; // Return first scenic area as default
      }
    } catch (error) {
      console.warn(`Warning: Could not read scenic area file for ${cityPath}:`, error.message);
    }
  }
  return null;
}

// Scan assets directory to find all cities
function scanAssets() {
  const cities = [];
  
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`Assets directory ${ASSETS_DIR} not found!`);
    return cities;
  }
  
  const provinces = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
    .map(dirent => dirent.name);
  
  console.log(`Found provinces: ${provinces.join(', ')}`);
  
  for (const province of provinces) {
    const provincePath = path.join(ASSETS_DIR, province);
    const provinceDisplayName = PROVINCE_MAPPINGS[province] || province;
    
    // Skip backup directories
    if (province.includes('.bk') || province === 'preview') {
      continue;
    }
    
    const cityDirs = fs.readdirSync(provincePath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map(dirent => dirent.name);
    
    console.log(`  ${province} cities: ${cityDirs.join(', ')}`);
    
    for (const city of cityDirs) {
      const cityPath = path.join(provincePath, city);
      const cityDisplayName = CITY_MAPPINGS[city] || city;
      
      // Check if city has data directory with scenic-area.json
      const dataDir = path.join(cityPath, 'data');
      const scenicAreaFile = path.join(dataDir, 'scenic-area.json');
      
      if (fs.existsSync(scenicAreaFile)) {
        const defaultArea = getDefaultScenicArea(cityPath);
        
        cities.push({
          id: city,
          name: cityDisplayName,
          province: provinceDisplayName,
          provinceCode: province,
          defaultArea: defaultArea
        });
      } else {
        console.warn(`  Warning: ${city} missing scenic-area.json, skipping...`);
      }
    }
  }
  
  return cities;
}

// Generate minimal city configuration file
function generateCityConfig(city) {
  const cityCode = city.id.substring(0, 2); // First 2 characters for domain
  
  return {
    name: city.id,
    displayName: city.name,
    description: `${city.name}景区导览`,
    domain: `${cityCode}.qingfan.wang`,
    workerUrl: `https://${cityCode}.qingfan.wang`,
    resourceBaseUrl: `https://${cityCode}.res.qingfan.wang`,
    logoPath: `logos/${city.id}.png`
  };
}

// Main function
function refreshLocations() {
  console.log('🔄 Refreshing locations and city configurations...\n');
  
  // Scan assets directory
  const cities = scanAssets();
  
  if (cities.length === 0) {
    console.error('❌ No valid cities found in assets directory!');
    return;
  }
  
  console.log(`\n✅ Found ${cities.length} valid cities\n`);
  
  // Group cities by province for the unified locations.json
  const provinceGroups = {};
  
  cities.forEach(city => {
    const province = city.province;
    if (!provinceGroups[province]) {
      provinceGroups[province] = [];
    }
    
    provinceGroups[province].push({
      id: city.id,
      name: city.name,
      assetsPath: `assets/${city.provinceCode}/${city.id}`,
      defaultArea: city.defaultArea
    });
  });
  
  // Create unified locations structure
  const locations = Object.entries(provinceGroups).map(([province, cities]) => ({
    province,
    cities: cities.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }));
  
  // Sort provinces
  locations.sort((a, b) => a.province.localeCompare(b.province, 'zh-CN'));
  
  // Ensure src/data directory exists
  if (!fs.existsSync(SRC_DATA_DIR)) {
    fs.mkdirSync(SRC_DATA_DIR, { recursive: true });
  }
  
  // Write unified locations.json
  fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2));
  console.log(`📝 Generated unified ${LOCATIONS_FILE}`);
  
  // Remove old assets/index.json if it exists (now using unified src/data/locations.json)
  if (fs.existsSync(ASSETS_INDEX_FILE)) {
    fs.unlinkSync(ASSETS_INDEX_FILE);
    console.log(`🗑️  Removed redundant ${ASSETS_INDEX_FILE} (now using ${LOCATIONS_FILE})`);
  }
  
  // Create cities directory if it doesn't exist
  if (!fs.existsSync(CITIES_DIR)) {
    fs.mkdirSync(CITIES_DIR, { recursive: true });
  }
  
  // Generate minimal city configuration files
  let updatedCount = 0;
  let createdCount = 0;
  
  for (const city of cities) {
    const cityConfigFile = path.join(CITIES_DIR, `${city.id}.json`);
    const cityConfig = generateCityConfig(city);
    
    const existed = fs.existsSync(cityConfigFile);
    fs.writeFileSync(cityConfigFile, JSON.stringify(cityConfig, null, 2));
    
    if (existed) {
      updatedCount++;
      console.log(`🔄 Updated ${cityConfigFile}`);
    } else {
      createdCount++;
      console.log(`✨ Created ${cityConfigFile}`);
    }
  }
  
  // Clean up old city files that no longer exist in assets
  const existingCityFiles = fs.readdirSync(CITIES_DIR)
    .filter(file => file.endsWith('.json') && file !== 'preview.json')
    .map(file => file.replace('.json', ''));
  
  const currentCityIds = cities.map(city => city.id);
  const obsoleteFiles = existingCityFiles.filter(cityId => !currentCityIds.includes(cityId));
  
  let removedCount = 0;
  for (const obsoleteCity of obsoleteFiles) {
    const obsoleteFile = path.join(CITIES_DIR, `${obsoleteCity}.json`);
    fs.unlinkSync(obsoleteFile);
    removedCount++;
    console.log(`🗑️  Removed obsolete ${obsoleteFile}`);
  }
  
  console.log('\n📊 Summary:');
  console.log(`   • Total cities: ${cities.length}`);
  console.log(`   • Created: ${createdCount}`);
  console.log(`   • Updated: ${updatedCount}`);
  console.log(`   • Removed: ${removedCount}`);
  console.log(`   • Assets index: ${ASSETS_INDEX_FILE}`);
  console.log(`   • Locations file: ${LOCATIONS_FILE}`);
  console.log('\n✅ Refresh completed successfully!');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  refreshLocations();
}

export { refreshLocations, scanAssets, generateCityConfig };
