// AMap Spots Service - Search for spots within scenic areas using AMap API
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import process from 'process';
import { fileURLToPath } from 'url';
import TaskQueue from './taskQueue.js';

// Initialize task queue
const taskQueue = new TaskQueue();

// Load environment variables
dotenv.config({ path: '.env.amap' });
dotenv.config({ path: '.env.common' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AMap API configuration
const AMAP_KEY = process.env.AMAP_API_KEY || '';
const AMAP_SECRET = process.env.AMAP_API_SECRET || '';
const AMAP_SEARCH_URL = 'https://restapi.amap.com/v3/place/around';

// Default search parameters
const DEFAULT_RADIUS = 1000;
const DEFAULT_QUERY = '景点';
const DEFAULT_TYPE = '风景名胜';
const DEFAULT_OFFSET = 50; // Maximum results per page
const DEFAULT_PAGE = 1;
const DEFAULT_EXTENSIONS = 'all'; // Return detailed information

// Filtering configuration
const FILTER_CONFIG = {
  enableFiltering: true,
  filterStrength: 'loose', // strict, moderate, loose - changed to loose to be more inclusive
  useEnhancedQueries: true,
  maxResults: 50,
  minRelevanceScore: 0.1 // Lowered from 0.3 to 0.1 to be more inclusive
};

/**
 * Extract key terms from scenic area name for filtering
 * @param {string} scenicAreaName - Scenic area name
 * @returns {Array} - Array of key terms
 */
function extractKeyTerms(scenicAreaName) {
  const terms = [];
  
  // Always include the full scenic area name as the primary term
  terms.push(scenicAreaName);
  
  // Remove common suffixes for additional terms, but be more conservative
  const commonSuffixes = ['景区', '风景区', '旅游区', '度假区', '森林公园', '地质公园', '湿地公园', '国家公园', '自然保护区', '文化遗址', '博物馆', '纪念馆'];
  
  let cleanName = scenicAreaName;
  
  // Only remove very specific tourism-related suffixes, preserve names like "清明上河园"
  commonSuffixes.forEach(suffix => {
    if (cleanName.endsWith(suffix) && cleanName.length > suffix.length) {
      const withoutSuffix = cleanName.slice(0, -suffix.length);
      if (withoutSuffix.length >= 2) { // Only if remaining name is meaningful
        terms.push(withoutSuffix);
        cleanName = withoutSuffix;
      }
    }
  });
  
  // Add 3-character combinations for longer names
  if (cleanName.length >= 3) {
    for (let i = 0; i <= cleanName.length - 3; i++) {
      const term = cleanName.slice(i, i + 3);
      terms.push(term);
    }
  }
  
  // Add 2-character combinations
  if (cleanName.length >= 2) {
    for (let i = 0; i <= cleanName.length - 2; i++) {
      const term = cleanName.slice(i, i + 2);
      terms.push(term);
    }
  }
  
  // For very short names, add individual characters
  if (cleanName.length <= 3) {
    for (let i = 0; i < cleanName.length; i++) {
      terms.push(cleanName[i]);
    }
  }
  
  return [...new Set(terms)].filter(term => term.length > 0);
}

/**
 * Calculate relevance score for a spot relative to a scenic area
 * @param {Object} spot - Spot object
 * @param {Object} scenicArea - Scenic area object
 * @returns {number} - Relevance score (0-1)
 */
function calculateRelevanceScore(spot, scenicArea) {
  let score = 0;
  const keyTerms = extractKeyTerms(scenicArea.name);
  
  // Check spot name against scenic area key terms
  const spotName = spot.name.toLowerCase();
  const scenicAreaName = scenicArea.name.toLowerCase();
  const spotAddress = (spot.address || '').toLowerCase();
  
  // High priority: Address contains scenic area name (like "龙亭西路5号清明上河园")
  if (spotAddress.includes(scenicAreaName)) {
    score += 0.9; // Very high score for address match
    console.log(`   🎯 Address match for "${spot.name}": address contains "${scenicArea.name}"`);
  }
  
  // High priority: Exact name match
  if (spotName.includes(scenicAreaName)) {
    score += 0.8;
    console.log(`   🎯 Name match for "${spot.name}": name contains "${scenicArea.name}"`);
  }
  
  // Medium priority: Key terms matching in name
  let termMatches = 0;
  keyTerms.forEach(term => {
    if (spotName.includes(term.toLowerCase())) {
      termMatches++;
    }
  });
  
  if (keyTerms.length > 0) {
    const termScore = (termMatches / keyTerms.length) * 0.4;
    score += termScore;
    if (termScore > 0) {
      console.log(`   🔍 Term matches for "${spot.name}": ${termMatches}/${keyTerms.length} terms`);
    }
  }
  
  // Medium priority: Key terms matching in address
  if (spotAddress) {
    let addressTermMatches = 0;
    keyTerms.forEach(term => {
      if (spotAddress.includes(term.toLowerCase())) {
        addressTermMatches++;
      }
    });
    
    if (keyTerms.length > 0 && addressTermMatches > 0) {
      const addressTermScore = (addressTermMatches / keyTerms.length) * 0.3;
      score += addressTermScore;
      console.log(`   📍 Address term matches for "${spot.name}": ${addressTermMatches}/${keyTerms.length} terms`);
    }
  }
  
  // Low priority: Address similarity with scenic area address
  if (spot.address && scenicArea.address) {
    const scenicAreaAddress = scenicArea.address.toLowerCase();
    
    // Check if addresses share common location terms
    keyTerms.forEach(term => {
      if (spotAddress.includes(term.toLowerCase()) && scenicAreaAddress.includes(term.toLowerCase())) {
        score += 0.05; // Small bonus for shared location terms
      }
    });
  }
  
  // Distance penalty (closer is better, but less important than name/address matching)
  if (spot.distance) {
    const maxDistance = 1500; // Increased max distance
    const distancePenalty = Math.min(spot.distance / maxDistance, 1) * 0.1; // Reduced penalty
    score = Math.max(0, score - distancePenalty);
  }
  
  return Math.min(score, 1);
}

/**
 * Filter spots by scenic area relevance
 * @param {Array} spots - Array of spots
 * @param {Object} scenicArea - Scenic area object
 * @param {Object} filterConfig - Filter configuration
 * @returns {Array} - Filtered spots
 */
function filterSpotsByArea(spots, scenicArea, filterConfig = FILTER_CONFIG) {
  if (!filterConfig.enableFiltering) {
    return spots;
  }
  
  console.log(`🔍 Filtering ${spots.length} spots for scenic area: ${scenicArea.name}`);
  
  const keyTerms = extractKeyTerms(scenicArea.name);
  console.log(`   🔑 Key terms: ${keyTerms.join(', ')}`);
  
  // Calculate relevance scores for all spots
  const spotsWithScores = spots.map(spot => ({
    ...spot,
    relevanceScore: calculateRelevanceScore(spot, scenicArea)
  }));
  
  // Apply filtering based on strength
  let minScore = filterConfig.minRelevanceScore;
  
  switch (filterConfig.filterStrength) {
    case 'strict':
      minScore = 0.5;
      break;
    case 'moderate':
      minScore = 0.3;
      break;
    case 'loose':
      minScore = 0.1;
      break;
  }
  
  // Filter by minimum score
  const filteredSpots = spotsWithScores.filter(spot => spot.relevanceScore >= minScore);
  
  // Sort by relevance score (highest first)
  filteredSpots.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Limit results
  const limitedSpots = filteredSpots.slice(0, filterConfig.maxResults);
  
  console.log(`   ✅ Filtered to ${limitedSpots.length} relevant spots (min score: ${minScore})`);
  
  if (limitedSpots.length > 0) {
    console.log(`   📊 Score range: ${limitedSpots[limitedSpots.length - 1].relevanceScore.toFixed(2)} - ${limitedSpots[0].relevanceScore.toFixed(2)}`);
  }
  
  return limitedSpots;
}

/**
 * Generate enhanced search queries for a scenic area
 * @param {Object} scenicArea - Scenic area object
 * @returns {Array} - Array of search queries
 */
function generateEnhancedQueries(scenicArea) {
  const queries = [];
  const keyTerms = extractKeyTerms(scenicArea.name);
  
  // Primary query: scenic area name + 景点
  queries.push(`${scenicArea.name} 景点`);
  
  // Secondary query: just scenic area name
  queries.push(scenicArea.name);
  
  // Tertiary queries: key terms + 景点
  keyTerms.slice(0, 2).forEach(term => {
    if (term.length >= 2) {
      queries.push(`${term} 景点`);
    }
  });
  
  // Generic query as fallback
  queries.push('景点');
  
  return [...new Set(queries)]; // Remove duplicates
}

/**
 * Merge and deduplicate results from multiple searches
 * @param {Array} resultSets - Array of result sets
 * @returns {Array} - Merged and deduplicated results
 */
function mergeAndDeduplicateResults(resultSets) {
  const seenIds = new Set();
  const mergedResults = [];
  
  resultSets.forEach(resultSet => {
    if (resultSet && resultSet.results) {
      resultSet.results.forEach(spot => {
        if (!seenIds.has(spot.id)) {
          seenIds.add(spot.id);
          mergedResults.push(spot);
        }
      });
    }
  });
  
  return mergedResults;
}

/**
 * Generate signature for AMap API request
 * @param {Object} params - Request parameters
 * @returns {string} - Signature
 */
function generateSignature(params) {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params).sort().reduce((result, key) => {
    result[key] = params[key];
    return result;
  }, {});

  // Build string to sign
  let stringToSign = '';
  for (const key in sortedParams) {
    if (sortedParams[key] !== '' && sortedParams[key] !== undefined && sortedParams[key] !== null) {
      if (stringToSign.length > 0) {
        stringToSign += '&';
      }
      stringToSign += `${key}=${sortedParams[key]}`;
    }
  }

  // Add secret
  stringToSign += AMAP_SECRET;

  // Generate MD5 hash
  const md5Hash = crypto.createHash('md5').update(stringToSign, 'utf8').digest('hex');
  
  console.log('🔐 Generated signature for API request');
  console.log(`   📝 Raw string to sign: ${stringToSign.replace(AMAP_SECRET, '***SECRET***')}`);
  console.log(`   🔑 Signature: ${md5Hash.substring(0, 6)}...${md5Hash.substring(md5Hash.length - 6)}`);
  
  return md5Hash;
}

/**
 * Search for spots around a location using AMap API
 * @param {string} location - Location coordinates (lng,lat)
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function searchSpots(location, options = {}) {
  const radius = options.radius || DEFAULT_RADIUS;
  const query = options.query || DEFAULT_QUERY;
  const type = options.type || DEFAULT_TYPE;
  const offset = options.offset || DEFAULT_OFFSET;
  const page = options.page || DEFAULT_PAGE;
  const extensions = options.extensions || DEFAULT_EXTENSIONS;
  
  // Prepare request parameters
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    key: AMAP_KEY,
    location,
    radius,
    keywords: query,
    types: type,
    offset,
    page,
    extensions,
    output: 'JSON',
    timestamp
  };
  
  // Generate signature
  const signature = generateSignature(params);
  console.log('🔐 Using API signature for enhanced security');
  
  // Add signature to parameters
  params.sig = signature;
  
  // Build URL with query parameters
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const url = `${AMAP_SEARCH_URL}?${queryString}`;
  // Log URL with masked API key for security
  const maskedUrl = url
  // .replace(AMAP_KEY, 'XXXX-API-KEY-XXXX');
  console.log(`🌐 API URL: ${maskedUrl}`);
  
  try {
    console.log(`🔍 Searching for spots around ${location} with radius ${radius}m...`);
    
    const startTime = Date.now();
    const response = await axios.get(url);
    const endTime = Date.now();
    
    console.log(`⏱️ Response received in ${endTime - startTime}ms with status ${response.status}`);
    
    if (response.status !== 200) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = response.data;
    
    if (data.status !== '1') {
      throw new Error(`API returned error: ${data.info} (code: ${data.infocode})`);
    }
    
    // Process and format results
    const results = data.pois.map(poi => ({
      id: poi.id,
      name: poi.name,
      type: poi.type,
      address: poi.address || '',
      location: {
        lat: parseFloat(poi.location.split(',')[1]),
        lng: parseFloat(poi.location.split(',')[0])
      },
      distance: parseInt(poi.distance) || 0,
      tel: poi.tel || '',
      rating: parseFloat(poi.biz_ext?.rating) || 0,
      photos: poi.photos || [],
      business_area: poi.business_area || '',
      tag: poi.tag || '',
      website: poi.website || '',
      provider: 'amap'
    }));
    
    console.log(`✅ Found ${results.length} spots around ${location}`);
    
    return {
      status: 'success',
      count: results.length,
      total: parseInt(data.count),
      results,
      raw: data
    };
    
  } catch (error) {
    console.error(`❌ Error searching spots: ${error.message}`);
    throw error;
  }
}

/**
 * Search for spots within a scenic area
 * @param {Object} scenicArea - Scenic area object
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function searchSpotsInScenicArea(scenicArea, options = {}) {
  console.log(`🔍 Searching for spots in scenic area: ${scenicArea.name}`);
  
  // Check if we have center coordinates
  if (!scenicArea.center && !scenicArea.coordinates) {
    throw new Error(`No center coordinates found for ${scenicArea.name}`);
  }
  
  // Use center or coordinates field
  let center = scenicArea.center || scenicArea.coordinates;
  
  // Check if coordinates are fallback (all same coordinates) and need to be updated
  const isFallback = scenicArea.coordinateInfo?.source === 'fallback' ||
                    (center?.lat === 34.7466 && center?.lng === 113.6253);
  
  if (isFallback) {
    console.log(`⚠️ ${scenicArea.name} has fallback coordinates, getting actual coordinates...`);
    
    try {
      // Import coordinate service dynamically to avoid circular imports
      const { amapCoordinateService } = await import('./amapCoordinateService.js');
      
      // Build search query with name and address
      const searchQuery = `${scenicArea.name} ${scenicArea.address || ''}`.trim();
      console.log(`🔍 Geocoding: "${searchQuery}"`);
      
      // Get actual coordinates
      const actualCoordinates = await amapCoordinateService.getCoordinates(searchQuery);
      
      if (actualCoordinates && actualCoordinates.lat && actualCoordinates.lng) {
        center = {
          lat: actualCoordinates.lat,
          lng: actualCoordinates.lng
        };
        
        console.log(`✅ Got actual coordinates for ${scenicArea.name}:`);
        console.log(`   📍 ${actualCoordinates.lat}, ${actualCoordinates.lng}`);
        
        // Update the scenic area object with new coordinates
        scenicArea.center = center;
        // scenicArea.coordinateInfo = {
        //   source: 'amap_geocoding',
        //   status: 'success',
        //   query: searchQuery,
        //   timestamp: new Date().toISOString()
        // };
      } else {
        console.log(`❌ Could not get coordinates for ${scenicArea.name}, using fallback`);
      }
    } catch (error) {
      console.error(`❌ Error getting coordinates for ${scenicArea.name}: ${error.message}`);
      console.log(`🔄 Using fallback coordinates`);
    }
  }
  
  const location = `${center.lng},${center.lat}`;
  
  // Determine radius based on scenic area level or provided radius
  let radius = options.radius;
  if (!radius) {
    if (scenicArea.radius) {
      radius = scenicArea.radius;
    } else {
      // Default radius based on scenic area level
      radius = scenicArea.level === '5A' ? 1500 : 
               scenicArea.level === '4A' ? 1000 : 500;
    }
  }
  
  // Set output file path if provided
  let outputPath = options.output;
  if (!outputPath && options.outputDir) {
    const fileName = `${scenicArea.name}.json`;
    outputPath = path.join(options.outputDir, fileName);
  }
  
  // Merge filter config with options
  const filterConfig = {
    ...FILTER_CONFIG,
    ...options.filterConfig
  };
  
  try {
    let allResults = [];
    
    // Strategy 5: Enhanced Query Filtering
    if (filterConfig.useEnhancedQueries) {
      console.log(`🔍 Using enhanced queries for ${scenicArea.name}`);
      const queries = generateEnhancedQueries(scenicArea);
      console.log(`   📝 Generated ${queries.length} queries: ${queries.join(', ')}`);
      
      const resultSets = [];
      
      for (const [index, query] of queries.entries()) {
        console.log(`   🔍 Query ${index + 1}/${queries.length}: "${query}"`);
        
        const searchOptions = {
          ...options,
          radius,
          query
        };
        
        try {
          const result = await searchSpots(location, searchOptions);
          resultSets.push(result);
          
          // Add small delay between queries to avoid rate limiting
          if (index < queries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error) {
          console.error(`   ❌ Error with query "${query}": ${error.message}`);
        }
      }
      
      // Merge and deduplicate results
      allResults = mergeAndDeduplicateResults(resultSets);
      console.log(`   ✅ Merged results: ${allResults.length} unique spots`);
    } else {
      // Standard single query search
      const searchOptions = {
        ...options,
        radius
      };
      
      const results = await searchSpots(location, searchOptions);
      allResults = results.results || [];
    }
    
    // Strategy 1: Post-Processing Filtering
    const filteredResults = filterSpotsByArea(allResults, scenicArea, filterConfig);
    
    // Create final results object
    const finalResults = {
      status: 'success',
      count: filteredResults.length,
      total: allResults.length,
      results: filteredResults,
      filtering: {
        enabled: filterConfig.enableFiltering,
        strength: filterConfig.filterStrength,
        originalCount: allResults.length,
        filteredCount: filteredResults.length,
        filterRatio: allResults.length > 0 ? (filteredResults.length / allResults.length).toFixed(2) : 0
      }
    };
    
    // Save results to file if output path is provided
    if (outputPath) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Add scenic area info to results
      const resultsWithMeta = {
        ...finalResults,
        scenicArea: {
          name: scenicArea.name,
          center,
          radius,
          level: scenicArea.level,
          address: scenicArea.address,
          description: scenicArea.description
        },
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(resultsWithMeta, null, 2));
      console.log(`💾 Results saved to: ${outputPath}`);
      console.log(`   📊 Final count: ${filteredResults.length} spots (filtered from ${allResults.length})`);
      
      return resultsWithMeta;
    }
    
    return finalResults;
  } catch (error) {
    console.error(`❌ Error searching spots in ${scenicArea.name}: ${error.message}`);
    throw error;
  }
}

/**
 * Search for spots within all scenic areas in a province/city
 * @param {string} province - Province name
 * @param {string} city - City name
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
async function searchSpotsInCity(province, city, options = {}) {
  console.log(`🔍 Searching for spots in all scenic areas in ${province}/${city}`);
  
  try {
    // Construct path to scenic area file
    const scenicAreaFilePath = path.join('assets', province, city, 'data', 'scenic-area.json');
    
    // Check if file exists
    if (!fs.existsSync(scenicAreaFilePath)) {
      throw new Error(`Scenic area file not found: ${scenicAreaFilePath}`);
    }
    
    // Read scenic area data
    const scenicAreaData = JSON.parse(fs.readFileSync(scenicAreaFilePath, 'utf8'));
    
    // Check if the data has a scenicAreas array
    if (!scenicAreaData.scenicAreas || !Array.isArray(scenicAreaData.scenicAreas)) {
      throw new Error(`No scenic areas found in data file`);
    }
    
    const scenicAreas = scenicAreaData.scenicAreas;
    console.log(`📊 Found ${scenicAreas.length} scenic areas in ${province}/${city}`);
    
    // Set output directory
    let outputDir = options.outputDir;
    if (!outputDir) {
      outputDir = path.join('assets', province, city, 'data', 'spots');
    }
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }
    
    // Search for spots in each scenic area
    const results = [];
    for (const [index, scenicArea] of scenicAreaData.scenicAreas.entries()) {
      console.log(`\n🔄 Processing scenic area ${index + 1}/${scenicAreaData.scenicAreas.length}: ${scenicArea.name}`);
      
      try {
        // Set output file path
        const fileName = `${scenicArea.name}.json`;
        const outputPath = path.join(outputDir, fileName);
        
        // Search for spots
        const searchOptions = {
          ...options,
          output: outputPath
        };
        
        const result = await searchSpotsInScenicArea(scenicArea, searchOptions);
        
        // Update scenic area with spots file path
        scenicArea.spotsFile = `spots/${fileName}`;
        
        results.push({
          scenicArea: scenicArea.name,
          count: result.count,
          outputPath
        });
        
        // Add delay between requests to avoid rate limiting
        if (index < scenicAreaData.scenicAreas.length - 1) {
          const delay = options.delay || 1000;
          console.log(`⏱️ Adding delay of ${delay}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`❌ Error processing ${scenicArea.name}: ${error.message}`);
        results.push({
          scenicArea: scenicArea.name,
          error: error.message
        });
      }
    }
    
    // Save updated scenic area data
    fs.writeFileSync(scenicAreaFilePath, JSON.stringify(scenicAreaData, null, 2));
    console.log(`\n💾 Updated scenic area data with spots file paths: ${scenicAreaFilePath}`);
    
    return {
      status: 'success',
      province,
      city,
      scenicAreas: scenicAreaData.scenicAreas.length,
      results
    };
  } catch (error) {
    console.error(`❌ Error searching spots in city: ${error.message}`);
    throw error;
  }
}

/**
 * Queue a task to search for spots in a scenic area
 * @param {string} province - Province name
 * @param {string} city - City name
 * @param {string} scenicAreaName - Scenic area name
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Task result
 */
async function queueSpotsSearch(province, city, scenicAreaName, options = {}) {
  const taskId = `spots_search_${province}_${city}_${scenicAreaName}`;
  
  // Create task data
  const taskData = {
    province,
    city,
    scenicAreaName,
    options
  };
  
  // Add task to queue
  taskQueue.addTask('SEARCH_NEARBY_SPOTS', taskData);
  
  // For now, we'll just execute the search directly instead of waiting for the queue
  // In a real implementation, you would wait for the task to complete
  try {
    // Construct path to scenic area file
    const scenicAreaFilePath = path.join('assets', province, city, 'data', 'scenic-area.json');
    
    // Check if file exists
    if (!fs.existsSync(scenicAreaFilePath)) {
      throw new Error(`Scenic area file not found: ${scenicAreaFilePath}`);
    }
    
    // Read scenic area data
    const scenicAreaData = JSON.parse(fs.readFileSync(scenicAreaFilePath, 'utf8'));
    
    if (!scenicAreaData.scenicAreas || !Array.isArray(scenicAreaData.scenicAreas)) {
      throw new Error(`No scenic areas found in data file`);
    }
    
    // Find the specific scenic area
    const scenicArea = scenicAreaData.scenicAreas.find(area => area.name === scenicAreaName);
    
    if (!scenicArea) {
      throw new Error(`Scenic area "${scenicAreaName}" not found in data file`);
    }
    
    // Set output directory
    const outputDir = path.join('assets', province, city, 'data', 'spots');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Set output file path
    const fileName = `${scenicArea.name}.json`;
    const outputPath = path.join(outputDir, fileName);
    
    // Search for spots
    const searchOptions = {
      ...options,
      output: outputPath
    };
    
    const result = await searchSpotsInScenicArea(scenicArea, searchOptions);
    
    // Update scenic area with spots file path
    scenicArea.spotsFile = `spots/${fileName}`;
    
    // Save updated scenic area data
    fs.writeFileSync(scenicAreaFilePath, JSON.stringify(scenicAreaData, null, 2));
    
    return {
      status: 'success',
      scenicArea: scenicArea.name,
      count: result.count,
      outputPath
    };
  } catch (error) {
    console.error(`❌ Error in task ${taskId}: ${error.message}`);
    throw error;
  }
}

/**
 * Queue a task to search for spots in all scenic areas in a city
 * @param {string} province - Province name
 * @param {string} city - City name
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Task result
 */
async function queueCitySpotsSearch(province, city, options = {}) {
  const taskId = `spots_search_city_${province}_${city}`;
  
  // Create task data
  const taskData = {
    province,
    city,
    options
  };
  
  // Add task to queue
  taskQueue.addTask('SEARCH_NEARBY_SPOTS', taskData);
  
  // For now, we'll just execute the search directly instead of waiting for the queue
  try {
    return await searchSpotsInCity(province, city, options);
  } catch (error) {
    console.error(`❌ Error in task ${taskId}: ${error.message}`);
    throw error;
  }
}

export const amapSpotsService = {
  searchSpots,
  searchSpotsInScenicArea,
  searchSpotsInCity,
  queueSpotsSearch,
  queueCitySpotsSearch
};
