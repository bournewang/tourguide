import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

class BaiduCoordinateService {
  constructor() {
    // Load API key from environment
    this.loadApiKey();
    this.cacheFile = 'cache/coordinates-cache.json';
    this.cache = this.loadCache();
  }

  loadApiKey() {
    try {
      // Try to load from .env.baidu file
      const envContent = fs.readFileSync('.env.baidu', 'utf8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        if (line.startsWith('export BAIDU_API_KEY=')) {
          this.apiKey = line.split('=')[1].trim();
          console.log(`🔑 Loaded Baidu API key: ${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
          break;
        }
      }
    } catch (error) {
      console.error('❌ Could not load Baidu API key from .env.baidu:', error.message);
    }

    if (!this.apiKey) {
      console.error('❌ Baidu API key not found!');
      console.log('Please check .env.baidu file or get one from: https://lbsyun.baidu.com/');
    }
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const content = fs.readFileSync(this.cacheFile, 'utf8');
        const cache = JSON.parse(content);
        console.log(`📖 Loaded ${Object.keys(cache).length} cached coordinates`);
        return cache;
      }
    } catch (error) {
      console.error('⚠️ Error loading coordinate cache:', error.message);
    }
    return {};
  }

  saveCache() {
    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(this.cacheFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
      console.log(`💾 Saved ${Object.keys(this.cache).length} coordinates to cache`);
    } catch (error) {
      console.error('⚠️ Error saving coordinate cache:', error.message);
    }
  }

  // Create cache key from scenic area info
  createCacheKey(scenicArea) {
    return `${scenicArea.name}_${scenicArea.address || scenicArea.city || ''}`.replace(/\s+/g, '_');
  }

  // Fetch coordinate from Baidu API
  async fetchCoordinate(scenicArea, delay = 0) {
    if (!this.apiKey) {
      console.log(`⚠️ No API key available for ${scenicArea.name}, using fallback coordinates`);
      return this.getFallbackCoordinate(scenicArea);
    }

    if (delay > 0) {
      console.log(`⏱️ Adding delay of ${delay}ms before fetching coordinates for ${scenicArea.name}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Create search query
    const query = scenicArea.address || `${scenicArea.province || ''}${scenicArea.city || ''}${scenicArea.name}`;
    console.log(`🔍 Search query for ${scenicArea.name}: "${query}"`);
    
    // Check cache first
    const cacheKey = this.createCacheKey(scenicArea);
    if (this.cache[cacheKey]) {
      console.log(`📋 Using cached coordinates for ${scenicArea.name}: ${JSON.stringify(this.cache[cacheKey].coordinates)}`);
      return this.cache[cacheKey];
    }

    const url = `https://api.map.baidu.com/geocoding/v3/?address=${encodeURIComponent(query)}&output=json&ak=${this.apiKey}`;
    console.log(`🌐 API URL: ${url.replace(this.apiKey, '***API_KEY***')}`);
    
    try {
      console.log(`🗺️ Fetching coordinates for ${scenicArea.name}...`);
      const startTime = Date.now();
      const response = await fetch(url);
      const responseTime = Date.now() - startTime;
      
      console.log(`⏱️ Response received in ${responseTime}ms with status ${response.status}`);
      
      const data = await response.json();
      console.log(`📄 Raw API response for ${scenicArea.name}: ${JSON.stringify(data)}`);
      
      if (data.status === 0 && data.result && data.result.location) {
        // Keep BD-09 coordinates (Baidu's coordinate system)
        // This is more accurate for Chinese locations
        const coordinates = {
          lat: Number(data.result.location.lat.toFixed(6)),
          lng: Number(data.result.location.lng.toFixed(6))
        };

        const result = {
          name: scenicArea.name,
          coordinates,
          formatted_address: data.result.formatted_address,
          confidence: data.result.confidence,
          precise: data.result.precise,
          status: 'found',
          source: 'baidu',
          query: query,
          timestamp: new Date().toISOString(),
          responseTime
        };

        // Cache the result
        this.cache[cacheKey] = result;
        
        console.log(`✅ Found coordinates for ${scenicArea.name}: ${coordinates.lat}, ${coordinates.lng}`);
        console.log(`   📊 Confidence: ${data.result.confidence}, Precise: ${data.result.precise ? 'Yes' : 'No'}`);
        console.log(`   📍 Formatted address: ${data.result.formatted_address}`);
        return result;
        
      } else {
        console.log(`⚠️ API Error for ${scenicArea.name}: Status ${data.status}, Message: ${data.message || 'Unknown error'}`);
        console.log(`   🔍 Query used: "${query}"`);
        console.log(`   🔑 API key used: ${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
        
        const fallback = this.getFallbackCoordinate(scenicArea);
        fallback.error = `Baidu API error: ${data.message || data.status}`;
        fallback.query = query;
        fallback.responseTime = responseTime;
        
        // Cache the fallback to avoid repeated API calls
        this.cache[cacheKey] = fallback;
        return fallback;
      }
    } catch (error) {
      console.log(`❌ Network Error for ${scenicArea.name}: ${error.message}`);
      console.log(`   🔍 Query used: "${query}"`);
      console.log(`   🌐 URL: ${url.replace(this.apiKey, '***API_KEY***')}`);
      console.log(`   📋 Error stack: ${error.stack}`);
      
      const fallback = this.getFallbackCoordinate(scenicArea);
      fallback.error = error.message;
      fallback.query = query;
      fallback.errorStack = error.stack;
      
      // Cache the fallback
      this.cache[cacheKey] = fallback;
      return fallback;
    }
  }

  // Get fallback coordinates based on city/province
  getFallbackCoordinate(scenicArea) {
    // Common city center coordinates (BD-09 format)
    const cityCoordinates = {
      '郑州': { lat: 34.7466, lng: 113.6253 },
      '洛阳': { lat: 34.6197, lng: 112.4540 },
      '开封': { lat: 34.7971, lng: 114.3074 },
      '平顶山': { lat: 33.7453, lng: 113.1929 },
      '安阳': { lat: 36.1034, lng: 114.3924 },
      '鹤壁': { lat: 35.7554, lng: 114.2974 },
      '新乡': { lat: 35.3026, lng: 113.9268 },
      '焦作': { lat: 35.2158, lng: 113.2418 },
      '濮阳': { lat: 35.7617, lng: 115.0290 },
      '许昌': { lat: 34.0357, lng: 113.8516 },
      '漯河': { lat: 33.5818, lng: 114.0164 },
      '三门峡': { lat: 34.7732, lng: 111.2008 },
      '南阳': { lat: 32.9909, lng: 112.5285 },
      '商丘': { lat: 34.4138, lng: 115.6506 },
      '信阳': { lat: 32.1285, lng: 114.0918 },
      '周口': { lat: 33.6204, lng: 114.6965 },
      '驻马店': { lat: 32.9804, lng: 114.0241 },
      '济源': { lat: 35.0904, lng: 112.6016 }
    };

    const city = scenicArea.city?.replace('市', '') || '';
    const coordinates = cityCoordinates[city] || { lat: 34.7466, lng: 113.6253 }; // Default to Zhengzhou

    return {
      name: scenicArea.name,
      coordinates,
      status: 'fallback',
      source: 'fallback',
      city: city,
      timestamp: new Date().toISOString()
    };
  }

  // Batch fetch coordinates for multiple scenic areas
  async fetchCoordinatesForScenicAreas(scenicAreas, delayMs = 500) {
    console.log(`\n🗺️ Fetching coordinates for ${scenicAreas.length} scenic areas...`);
    console.log(`⏱️ Using ${delayMs}ms delay between requests to avoid rate limiting`);
    console.log(`🔑 Using API key: ${this.apiKey ? this.apiKey.substring(0, 4) + '...' + this.apiKey.substring(this.apiKey.length - 4) : 'None'}`);
    
    const startTime = Date.now();
    const results = [];
    
    // Group scenic areas by city for better logging
    const cityGroups = {};
    scenicAreas.forEach(area => {
      const city = area.city || 'Unknown';
      if (!cityGroups[city]) cityGroups[city] = [];
      cityGroups[city].push(area);
    });
    
    console.log(`📊 Scenic areas by city:`);
    Object.entries(cityGroups).forEach(([city, areas]) => {
      console.log(`   ${city}: ${areas.length} areas`);
    });
    
    // Process each scenic area
    for (let i = 0; i < scenicAreas.length; i++) {
      const scenicArea = scenicAreas[i];
      console.log(`\n🔄 Processing ${i+1}/${scenicAreas.length}: ${scenicArea.name} (${scenicArea.level || 'Unknown'} level)`);
      
      const result = await this.fetchCoordinate(scenicArea, i > 0 ? delayMs : 0);
      
      // Update the scenic area with accurate coordinates in the "center" field
      scenicArea.center = result.coordinates;
      
      // Add detailed coordinate info
      // scenicArea.coordinateInfo = {
      //   source: result.source,
      //   status: result.status,
      //   confidence: result.confidence,
      //   precise: result.precise,
      //   formatted_address: result.formatted_address,
      //   timestamp: result.timestamp,
      //   query: result.query,
      //   responseTime: result.responseTime
      // };
      
      // Add error info if available
      // if (result.error) {
      //   scenicArea.coordinateInfo.error = result.error;
      // }
      
      // Remove any existing coordinates field if present
      if (scenicArea.coordinates) {
        console.log(`   🔄 Converting 'coordinates' field to 'center' field`);
        delete scenicArea.coordinates;
      }
      
      results.push(result);
      
      // Log progress
      const progress = Math.round((i + 1) / scenicAreas.length * 100);
      console.log(`   📈 Progress: ${progress}% (${i+1}/${scenicAreas.length})`);
    }
    
    // Save cache after batch processing
    this.saveCache();
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    const foundCount = results.filter(r => r.status === 'found').length;
    const fallbackCount = results.filter(r => r.status === 'fallback').length;
    
    console.log(`\n📊 Coordinate fetching completed in ${duration.toFixed(1)} seconds:`);
    console.log(`   ✅ Found: ${foundCount} (${Math.round(foundCount/results.length*100)}%)`);
    console.log(`   ⚠️ Fallback: ${fallbackCount} (${Math.round(fallbackCount/results.length*100)}%)`);
    console.log(`   📋 Total: ${results.length}`);
    console.log(`   ⏱️ Average time per request: ${(duration / results.length).toFixed(2)} seconds`);
    
    // Log results by city
    console.log(`\n📊 Results by city:`);
    const cityResults = {};
    results.forEach(result => {
      const area = scenicAreas.find(a => a.name === result.name);
      const city = area?.city || 'Unknown';
      if (!cityResults[city]) cityResults[city] = { total: 0, found: 0, fallback: 0 };
      cityResults[city].total++;
      if (result.status === 'found') cityResults[city].found++;
      else cityResults[city].fallback++;
    });
    
    Object.entries(cityResults).forEach(([city, stats]) => {
      const successRate = Math.round(stats.found / stats.total * 100);
      console.log(`   ${city}: ${stats.found}/${stats.total} found (${successRate}% success rate)`);
    });
    
    return results;
  }

  // Update existing city data with accurate coordinates
  async updateCityCoordinates(cityFilePath) {
    try {
      console.log(`\n🔄 Updating coordinates for ${cityFilePath}...`);
      
      // Check if file exists
      if (!fs.existsSync(cityFilePath)) {
        console.error(`❌ File not found: ${cityFilePath}`);
        return false;
      }
      
      console.log(`📖 Reading city data from ${cityFilePath}...`);
      const fileContent = fs.readFileSync(cityFilePath, 'utf8');
      console.log(`📊 File size: ${(fileContent.length / 1024).toFixed(1)} KB`);
      
      let cityData;
      try {
        cityData = JSON.parse(fileContent);
        console.log(`✅ Successfully parsed JSON data`);
      } catch (parseError) {
        console.error(`❌ Error parsing JSON: ${parseError.message}`);
        console.log(`📄 First 200 characters of file: ${fileContent.substring(0, 200)}...`);
        return false;
      }
      
      if (!cityData.scenicAreas || !Array.isArray(cityData.scenicAreas)) {
        console.log(`⚠️ No scenic areas found in city data for ${cityData.city || 'unknown city'}`);
        return false;
      }
      
      console.log(`📊 Found ${cityData.scenicAreas.length} scenic areas in ${cityData.city || 'unknown city'}, ${cityData.province || 'unknown province'}`);
      
      // Log scenic area levels
      const levelCounts = {};
      cityData.scenicAreas.forEach(area => {
        if (!levelCounts[area.level]) levelCounts[area.level] = 0;
        levelCounts[area.level]++;
      });
      
      console.log(`📊 Scenic areas by level:`);
      Object.entries(levelCounts).forEach(([level, count]) => {
        console.log(`   ${level || 'Unknown'}: ${count} areas`);
      });
      
      // Check for existing coordinates
      const existingCenterCount = cityData.scenicAreas.filter(area => area.center).length;
      const existingCoordinatesCount = cityData.scenicAreas.filter(area => area.coordinates).length;
      
      console.log(`📊 Existing coordinate data:`);
      console.log(`   'center' field: ${existingCenterCount}/${cityData.scenicAreas.length} areas`);
      console.log(`   'coordinates' field: ${existingCoordinatesCount}/${cityData.scenicAreas.length} areas`);
      
      // Add city and province info to each scenic area for better coordinate lookup
      cityData.scenicAreas.forEach(area => {
        area.city = cityData.city;
        area.province = cityData.province;
      });
      
      console.log(`\n🔄 Starting coordinate fetching process...`);
      const startTime = Date.now();
      
      await this.fetchCoordinatesForScenicAreas(cityData.scenicAreas);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Count updated coordinates
      const updatedCenterCount = cityData.scenicAreas.filter(area => area.center).length;
      const remainingCoordinatesCount = cityData.scenicAreas.filter(area => area.coordinates).length;
      
      console.log(`\n📊 Coordinate update results:`);
      console.log(`   ✅ 'center' field: ${updatedCenterCount}/${cityData.scenicAreas.length} areas`);
      console.log(`   ℹ️ 'coordinates' field: ${remainingCoordinatesCount}/${cityData.scenicAreas.length} areas (should be 0)`);
      console.log(`   ⏱️ Total processing time: ${duration.toFixed(1)} seconds`);
      
      // Save updated data
      console.log(`\n💾 Saving updated data to ${cityFilePath}...`);
      fs.writeFileSync(cityFilePath, JSON.stringify(cityData, null, 2));
      
      const newFileSize = fs.statSync(cityFilePath).size / 1024;
      console.log(`📊 New file size: ${newFileSize.toFixed(1)} KB`);
      console.log(`✅ Updated coordinates saved successfully to ${cityFilePath}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Error updating coordinates for ${cityFilePath}:`, error.message);
      console.error(`   📋 Error stack: ${error.stack}`);
      return false;
    }
  }
}

export default BaiduCoordinateService;
