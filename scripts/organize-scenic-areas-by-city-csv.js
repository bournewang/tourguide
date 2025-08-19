import fs from 'fs';
import path from 'path';
import process from 'process';
import AIScenicAreasService from '../services/aiScenicAreasService.js';
import CoordinateServiceFactory from '../services/coordinateServiceFactory.js';

class CityBasedScenicAreasOrganizer {
  constructor(mapProvider = null) {
    this.aiService = new AIScenicAreasService();
    this.coordinateService = CoordinateServiceFactory.getCoordinateService(mapProvider);
    this.baseOutputDir = 'assets';
    this.chinaAreaFile = 'china-area.v4.csv';
    this.areaData = null;
    this.mapProvider = mapProvider || CoordinateServiceFactory.getConfiguredProvider();
  }

  // Ensure output directory exists
  ensureOutputDirectory() {
    if (!fs.existsSync(this.baseOutputDir)) {
      fs.mkdirSync(this.baseOutputDir, { recursive: true });
    }
  }

  // Load and parse China area data
  loadChinaAreaData() {
    if (this.areaData) return this.areaData;

    console.log('📖 Loading China area data...');
    const content = fs.readFileSync(this.chinaAreaFile, 'utf8');
    const lines = content.trim().split('\n');
    
    this.areaData = {
      provinces: new Map(),
      cities: new Map(),
      districts: new Map()
    };

    lines.forEach(line => {
      const [code, name] = line.split(',');
      
      if (code.endsWith('0000')) {
        // Province level
        this.areaData.provinces.set(code, {
          code,
          name,
          cities: []
        });
      } else if (code.endsWith('00')) {
        // City level (prefecture-level cities)
        const provinceCode = code.substring(0, 2) + '0000';
        this.areaData.cities.set(code, {
          code,
          name,
          provinceCode,
          districts: []
        });
        
        // Add to province's cities list
        if (this.areaData.provinces.has(provinceCode)) {
          this.areaData.provinces.get(provinceCode).cities.push(code);
        }
      } else {
        // District/County level
        let cityCode;
        
        // Handle special cases for province-level cities (Beijing, Shanghai, Tianjin, Chongqing)
        const provinceCode = code.substring(0, 2) + '0000';
        if (['110000', '120000', '310000', '500000'].includes(provinceCode)) {
          // For province-level cities, districts belong directly to the province
          cityCode = provinceCode;
        } else {
          // For regular cities, find the parent city
          cityCode = code.substring(0, 4) + '00';
        }
        
        this.areaData.districts.set(code, {
          code,
          name,
          cityCode,
          provinceCode
        });
        
        // Add to city's districts list
        if (this.areaData.cities.has(cityCode)) {
          this.areaData.cities.get(cityCode).districts.push(code);
        }
      }
    });

    console.log(`✅ Loaded ${this.areaData.provinces.size} provinces, ${this.areaData.cities.size} cities, ${this.areaData.districts.size} districts`);
    return this.areaData;
  }

  // Get cities for a given province
  getCitiesForProvince(provinceName) {
    this.loadChinaAreaData();
    
    // Find province by name
    let targetProvince = null;
    for (const [, province] of this.areaData.provinces) {
      if (province.name === provinceName || province.name.includes(provinceName) || provinceName.includes(province.name.replace('省', '').replace('市', '').replace('自治区', ''))) {
        targetProvince = province;
        break;
      }
    }
    
    if (!targetProvince) {
      console.error(`❌ Province not found: ${provinceName}`);
      return [];
    }
    
    console.log(`🏛️ Found province: ${targetProvince.name} (${targetProvince.code})`);
    
    // Get all cities in this province
    const cities = [];
    
    // Handle special cases for province-level cities
    if (['110000', '120000', '310000', '500000'].includes(targetProvince.code)) {
      // For Beijing, Shanghai, Tianjin, Chongqing - use the province as the city
      cities.push({
        code: targetProvince.code,
        name: targetProvince.name,
        provinceCode: targetProvince.code
      });
    } else {
      // For regular provinces, get all prefecture-level cities
      for (const cityCode of targetProvince.cities) {
        if (this.areaData.cities.has(cityCode)) {
          const city = this.areaData.cities.get(cityCode);
          cities.push(city);
        }
      }
    }
    
    console.log(`🏙️ Found ${cities.length} cities in ${targetProvince.name}:`);
    cities.forEach(city => {
      console.log(`  - ${city.name} (${city.code})`);
    });
    
    return cities;
  }

