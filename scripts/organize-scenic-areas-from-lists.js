import fs from 'fs';
import path from 'path';
import process from 'process';
import AIScenicAreasService from '../services/aiScenicAreasService.js';

class ScenicAreasOrganizer {
  constructor() {
    this.aiService = new AIScenicAreasService();
    this.areasDir = 'areas';
    this.outputDir = 'assets/organized-scenic-areas';
  }

  // Ensure output directory exists
  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Get list of all provinces from the areas directory
  getProvinces() {
    const provinces = new Set();
    
    // Check all level directories (5A, 4A, 3A)
    for (const level of ['5A', '4A', '3A']) {
      const levelDir = path.join(this.areasDir, level);
      if (fs.existsSync(levelDir)) {
        const files = fs.readdirSync(levelDir);
        files.forEach(file => {
          if (fs.statSync(path.join(levelDir, file)).isFile()) {
            provinces.add(file);
          }
        });
      }
    }
    
    return Array.from(provinces).sort();
  }

  // Read scenic areas for a province from all levels
  readProvinceScenicAreas(provinceName) {
    const scenicAreas = {
      '5A': '',
      '4A': '',
      '3A': ''
    };

    for (const level of ['5A', '4A', '3A']) {
      const filePath = path.join(this.areasDir, level, provinceName);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          scenicAreas[level] = content.trim();
          console.log(`📖 Read ${level} file: ${content.length} characters`);
        } catch (error) {
          console.error(`Error reading ${level} file for ${provinceName}:`, error.message);
        }
      }
    }

    return scenicAreas;
  }

  // Parse file content based on the format
  parseFileContent(content, level) {
    const lines = content.split('\n').filter(line => line.trim());
    const areas = [];

    console.log(`🔍 Parsing ${level} content, ${lines.length} lines`);
    console.log(`📝 First 5 lines:`, lines.slice(0, 5));

    if (level === '5A') {
      // Format: 序号 景区名称 评定年份
      let dataStarted = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip header lines
        if (line.includes('序号') && line.includes('景区名称')) {
          dataStarted = true;
          continue;
        }
        
        if (dataStarted && line.trim()) {
          // Try different separators: tab, multiple spaces, or single space
          let parts = line.split('\t').filter(p => p.trim());
          if (parts.length < 2) {
            parts = line.split(/\s{2,}/).filter(p => p.trim());
          }
          if (parts.length < 2) {
            parts = line.split(/\s+/).filter(p => p.trim());
          }
          
          // Check if first part is a number (序号)
          if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
            const name = parts[1].trim();
            if (name && !name.includes('序号') && !name.includes('景区名称')) {
              areas.push({
                name: name,
                level: '5A',
                year: parts[2] ? parts[2].trim() : ''
              });
              console.log(`  ✅ 5A: ${name}`);
            }
          }
        }
      }
    } else if (level === '4A') {
      // Format: 景区名称 所属行政区 评定时间
      let dataStarted = false;
      for (const line of lines) {
        // Skip header lines
        if (line.includes('景区名称') && line.includes('所属行政区')) {
          dataStarted = true;
          continue;
        }
        
        if (dataStarted && line.trim()) {
          // Try different separators
          let parts = line.split('\t').filter(p => p.trim());
          if (parts.length < 2) {
            parts = line.split(/\s{2,}/).filter(p => p.trim());
          }
          
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const city = parts[1].trim();
            if (name && !name.includes('景区名称') && city && !city.includes('所属行政区')) {
              areas.push({
                name: name,
                level: '4A',
                city: city,
                year: parts[2] ? parts[2].trim() : ''
              });
              console.log(`  ✅ 4A: ${name} (${city})`);
            }
          }
        }
      }
    } else if (level === '3A') {
      // Format: 序号 景区 地区
      let dataStarted = false;
      for (const line of lines) {
        // Skip header lines
        if (line.includes('序号') && line.includes('景区')) {
          dataStarted = true;
          continue;
        }
        
        if (dataStarted && line.trim()) {
          // Try different separators
          let parts = line.split('\t').filter(p => p.trim());
          if (parts.length < 2) {
            parts = line.split(/\s{2,}/).filter(p => p.trim());
          }
          if (parts.length < 2) {
            parts = line.split(/\s+/).filter(p => p.trim());
          }
          
          // Check if first part is a number (序号)
          if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
            const name = parts[1].trim();
            const city = parts[2] ? parts[2].trim() : '';
            if (name && !name.includes('序号') && !name.includes('景区')) {
              areas.push({
                name: name,
                level: '3A',
                city: city
              });
              console.log(`  ✅ 3A: ${name} (${city})`);
            }
          }
        }
      }
    }

    console.log(`📊 Parsed ${areas.length} areas from ${level} file`);
    return areas;
  }

  // Create AI prompt for organizing scenic areas
  createOrganizePrompt(provinceName, scenicAreas) {
    let prompt = `请从以下${provinceName}省的景区数据中提取所有景区信息，按城市分组，并为每个景区添加详细描述。

请按以下JSON格式返回，将景区按所在城市分组：

{
  "province": "${provinceName}",
  "cities": {
    "城市名": [
      {
        "name": "景区名称",
        "level": "5A"
      }
    ]
  }
}

要求：
1. 从原始数据中提取所有景区名称，忽略格式差异
2. 根据景区名称和已知信息，准确判断景区所在城市
3. 保持景区的原始等级（5A/4A/3A）
4. 只返回JSON格式，严格限定返回字段，不要添加其他字段和文字

请确保数据准确性，特别是城市归属和坐标信息。

原始数据：

5A级景区数据：
${scenicAreas['5A'] || '无数据'}

4A级景区数据：
${scenicAreas['4A'] || '无数据'}

3A级景区数据：
${scenicAreas['3A'] || '无数据'}

`;

    return prompt;
  }

  // Process a single province
  async processProvince(provinceName) {
    console.log(`\n🏛️ Processing ${provinceName}...`);
    
    try {
      // Read scenic areas from files
      const scenicAreas = this.readProvinceScenicAreas(provinceName);
      
      // Check if we have any content
      const hasContent = scenicAreas['5A'] || scenicAreas['4A'] || scenicAreas['3A'];
      console.log(`📊 Content found: 5A: ${scenicAreas['5A'] ? 'Yes' : 'No'}, 4A: ${scenicAreas['4A'] ? 'Yes' : 'No'}, 3A: ${scenicAreas['3A'] ? 'Yes' : 'No'}`);
      
      if (!hasContent) {
        console.log(`⚠️ No scenic areas data found for ${provinceName}, skipping...`);
        return null;
      }

      // Use the enhanced AI service that includes coordinate enrichment
      console.log(`🤖 Getting scenic areas data with coordinates for ${provinceName}...`);
      const organizedData = await this.aiService.getScenicAreasByProvince(provinceName);
      
      console.log(`✅ Validation result:`, organizedData.validation);
      
      // Save the organized data
      const outputFile = path.join(this.outputDir, `${provinceName}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(organizedData, null, 2));
      console.log(`💾 Saved organized data to: ${outputFile}`);
      
      // Generate city-specific scenic area files
      const cityResults = await this.generateCityFiles(provinceName, organizedData);
      
      // Count total areas from the organized data
      let totalAreas = 0;
      if (organizedData.cities) {
        Object.values(organizedData.cities).forEach(cityAreas => {
          totalAreas += cityAreas.length;
        });
      }
      
      return {
        province: provinceName,
        totalAreas,
        cities: Object.keys(organizedData.cities || {}).length,
        validation: organizedData.validation,
        outputFile,
        cityResults
      };
      
    } catch (error) {
      console.error(`❌ Error processing ${provinceName}:`, error.message);
      return {
        province: provinceName,
        error: error.message
      };
    }
  }

  // Process all provinces
  async processAllProvinces() {
    console.log('🚀 Starting scenic areas organization...');
    
    this.ensureOutputDirectory();
    
    const provinces = this.getProvinces();
    console.log(`📋 Found ${provinces.length} provinces:`, provinces.join(', '));
    
    const results = [];
    
    for (const province of provinces) {
      const result = await this.processProvince(province);
      if (result) {
        results.push(result);
      }
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Generate summary report
    this.generateSummaryReport(results);
    
    return results;
  }

  // Process specific provinces
  async processSpecificProvinces(provinceNames) {
    console.log(`🚀 Processing specific provinces: ${provinceNames.join(', ')}`);
    
    this.ensureOutputDirectory();
    
    const results = [];
    
    for (const province of provinceNames) {
      const result = await this.processProvince(province);
      if (result) {
        results.push(result);
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.generateSummaryReport(results);
    
    return results;
  }

  // Generate city-specific scenic area files
  async generateCityFiles(provinceName, scenicAreasData) {
    console.log(`📁 Generating city-specific files for ${provinceName}...`);
    
    if (!scenicAreasData.cities) {
      console.log(`⚠️ No cities data found for ${provinceName}`);
      return [];
    }
    
    const results = [];
    
    for (const [cityName, scenicAreas] of Object.entries(scenicAreasData.cities)) {
      try {
        console.log(`  🏙️ Processing ${cityName} (${scenicAreas.length} scenic areas)...`);
        
        // Create city directory structure
        const cityDir = path.join('assets', provinceName, cityName);
        const dataDir = path.join(cityDir, 'data');
        
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
          console.log(`    📁 Created directory: ${dataDir}`);
        }
        
        // Prepare city data with proper structure
        const cityData = {
          city: cityName,
          province: provinceName,
          scenicAreas: scenicAreas.map(area => ({
            name: area.name,
            level: area.level,
            address: area.address || '',
            description: area.description || '',
            city: cityName,
            province: provinceName,
            center: area.coordinates || { lat: 0, lng: 0 },
            coordinateInfo: area.coordinateInfo || {
              source: 'unknown',
              status: 'unknown',
              timestamp: new Date().toISOString()
            }
          }))
        };
        
        // Save city scenic area file
        const cityFilePath = path.join(dataDir, 'scenic-area.json');
        fs.writeFileSync(cityFilePath, JSON.stringify(cityData, null, 2));
        
        console.log(`    💾 Saved: ${cityFilePath}`);
        
        // Count coordinate status
        const coordinateStats = {
          success: 0,
          failed: 0,
          error: 0,
          unknown: 0
        };
        
        scenicAreas.forEach(area => {
          const status = area.coordinateInfo?.status || 'unknown';
          coordinateStats[status] = (coordinateStats[status] || 0) + 1;
        });
        
        console.log(`    🗺️ Coordinates - Success: ${coordinateStats.success}, Failed: ${coordinateStats.failed}, Error: ${coordinateStats.error}, Unknown: ${coordinateStats.unknown}`);
        
        results.push({
          city: cityName,
          scenicAreas: scenicAreas.length,
          filePath: cityFilePath,
          coordinateStats
        });
        
      } catch (error) {
        console.error(`    ❌ Error processing ${cityName}: ${error.message}`);
        results.push({
          city: cityName,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Generate summary report
  generateSummaryReport(results) {
    console.log('\n📊 SUMMARY REPORT');
    console.log('='.repeat(50));
    
    let totalProvinces = 0;
    let totalAreas = 0;
    let totalCities = 0;
    let successCount = 0;
    let errorCount = 0;
    
    results.forEach(result => {
      totalProvinces++;
      if (result.error) {
        errorCount++;
        console.log(`❌ ${result.province}: ${result.error}`);
      } else {
        successCount++;
        totalAreas += result.totalAreas;
        totalCities += result.cities;
        const validationStatus = result.validation.isValid ? '✅' : '⚠️';
        console.log(`${validationStatus} ${result.province}: ${result.totalAreas} areas, ${result.cities} cities`);
        if (!result.validation.isValid) {
          console.log(`   Warnings: ${result.validation.warnings.slice(0, 3).join(', ')}${result.validation.warnings.length > 3 ? '...' : ''}`);
        }
      }
    });
    
    console.log('='.repeat(50));
    console.log(`📈 Total: ${totalProvinces} provinces, ${successCount} successful, ${errorCount} errors`);
    console.log(`🏛️ Total scenic areas: ${totalAreas}`);
    console.log(`🏙️ Total cities: ${totalCities}`);
    console.log(`📁 Output directory: ${this.outputDir}`);
    
    // Save summary to file
    const summaryFile = path.join(this.outputDir, 'summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalProvinces,
      successCount,
      errorCount,
      totalAreas,
      totalCities,
      results
    }, null, 2));
    
    console.log(`📋 Summary saved to: ${summaryFile}`);
  }
}

// Main execution
async function main() {
  const organizer = new ScenicAreasOrganizer();
  
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node organize-scenic-areas-from-lists.js all                    # Process all provinces');
    console.log('  node organize-scenic-areas-from-lists.js 河南 山东 江苏          # Process specific provinces');
    console.log('  node organize-scenic-areas-from-lists.js list                   # List available provinces');
    return;
  }
  
  if (args[0] === 'list') {
    const provinces = organizer.getProvinces();
    console.log('Available provinces:');
    provinces.forEach((province, index) => {
      console.log(`${index + 1}. ${province}`);
    });
    return;
  }
  
  try {
    if (args[0] === 'all') {
      await organizer.processAllProvinces();
    } else {
      await organizer.processSpecificProvinces(args);
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

export default ScenicAreasOrganizer;
