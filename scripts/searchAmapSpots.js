#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Command } from 'commander';
import AmapCoordinateService from '../services/amapCoordinateService.js';
const program = new Command();

// Load environment variables
dotenv.config({ path: '.env.amap' });
dotenv.config({ path: '.env.common' });

// Create coordinate service instance
const amapCoordinateService = new AmapCoordinateService();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AMap API configuration
const AMAP_KEY = process.env.AMAP_API_KEY || '';
const AMAP_SECRET = process.env.AMAP_API_SECRET || '';
const AMAP_SEARCH_URL = 'https://restapi.amap.com/v3/place/around';

// Check if API key and secret are available
if (!AMAP_KEY || !AMAP_SECRET) {
  console.error('❌ Error: AMap API key or secret is missing in environment variables');
  console.error('Please make sure AMAP_API_KEY and AMAP_API_SECRET are set in .env.amap file');
}

// Default search parameters
const DEFAULT_RADIUS = 1000;
const DEFAULT_QUERY = '景点';
const DEFAULT_TYPE = '风景名胜';
const DEFAULT_OFFSET = 50; // Maximum results per page
const DEFAULT_PAGE = 1;
const DEFAULT_EXTENSIONS = 'all'; // Return detailed information

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
  const maskedUrl = url.replace(AMAP_KEY, 'XXXX-API-KEY-XXXX');
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
export async function searchSpotsInScenicArea(scenicArea, options = {}) {
  console.log(`🔍 Searching for spots in scenic area: ${scenicArea.name}`);
  
  // Check if we have center coordinates
  if (!scenicArea.center && !scenicArea.coordinates) {
    throw new Error(`No center coordinates found for ${scenicArea.name}`);
  }
  
  // Use center or coordinates field
  const center = scenicArea.center || scenicArea.coordinates;
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
    const fileName = `${scenicArea.name.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '')}.json`;
    outputPath = path.join(options.outputDir, fileName);
  }
  
  // Use enhanced filtering from amapSpotsService
  try {
    // Import the enhanced service
    const { amapSpotsService } = await import('../services/amapSpotsService.js');
    
    // Use the enhanced search function
    const result = await amapSpotsService.searchSpotsInScenicArea(scenicArea, options);
    
    console.log(`✅ Enhanced search completed for ${scenicArea.name}`);
    console.log(`   📊 Found ${result.count} filtered spots (from ${result.total} total)`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error with enhanced search, falling back to basic search: ${error.message}`);
    
    // Fallback to basic search
    const searchOptions = {
      ...options,
      radius
    };
    
    try {
      const results = await searchSpots(location, searchOptions);
      
      // Save results to file if output path is provided
      if (outputPath) {
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Add scenic area info to results
        const resultsWithMeta = {
          ...results,
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
        
        return resultsWithMeta;
      }
      
      return results;
    } catch (fallbackError) {
      console.error(`❌ Error searching spots in ${scenicArea.name}: ${fallbackError.message}`);
      throw fallbackError;
    }
  }
}

/**
 * Search for spots within all scenic areas in a city
 * @param {string} cityFilePath - Path to the city file
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
export async function searchSpotsInCity(cityFilePath, options = {}) {
  console.log(`🔍 Searching for spots in all scenic areas in ${cityFilePath}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(cityFilePath)) {
      throw new Error(`City file not found: ${cityFilePath}`);
    }
    
    // Read city data
    const cityData = JSON.parse(fs.readFileSync(cityFilePath, 'utf8'));
    
    if (!cityData.scenicAreas || !Array.isArray(cityData.scenicAreas)) {
      throw new Error(`No scenic areas found in city data`);
    }
    
    console.log(`📊 Found ${cityData.scenicAreas.length} scenic areas in ${cityFilePath}`);
    
    // Set output directory
    let outputDir = options.outputDir;
    if (!outputDir) {
      const cityDir = path.dirname(cityFilePath);
      // Check if cityDir already ends with 'data' to avoid duplication
      if (cityDir.endsWith('/data') || cityDir.endsWith('\\data')) {
        outputDir = path.join(cityDir, 'spots');
      } else {
        outputDir = path.join(cityDir, 'data', 'spots');
      }
    }
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }
    
    // Search for spots in each scenic area
    const results = [];
    for (const [index, scenicArea] of cityData.scenicAreas.entries()) {
      console.log(`\n🔄 Processing scenic area ${index + 1}/${cityData.scenicAreas.length}: ${scenicArea.name}`);
      
      try {        
        // Set output file path
        const fileName = `${scenicArea.name.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '')}.json`;
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
        if (index < cityData.scenicAreas.length - 1) {
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
    
    // Save updated city data
    fs.writeFileSync(cityFilePath, JSON.stringify(cityData, null, 2));
    console.log(`\n💾 Updated city data with spots file paths: ${cityFilePath}`);
    
    return {
      status: 'success',
      cityFile: cityFilePath,
      scenicAreas: cityData.scenicAreas.length,
      results
    };
  } catch (error) {
    console.error(`❌ Error searching spots in city: ${error.message}`);
    throw error;
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  program
    .name('searchAmapSpots')
    .description('Search for spots around a location using AMap API')
    .argument('<location>', 'Location coordinates (lng,lat)')
    .argument('[radius]', 'Search radius in meters', DEFAULT_RADIUS)
    .option('-o, --output <file>', 'Output file path')
    .option('-q, --query <query>', 'Search query', DEFAULT_QUERY)
    .option('-t, --type <type>', 'Place type', DEFAULT_TYPE)
    .option('-p, --page <page>', 'Page number', DEFAULT_PAGE)
    .option('-l, --limit <limit>', 'Results per page', DEFAULT_OFFSET)
    .option('-e, --extensions <extensions>', 'Result detail level (base/all)', DEFAULT_EXTENSIONS)
    .action(async (location, radius, options) => {
      try {
        const searchOptions = {
          radius: parseInt(radius),
          query: options.query,
          type: options.type,
          page: parseInt(options.page),
          offset: parseInt(options.limit),
          extensions: options.extensions
        };
        
        const results = await searchSpots(location, searchOptions);
        
        if (options.output) {
          const outputDir = path.dirname(options.output);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
          console.log(`💾 Results saved to: ${options.output}`);
        } else {
          console.log(JSON.stringify(results, null, 2));
        }
        
        process.exit(0);
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
      }
    });

  program.parse();
}
