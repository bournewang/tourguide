import fs from 'fs';
import fetch from 'node-fetch';
import process from 'process';
import path from 'path';
import crypto from 'crypto';
import AmapCoordinateService from './amapCoordinateService.js';

class AIScenicAreasService {
  constructor() {
    this.cache = new Map();
    this.aiCallCache = new Map(); // Separate cache for individual AI calls
    this.cacheTimeout = 4 * 60 * 60 * 1000; // 4 hours
    this.aiCallCacheTimeout = 24 * 60 * 60 * 1000; // 24 hours for AI call cache
    this.amapCoordinateService = new AmapCoordinateService();
    this.loadCacheFromFile();
    this.ensureLogDirectory();
  }

  // Ensure logs directory exists
  ensureLogDirectory() {
    try {
      if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs', { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error.message);
    }
  }

  // Log AI interactions for debugging
  logAIInteraction(provinceName, prompt, rawResponse, parsedResult, error = null) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        provinceName,
        prompt,
        rawResponse,
        parsedResult,
        error: error ? error.message : null,
        success: !error
      };

      // Save to individual province log file
      const logFile = path.join('logs', `ai-${provinceName}-${timestamp.split('T')[0]}.json`);
      fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));

      // Also append to master log
      const masterLogFile = path.join('logs', 'ai-interactions.jsonl');
      fs.appendFileSync(masterLogFile, JSON.stringify(logEntry) + '\n');

      console.log(`📝 AI interaction logged to: ${logFile}`);
    } catch (logError) {
      console.error('Failed to log AI interaction:', logError.message);
    }
  }

  // Validate response completeness
  validateResponse(provinceName, result) {
    const warnings = [];
    const expectedScenicAreas = this.getExpectedScenicAreas(provinceName);
    
    if (!result.cities || Object.keys(result.cities).length === 0) {
      warnings.push('No cities found in response');
      return { isValid: false, warnings };
    }

    // Check for expected scenic areas
    for (const [cityName, expectedAreas] of Object.entries(expectedScenicAreas)) {
      const cityData = result.cities[cityName];
      if (!cityData || cityData.length === 0) {
        warnings.push(`Missing city: ${cityName}`);
        continue;
      }

      const foundNames = cityData.map(area => area.name);
      for (const expectedArea of expectedAreas) {
        const found = foundNames.some(name => 
          name.includes(expectedArea) || expectedArea.includes(name)
        );
        if (!found) {
          warnings.push(`Missing scenic area in ${cityName}: ${expectedArea}`);
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      foundCities: Object.keys(result.cities).length,
      totalScenicAreas: Object.values(result.cities).flat().length
    };
  }

  // Get expected scenic areas for validation
  getExpectedScenicAreas(provinceName) {
    const expectations = {
      '河南': {
        '郑州': ['嵩山少林景区', '嵩阳书院', '中岳庙', '黄河风景名胜区'],
        '洛阳': ['龙门石窟', '白马寺', '关林庙', '洛阳博物馆'],
        '开封': ['清明上河园', '开封府', '大相国寺', '铁塔公园'],
        '安阳': ['殷墟', '红旗渠', '太行大峡谷'],
        '焦作': ['云台山', '神农山', '青天河']
      },
      '山东': {
        '济南': ['趵突泉', '千佛山', '大明湖'],
        '青岛': ['崂山', '八大关'],
        '泰安': ['泰山'],
        '曲阜': ['孔庙孔府孔林'],
        '威海': ['刘公岛']
      },
      '江苏': {
        '南京': ['中山陵', '明孝陵', '夫子庙'],
        '苏州': ['拙政园', '留园', '虎丘'],
        '无锡': ['鼋头渚', '灵山大佛'],
        '扬州': ['瘦西湖', '个园']
      }
    };

    return expectations[provinceName] || {};
  }

  // Load cache from file on startup
  loadCacheFromFile() {
    try {
      // Load province-level cache
      if (fs.existsSync('cache/scenic-areas-cache.json')) {
        const cacheData = JSON.parse(fs.readFileSync('cache/scenic-areas-cache.json', 'utf8'));
        Object.entries(cacheData).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
        console.log('📦 Loaded scenic areas cache from file');
      }
      
      // Load AI call cache
      if (fs.existsSync('cache/ai-call-cache.json')) {
        const aiCacheData = JSON.parse(fs.readFileSync('cache/ai-call-cache.json', 'utf8'));
        Object.entries(aiCacheData).forEach(([key, value]) => {
          this.aiCallCache.set(key, value);
        });
        console.log(`🧠 Loaded ${Object.keys(aiCacheData).length} AI call cache entries from file`);
      }
    } catch (error) {
      console.error('Failed to load cache from file:', error.message);
    }
  }

  // Save cache to file
  saveCacheToFile() {
    try {
      if (!fs.existsSync('cache')) {
        fs.mkdirSync('cache', { recursive: true });
      }
      
      // Save province-level cache
      const cacheData = Object.fromEntries(this.cache);
      fs.writeFileSync('cache/scenic-areas-cache.json', JSON.stringify(cacheData, null, 2));
      
      // Save AI call cache
      const aiCacheData = Object.fromEntries(this.aiCallCache);
      fs.writeFileSync('cache/ai-call-cache.json', JSON.stringify(aiCacheData, null, 2));
      
      console.log(`💾 Saved cache: ${Object.keys(cacheData).length} province entries, ${Object.keys(aiCacheData).length} AI call entries`);
    } catch (error) {
      console.error('Failed to save cache to file:', error.message);
    }
  }

  // Enrich scenic areas with actual coordinates from AMap API
  async enrichScenicAreasWithCoordinates(scenicAreasData) {
    console.log(`🗺️ Enriching scenic areas with actual coordinates...`);
    
    if (!scenicAreasData.cities) {
      return scenicAreasData;
    }

    const enrichedCities = {};
    
    for (const [cityName, scenicAreas] of Object.entries(scenicAreasData.cities)) {
      console.log(`📍 Processing ${scenicAreas.length} scenic areas in ${cityName}...`);
      
      const enrichedAreas = [];
      
      for (const [index, area] of scenicAreas.entries()) {
        try {
          console.log(`  🔍 Getting coordinates for ${area.name} (${index + 1}/${scenicAreas.length})`);
          
          // Build search query with name and address
          const searchQuery = `${area.name} ${area.address || ''}`.trim();
          
          // Get coordinates from AMap
          const result = await this.amapCoordinateService.fetchCoordinate({
            name: area.name,
            address: area.address || '',
            city: cityName,
            province: scenicAreasData.province
          });
          
          if (result && result.coordinates && result.coordinates.lat && result.coordinates.lng) {
            // Update area with actual coordinates
            const enrichedArea = {
              ...area,
              coordinates: {
                lat: result.coordinates.lat,
                lng: result.coordinates.lng
              },
              // coordinateInfo: {
              //   source: result.source || 'amap_geocoding',
              //   status: result.status || 'success',
              //   query: result.query || searchQuery,
              //   timestamp: result.timestamp || new Date().toISOString(),
              //   formatted_address: result.formatted_address,
              //   confidence: result.confidence
              // }
            };
            
            enrichedAreas.push(enrichedArea);
            console.log(`    ✅ Got coordinates: ${result.coordinates.lat}, ${result.coordinates.lng}`);
          } else {
            // Keep original area but mark coordinates as failed
            const enrichedArea = {
              ...area,
              coordinates: area.coordinates || { lat: 0, lng: 0 },
              // coordinateInfo: {
              //   source: result?.source || 'amap_geocoding',
              //   status: result?.status || 'failed',
              //   query: result?.query || searchQuery,
              //   timestamp: result?.timestamp || new Date().toISOString(),
              //   error: result?.error
              // }
            };
            
            enrichedAreas.push(enrichedArea);
            console.log(`    ❌ Could not get coordinates for ${area.name}`);
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`    ❌ Error getting coordinates for ${area.name}: ${error.message}`);
          
          // Keep original area but mark coordinates as error
          const enrichedArea = {
            ...area,
            coordinates: area.coordinates || { lat: 0, lng: 0 },
            // coordinateInfo: {
            //   source: 'amap_geocoding',
            //   status: 'error',
            //   error: error.message,
            //   timestamp: new Date().toISOString()
            // }
          };
          
          enrichedAreas.push(enrichedArea);
        }
      }
      
      enrichedCities[cityName] = enrichedAreas;
    }
    
    return {
      ...scenicAreasData,
      cities: enrichedCities,
      coordinatesEnriched: true,
      coordinatesEnrichedAt: new Date().toISOString()
    };
  }

  async getScenicAreasByProvince(provinceName) {
    const cacheKey = `scenic_areas_${provinceName}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`Using cached data for ${provinceName}`);
      return {
        ...cached.data,
        fromCache: true,
        cacheAge: Date.now() - cached.timestamp
      };
    }

    console.log(`🤖 Fetching new data for ${provinceName} from AI`);
    const prompt = this.buildEnhancedPrompt(provinceName);

    try {
      const result = await this.callAI(prompt, provinceName);
      
      // Enrich with actual coordinates from AMap
      console.log(`🗺️ Enriching scenic areas with actual coordinates...`);
      const enrichedResult = await this.enrichScenicAreasWithCoordinates(result);
      
      // Validate the response
      const validation = this.validateResponse(provinceName, enrichedResult);
      console.log(`✅ Response validation for ${provinceName}:`, validation);
      
      if (!validation.isValid) {
        console.warn(`⚠️ Incomplete response for ${provinceName}:`, validation.warnings);
      }

      // Cache the result with validation info
      const finalResult = {
        ...enrichedResult,
        validation,
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, {
        data: finalResult,
        timestamp: Date.now()
      });

      // Save cache to file
      this.saveCacheToFile();

      return {
        ...finalResult,
        fromCache: false,
        cacheAge: 0
      };
    } catch (error) {
      console.error(`❌ Failed to fetch data for ${provinceName}:`, error.message);
      throw error;
    }
  }

  // Build enhanced prompt with specific examples
  buildEnhancedPrompt(provinceName) {
    const expectedAreas = this.getExpectedScenicAreas(provinceName);
    let examplesText = '';
    
    if (Object.keys(expectedAreas).length > 0) {
      examplesText = '\n\n特别注意，请确保包含以下重要景区：\n';
      for (const [cityName, areas] of Object.entries(expectedAreas)) {
        examplesText += `- ${cityName}市：${areas.join('、')}\n`;
      }
    }

    return `请列出${provinceName}省所有的5A、4A、3A、2A、1A级景区，按城市分组。${examplesText}

要求返回JSON格式，结构如下：
{
  "province": "${provinceName}",
  "cities": {
    "城市名": [
      {
        "name": "景区名称",
        "level": "5A",
        "address": "详细地址",
        "coordinates": {
          "lat": 纬度,
          "lng": 经度
        }
      }
    ]
  }
}

请确保：
1. 数据准确，包含真实存在的景区
2. 坐标准确（使用百度坐标系BD09）
3. 描述简洁但信息丰富
4. 按城市正确分组
5. 包含各个等级的景区，不要遗漏
6. 只返回JSON，不要其他文字`;
  }

  // Generate cache key for AI calls based on prompt content and province
  generateAICacheKey(prompt, identifier) {
    const hash = crypto.createHash('sha256');
    hash.update(prompt + identifier);
    return `ai_call_${hash.digest('hex').substring(0, 16)}`;
  }

  // Clean expired AI cache entries
  cleanExpiredAICache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, value] of this.aiCallCache.entries()) {
      if (now - value.timestamp > this.aiCallCacheTimeout) {
        this.aiCallCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} expired AI cache entries`);
      this.saveCacheToFile();
    }
  }

  async callAI(prompt, identifier) {
    // Generate cache key based on prompt and identifier
    const cacheKey = this.generateAICacheKey(prompt, identifier);
    
    // Clean expired entries before checking cache
    this.cleanExpiredAICache();
    
    // Check if we have a cached result
    const cached = this.aiCallCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.aiCallCacheTimeout) {
      const ageMinutes = Math.floor((Date.now() - cached.timestamp) / 1000 / 60);
      console.log(`💾 Using cached AI result for ${identifier} (${ageMinutes} minutes old)`);
      return {
        ...cached.result,
        fromCache: true,
        cacheAge: Date.now() - cached.timestamp
      };
    }
    
    const provider = process.env.AI_PROVIDER || 'aliyun';
    
    console.log(`🔄 Calling ${provider} AI for ${identifier} (cache miss)...`);
    
    let result;
    if (provider === 'aliyun') {
      result = await this.callAliyunAI(prompt, identifier);
    } else if (provider === 'openai') {
      result = await this.callOpenAI(prompt, identifier);
    } else {
      throw new Error('Unsupported AI provider');
    }
    
    // Cache the result
    this.aiCallCache.set(cacheKey, {
      result: result,
      timestamp: Date.now(),
      identifier: identifier,
      promptHash: cacheKey
    });
    
    // Save cache to file
    this.saveCacheToFile();
    
    return {
      ...result,
      fromCache: false,
      cacheAge: 0
    };
  }

  async callAliyunAI(prompt, provinceName) {
    const apiKey = process.env.VITE_DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_DASHSCOPE_API_KEY not configured');
    }

    let rawResponse = '';
    let parsedResult = null;
    let error = null;

    try {
      console.log(`📤 Sending request to Aliyun AI for ${provinceName}...`);
      
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的旅游信息专家，熟悉中国各省市的景区信息。请提供准确、详细的景区数据，严格按照要求的JSON格式返回。确保包含所有重要的5A、4A、3A级景区，不要遗漏。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 8000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        error = new Error(`Aliyun AI API error: ${response.status} ${response.statusText} - ${errorText}`);
        throw error;
      }

      const data = await response.json();
      rawResponse = data.choices[0].message.content;
      
      console.log(`📥 Received response from Aliyun AI for ${provinceName} (${rawResponse.length} characters)`);
      console.log(`🔍 Raw AI Response Preview:`, rawResponse.substring(0, 500) + '...');
      
      // Parse JSON from AI response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResult = JSON.parse(jsonMatch[0]);
          console.log(`✅ Successfully parsed JSON for ${provinceName}`);
          console.log(`📊 Found ${Object.keys(parsedResult.cities || {}).length} cities with ${Object.values(parsedResult.cities || {}).flat().length} scenic areas`);
        } catch (parseError) {
          error = new Error('Failed to parse JSON from AI response: ' + parseError.message);
          throw error;
        }
      } else {
        error = new Error('No valid JSON found in AI response');
        throw error;
      }

      // Log successful interaction
      this.logAIInteraction(provinceName, prompt, rawResponse, parsedResult);
      
      return parsedResult;

    } catch (err) {
      error = err;
      console.error(`❌ Aliyun AI call failed for ${provinceName}:`, err.message);
      
      // Log failed interaction
      this.logAIInteraction(provinceName, prompt, rawResponse, parsedResult, error);
      
      throw err;
    }
  }

  async callOpenAI(prompt, provinceName) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    let rawResponse = '';
    let parsedResult = null;
    let error = null;

    try {
      console.log(`📤 Sending request to OpenAI for ${provinceName}...`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a tourism expert familiar with Chinese scenic areas. Provide accurate, detailed scenic area data in the exact JSON format requested. Ensure you include all important 5A, 4A, and 3A level scenic areas without omission.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        error = new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        throw error;
      }

      const data = await response.json();
      rawResponse = data.choices[0].message.content;
      
      console.log(`📥 Received response from OpenAI for ${provinceName} (${rawResponse.length} characters)`);
      console.log(`🔍 Raw AI Response Preview:`, rawResponse.substring(0, 500) + '...');
      
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResult = JSON.parse(jsonMatch[0]);
          console.log(`✅ Successfully parsed JSON for ${provinceName}`);
          console.log(`📊 Found ${Object.keys(parsedResult.cities || {}).length} cities with ${Object.values(parsedResult.cities || {}).flat().length} scenic areas`);
        } catch (parseError) {
          error = new Error('Failed to parse JSON from AI response: ' + parseError.message);
          throw error;
        }
      } else {
        error = new Error('No valid JSON found in AI response');
        throw error;
      }

      // Log successful interaction
      this.logAIInteraction(provinceName, prompt, rawResponse, parsedResult);
      
      return parsedResult;

    } catch (err) {
      error = err;
      console.error(`❌ OpenAI call failed for ${provinceName}:`, err.message);
      
      // Log failed interaction
      this.logAIInteraction(provinceName, prompt, rawResponse, parsedResult, error);
      
      throw err;
    }
  }

  // Clear cache manually if needed
  clearCache(provinceName = null, clearAICache = false) {
    if (provinceName) {
      this.cache.delete(`scenic_areas_${provinceName}`);
    } else {
      this.cache.clear();
    }
    
    if (clearAICache) {
      if (provinceName) {
        // Clear AI cache entries for specific province/identifier
        const keysToDelete = [];
        for (const [key, value] of this.aiCallCache.entries()) {
          if (value.identifier && value.identifier.includes(provinceName)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => this.aiCallCache.delete(key));
        console.log(`🧹 Cleared ${keysToDelete.length} AI cache entries for ${provinceName}`);
      } else {
        const count = this.aiCallCache.size;
        this.aiCallCache.clear();
        console.log(`🧹 Cleared ${count} AI cache entries`);
      }
    }
    
    this.saveCacheToFile();
  }

  // Get cache status
  getCacheStatus() {
    const status = {
      provinceCache: {},
      aiCallCache: {
        total: this.aiCallCache.size,
        entries: {}
      }
    };
    
    // Province cache status
    this.cache.forEach((value, key) => {
      const age = Date.now() - value.timestamp;
      const remaining = this.cacheTimeout - age;
      status.provinceCache[key] = {
        age: Math.floor(age / 1000 / 60), // minutes
        remaining: Math.floor(remaining / 1000 / 60), // minutes
        expired: remaining <= 0
      };
    });
    
    // AI call cache status
    this.aiCallCache.forEach((value, key) => {
      const age = Date.now() - value.timestamp;
      const remaining = this.aiCallCacheTimeout - age;
      status.aiCallCache.entries[key] = {
        identifier: value.identifier,
        age: Math.floor(age / 1000 / 60), // minutes
        remaining: Math.floor(remaining / 1000 / 60), // minutes
        expired: remaining <= 0
      };
    });
    
    return status;
  }

  // Get recent AI interaction logs
  getRecentLogs(limit = 10) {
    try {
      const masterLogFile = path.join('logs', 'ai-interactions.jsonl');
      if (!fs.existsSync(masterLogFile)) {
        return [];
      }

      const content = fs.readFileSync(masterLogFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      // Get the last N lines and parse them
      const recentLines = lines.slice(-limit);
      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.error('Failed to read recent logs:', error.message);
      return [];
    }
  }

  // Get logs for a specific province
  getProvinceLogs(provinceName) {
    try {
      const logsDir = 'logs';
      if (!fs.existsSync(logsDir)) {
        return [];
      }

      const files = fs.readdirSync(logsDir)
        .filter(file => file.startsWith(`ai-${provinceName}-`) && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

      return files.slice(0, 5).map(file => {
        try {
          const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
          return JSON.parse(content);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.error(`Failed to read logs for ${provinceName}:`, error.message);
      return [];
    }
  }

  // Debug method to force refresh a province (clear cache and fetch new)
  async forceRefreshProvince(provinceName) {
    console.log(`🔄 Force refreshing data for ${provinceName}...`);
    
    // Clear cache for this province
    this.clearCache(provinceName);
    
    // Fetch fresh data
    return await this.getScenicAreasByProvince(provinceName);
  }

  // Get validation summary for all cached provinces
  getValidationSummary() {
    const summary = {};
    this.cache.forEach((value, key) => {
      if (key.startsWith('scenic_areas_')) {
        const provinceName = key.replace('scenic_areas_', '');
        const data = value.data;
        summary[provinceName] = {
          cached: true,
          validation: data.validation || null,
          citiesCount: Object.keys(data.cities || {}).length,
          scenicAreasCount: Object.values(data.cities || {}).flat().length,
          cacheAge: Math.floor((Date.now() - value.timestamp) / 1000 / 60) // minutes
        };
      }
    });
    return summary;
  }
}

export default AIScenicAreasService;