  // Read scenic areas for a province from all levels
  readProvinceScenicAreas(provinceName) {
const scenicAreas = {
      '5A': '',
      '4A': ''
    };

    // Try different variations of province name
    const provinceVariations = [
      provinceName,
      provinceName.replace('省', ''),
      provinceName.replace('市', ''),
      provinceName.replace('自治区', ''),
      provinceName.replace('壮族自治区', ''),
      provinceName.replace('维吾尔自治区', ''),
      provinceName.replace('回族自治区', ''),
      provinceName.replace('藏族自治区', '')
    ];

for (const level of ['5A', '4A']) {
      let found = false;
      for (const variation of provinceVariations) {
        const filePath = path.join('areas', level, variation);
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            scenicAreas[level] = content.trim();
            console.log(`📖 Read ${level} file (${variation}): ${content.length} characters`);
            found = true;
            break;
          } catch (error) {
            console.error(`Error reading ${level} file for ${variation}:`, error.message);
          }
        }
      }
      if (!found) {
        console.log(`⚠️ No ${level} file found for ${provinceName} (tried: ${provinceVariations.join(', ')})`);
      }
    }

    return scenicAreas;
  }

  // Create AI prompt for a specific city with raw data context
  createCityPrompt(cityName, provinceName, scenicAreas) {
return `请从以下${provinceName}省的景区数据中，提取${cityName}市的所有5A、4A级景区。

要求返回JSON格式，结构如下：
{
  "city": "${cityName}",
  "province": "${provinceName}",
  "scenicAreas": [
    {
      "name": "景区名称",
      "level": "5A",
      "address": "详细地址",
      "radius": 500,
      "description": "景区简介（50-80字）"
    }
  ]
}

请确保：
1. 从原始数据中提取属于${cityName}市的景区，不要遗漏
2. 根据景区名称和地址信息准确判断是否属于${cityName}市
3. 描述简洁但信息丰富（50-80字）
4. 保持景区的原始等级（5A/4A）
5. 返回景区的半径（单位是米）
6. 只返回JSON，不要其他文字
7. 如果该城市没有相应等级的景区，返回空数组
8. 有些景区不适合导游讲解，如游乐园类、现代商业开发景点、休闲度假类等，请返回多一个字段"display": "hide"

原始数据：

5A级景区数据：
${scenicAreas['5A'] || '无数据'}

4A级景区数据：
${scenicAreas['4A'] || '无数据'}


`;
  }

  // Load national parks data
  loadNationalParks() {
    try {
      const nationalParksPath = path.join('assets', 'national_parks.json');
      if (!fs.existsSync(nationalParksPath)) {
        console.log('⚠️ National parks file not found, skipping national parks integration');
        return [];
      }
      
      const content = fs.readFileSync(nationalParksPath, 'utf8');
      const nationalParks = JSON.parse(content);
      console.log(`📖 Loaded ${nationalParks.length} national parks`);
      return nationalParks;
    } catch (error) {
      console.error('Error loading national parks:', error.message);
      return [];
    }
  }

  // Get national parks for a specific city
  getNationalParksForCity(cityName, provinceName) {
    const nationalParks = this.loadNationalParks();
    
    // Filter national parks for this city
    const cityParks = nationalParks.filter(park => {
      // Try exact city match first
      if (park.city === cityName) {
        return true;
      }
      
      // Try with province match as fallback
      if (park.province === provinceName && (
        park.city === cityName ||
        park.city.includes(cityName) ||
        cityName.includes(park.city)
      )) {
        return true;
      }
      
      return false;
    });
    
    console.log(`🏛️ Found ${cityParks.length} national parks for ${cityName}, ${provinceName}`);
    return cityParks;
  }

  // Convert national park to scenic area format
  convertNationalParkToScenicArea(park) {
    return {
      name: park.name,
      level: 'national-park', // Standardized level field for easy filtering
      address: park.address,
      radius: park.radius,
      description: park.description,
      city: park.city,
      province: park.province,
      // Keep original coordinates as backup but don't mark as validated
      originalCoordinates: {
        lat: park.center.lat,
        lng: park.center.lng
      },
      source: 'national_parks' // Mark the source for reference
    };
  }

  // Process a single city
  async processCity(cityName, provinceName, scenicAreas = null) {
    console.log(`\n🏙️ Processing ${cityName}, ${provinceName}...`);
    
    try {
      // Read scenic areas data if not provided
      if (!scenicAreas) {
        scenicAreas = this.readProvinceScenicAreas(provinceName);
      }
      
      // Check if we have any content
const hasContent = scenicAreas['5A'] || scenicAreas['4A'];
      if (!hasContent) {
        console.log(`⚠️ No scenic areas data found for ${provinceName}, skipping ${cityName}...`);
        return {
          city: cityName,
          province: provinceName,
          error: 'No scenic areas data found for province'
        };
      }
      
      // Create AI prompt with raw data
      const prompt = this.createCityPrompt(cityName, provinceName, scenicAreas);
      
      // Call AI to get scenic areas for this city
      console.log(`🤖 Calling AI for scenic areas in ${cityName}...`);
      const cityData = await this.aiService.callAI(prompt, `${provinceName}-${cityName}`);
      
      // Validate the result
      const validation = this.validateCityResponse(cityName, provinceName, cityData);
      console.log(`✅ Validation result:`, validation);
      
      // Get national parks for this city and merge them
      const nationalParks = this.getNationalParksForCity(cityName, provinceName);
      if (nationalParks.length > 0) {
        console.log(`🏛️ Adding ${nationalParks.length} national parks to ${cityName}...`);
        
        // Convert national parks to scenic area format
        const nationalParkAreas = nationalParks.map(park => this.convertNationalParkToScenicArea(park));
        
        // Initialize scenicAreas array if it doesn't exist
        if (!cityData.scenicAreas) {
          cityData.scenicAreas = [];
        }
        
        // Merge national parks with AI-generated scenic areas
        // Check for duplicates by exact name match only to avoid false positives
        nationalParkAreas.forEach(nationalPark => {
          // Only consider exact name matches as duplicates
          const existingArea = cityData.scenicAreas.find(area => {
            // Exact match
            if (area.name === nationalPark.name) {
              return true;
            }
            
            // Very strict similarity check - both must contain the same core name
            const normalizeAreaName = (name) => {
              return name
                .replace(/风景名胜区$/, '')
                .replace(/景区$/, '')
                .replace(/公园$/, '')
                .replace(/风景区$/, '')
                .replace(/旅游区$/, '')
                .replace(/度假区$/, '')
                .trim();
            };
            
            const normalizedNationalPark = normalizeAreaName(nationalPark.name);
            const normalizedExisting = normalizeAreaName(area.name);
            
            // Only treat as duplicate if normalized names are identical
            // This avoids cases like "嵩山风景名胜区" vs "郑州市嵩山少林景区"
            return normalizedNationalPark === normalizedExisting && normalizedNationalPark.length > 2;
          });
          
          if (!existingArea) {
            cityData.scenicAreas.push(nationalPark);
            console.log(`  ✅ Added national park: ${nationalPark.name}`);
          } else {
            console.log(`  ⚠️ Skipped duplicate: ${nationalPark.name} (exact match with ${existingArea.name})`);
          }
        });
      }
      
      // Fetch accurate coordinates for all scenic areas (including national parks)
      if (cityData.scenicAreas && cityData.scenicAreas.length > 0) {
        console.log(`\n🗺️ Fetching fresh coordinates for all ${cityData.scenicAreas.length} scenic areas...`);
        
        // Add city and province info to each scenic area for better coordinate lookup
        cityData.scenicAreas.forEach(area => {
          area.city = cityName;
          area.province = provinceName;
        });
        
        // Fetch coordinates using coordinate service for all areas
        await this.coordinateService.fetchCoordinatesForScenicAreas(cityData.scenicAreas);
        
        console.log(`✅ Coordinate fetching completed for ${cityName}`);
      }
      
      // Save the city data to the proper structure: assets/{provinceName}/{cityName}/data/scenic-area.json
      const cityDir = path.join(this.baseOutputDir, provinceName, cityName, 'data');
      const outputFile = path.join(cityDir, 'scenic-area.json');
      
      // Ensure city data directory exists
      if (!fs.existsSync(cityDir)) {
        fs.mkdirSync(cityDir, { recursive: true });
      }
      
      fs.writeFileSync(outputFile, JSON.stringify(cityData, null, 2));
      console.log(`💾 Saved city data with accurate coordinates to: ${outputFile}`);
      
      return {
        city: cityName,
        province: provinceName,
        totalAreas: cityData.scenicAreas ? cityData.scenicAreas.length : 0,
        validation,
        outputFile
      };
      
    } catch (error) {
      console.error(`❌ Error processing ${cityName}, ${provinceName}:`, error.message);
      return {
        city: cityName,
        province: provinceName,
        error: error.message
      };
    }
  }

  // Validate city response
  validateCityResponse(cityName, provinceName, result) {
    const warnings = [];
    
    if (!result.scenicAreas || !Array.isArray(result.scenicAreas)) {
      warnings.push('No scenic areas array found in response');
      return { isValid: false, warnings };
    }

    if (result.scenicAreas.length === 0) {
      warnings.push('No scenic areas found for this city');
    }

    // Check for required fields in each scenic area
    result.scenicAreas.forEach((area, index) => {
      if (!area.name) warnings.push(`Scenic area ${index + 1}: Missing name`);
      if (!area.level) warnings.push(`Scenic area ${index + 1}: Missing level`);
      if (!area.address) warnings.push(`Scenic area ${index + 1}: Missing address`);
      if (!area.description) warnings.push(`Scenic area ${index + 1}: Missing description`);
    });

    return {
      isValid: warnings.length === 0,
      warnings,
      totalScenicAreas: result.scenicAreas.length
    };
  }

  // Process all cities in a province
  async processProvince(provinceName) {
    console.log(`\n🏛️ Processing province: ${provinceName}...`);
    
    this.ensureOutputDirectory();
    
    // Get cities for this province
    const cities = this.getCitiesForProvince(provinceName);
    
    if (cities.length === 0) {
      console.error(`❌ No cities found for province: ${provinceName}`);
      return [];
    }
    
    const results = [];
    
    for (const city of cities) {
      const cityName = city.name.replace('市', ''); // Remove '市' suffix for cleaner processing
      const result = await this.processCity(cityName, provinceName);
      results.push(result);
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Generate province summary
    this.generateProvinceSummary(provinceName, results);
    
    return results;
  }

  // Process specific cities
  async processSpecificCities(provinceName, cityNames) {
    console.log(`\n🏛️ Processing specific cities in ${provinceName}: ${cityNames.join(', ')}`);
    
    this.ensureOutputDirectory();
    
    const results = [];
    
    for (const cityName of cityNames) {
      const result = await this.processCity(cityName, provinceName);
      results.push(result);
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    this.generateProvinceSummary(provinceName, results);
    
    return results;
  }

  // Generate province summary
  generateProvinceSummary(provinceName, results) {
    console.log(`\n📊 SUMMARY FOR ${provinceName}`);
    console.log('='.repeat(50));
    
    let totalCities = 0;
    let totalAreas = 0;
    let successCount = 0;
    let errorCount = 0;
    
    results.forEach(result => {
      totalCities++;
      if (result.error) {
        errorCount++;
        console.log(`❌ ${result.city}: ${result.error}`);
      } else {
        successCount++;
        totalAreas += result.totalAreas;
        const validationStatus = result.validation.isValid ? '✅' : '⚠️';
        console.log(`${validationStatus} ${result.city}: ${result.totalAreas} scenic areas`);
        if (!result.validation.isValid && result.validation.warnings.length > 0) {
          console.log(`   Warnings: ${result.validation.warnings.slice(0, 2).join(', ')}${result.validation.warnings.length > 2 ? '...' : ''}`);
        }
      }
    });
    
    console.log('='.repeat(50));
    console.log(`📈 ${provinceName} Total: ${totalCities} cities, ${successCount} successful, ${errorCount} errors`);
    console.log(`🏛️ Total scenic areas: ${totalAreas}`);
    console.log(`📁 Output directory: ${this.baseOutputDir}/${provinceName}`);
    
    // Save province summary
    const summaryFile = path.join(this.baseOutputDir, provinceName, 'summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify({
      province: provinceName,
      timestamp: new Date().toISOString(),
      totalCities,
      successCount,
      errorCount,
      totalAreas,
      results
    }, null, 2));
    
    console.log(`📋 Province summary saved to: ${summaryFile}`);
  }

  // List available provinces
  listProvinces() {
    this.loadChinaAreaData();
    
    console.log('Available provinces:');
    let index = 1;
    for (const [code, province] of this.areaData.provinces) {
      console.log(`${index}. ${province.name} (${code})`);
      index++;
    }
  }

  // List cities for a province
  listCitiesForProvince(provinceName) {
    const cities = this.getCitiesForProvince(provinceName);
    
    if (cities.length === 0) {
      console.log(`No cities found for province: ${provinceName}`);
      return;
    }
    
    console.log(`Cities in ${provinceName}:`);
    cities.forEach((city, index) => {
      console.log(`${index + 1}. ${city.name} (${city.code})`);
    });
  }
  
  // Update coordinates for an existing city file
  async updateCityCoordinates(cityFilePath) {
    try {
      await this.coordinateService.updateCityCoordinates(cityFilePath);
      return true;
    } catch (error) {
      console.error(`❌ Error updating coordinates for ${cityFilePath}:`, error.message);
      return false;
    }
  }

  // Update coordinates for all cities in a province
  async updateProvinceCoordinates(provinceName) {
    console.log(`\n🗺️ Updating coordinates for all cities in ${provinceName}...`);
    
    const provinceDir = path.join(this.baseOutputDir, provinceName);
    if (!fs.existsSync(provinceDir)) {
      console.error(`❌ Province directory not found: ${provinceDir}`);
      return false;
    }
    
    // Find all city directories with data/scenic-area.json files
    const cityDirs = fs.readdirSync(provinceDir).filter(item => {
      const itemPath = path.join(provinceDir, item);
      const scenicAreaFile = path.join(itemPath, 'data', 'scenic-area.json');
      return fs.statSync(itemPath).isDirectory() && fs.existsSync(scenicAreaFile);
    });
    
    console.log(`📋 Found ${cityDirs.length} cities with scenic area data in ${provinceName}`);
    
    let successCount = 0;
    for (const cityDir of cityDirs) {
      const scenicAreaFile = path.join(provinceDir, cityDir, 'data', 'scenic-area.json');
      console.log(`\n🔄 Processing ${cityDir}...`);
      
      const success = await this.updateCityCoordinates(scenicAreaFile);
      if (success) successCount++;
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📊 Coordinate update completed for ${provinceName}:`);
    console.log(`   ✅ Success: ${successCount}/${cityDirs.length} cities`);
    
    return true;
  }
}

// Main execution
async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  // Check for map provider option
  let mapProvider = null;
  const providerIndex = args.findIndex(arg => arg === '--provider' || arg === '-p');
  if (providerIndex !== -1 && args.length > providerIndex + 1) {
    mapProvider = args[providerIndex + 1];
    // Remove the provider arguments
    args.splice(providerIndex, 2);
    console.log(`🗺️ Using map provider: ${mapProvider}`);
  }
  
  // Create organizer with specified map provider
  const organizer = new CityBasedScenicAreasOrganizer(mapProvider);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node organize-scenic-areas-by-city-csv.js list-provinces           # List all provinces');
    console.log('  node organize-scenic-areas-by-city-csv.js list-cities 河南         # List cities in a province');
    console.log('  node organize-scenic-areas-by-city-csv.js province 河南            # Process all cities in a province');
    console.log('  node organize-scenic-areas-by-city-csv.js cities 河南 郑州 洛阳     # Process specific cities');
    console.log('  node organize-scenic-areas-by-city-csv.js update-coordinates 河南  # Update coordinates for all cities in a province');
    console.log('  node organize-scenic-areas-by-city-csv.js update-city-coordinates 河南/郑州.json  # Update coordinates for a specific city file');
    console.log('  node organize-scenic-areas-by-city-csv.js set-provider baidu|amap  # Set default map provider');
    console.log('\nOptions:');
    console.log('  --provider, -p <provider>  # Specify map provider for this run (baidu or amap/高德)');
    return;
  }
  
  try {
    if (args[0] === 'list-provinces') {
      organizer.listProvinces();
    } else if (args[0] === 'list-cities' && args[1]) {
      organizer.listCitiesForProvince(args[1]);
    } else if (args[0] === 'province' && args[1]) {
      await organizer.processProvince(args[1]);
    } else if (args[0] === 'cities' && args.length >= 3) {
      const provinceName = args[1];
      const cityNames = args.slice(2);
      await organizer.processSpecificCities(provinceName, cityNames);
    } else if (args[0] === 'update-coordinates' && args[1]) {
      await organizer.updateProvinceCoordinates(args[1]);
    } else if (args[0] === 'update-city-coordinates' && args[1]) {
      const cityFilePath = path.join(organizer.baseOutputDir, args[1]);
      await organizer.updateCityCoordinates(cityFilePath);
    } else if (args[0] === 'set-provider' && args[1]) {
      const provider = args[1].toLowerCase();
      if (provider !== 'baidu' && provider !== 'amap') {
        console.error(`❌ Invalid provider: ${provider}. Must be 'baidu' or 'amap'`);
        return;
      }
      
      const success = await CoordinateServiceFactory.setDefaultProvider(provider);
      if (success) {
        console.log(`✅ Default map provider set to: ${provider}`);
      } else {
        console.error('❌ Failed to set default map provider');
      }
    } else {
      console.log('Invalid arguments. Run without arguments for usage information.');
      return;
    }
    
    console.log('\n🎉 Processing completed!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default CityBasedScenicAreasOrganizer;
