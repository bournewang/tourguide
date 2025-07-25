// Data service that switches between static files and API calls
import { cacheService } from './cacheService';

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
const forceStatic = import.meta.env.VITE_USE_STATIC_DATA === 'true';

// API configuration
const API_BASE = import.meta.env.VITE_WORKER_URL || 'https://worker.qingfan.org';

const DATA_PATH = '/assets/data';

// Default scenic area file
let CURRENT_SCENIC_AREA_FILE = 'scenic-area.json'; // Current format

// Static data paths (will be updated dynamically)
const getStaticPaths = () => ({
  scenicAreas: `${DATA_PATH}/${CURRENT_SCENIC_AREA_FILE}`
});

// Cache for scenic areas data to avoid repeated fetches
let _scenicAreasCache = null;

/**
 * Set the scenic area file to use (for area-level NFC validation)
 * @param {string} filename - The scenic area file name (e.g., 'scenic-area-kaifeng.json')
 */
export const setScenicAreaFile = (filename) => {
  console.log('🏞️ Setting scenic area file:', filename);
  CURRENT_SCENIC_AREA_FILE = filename;
  // Clear cache when switching files
  _scenicAreasCache = null;
  cacheService.clear();
};

/**
 * Get current scenic area file
 */
export const getCurrentScenicAreaFile = () => {
  return CURRENT_SCENIC_AREA_FILE;
};

// Determine data source based on environment
export const getDataSource = () => {
  if (forceStatic) {
    //console.log('🗂️ Using STATIC data (forced by VITE_USE_STATIC_DATA)');
    return 'static';
  }
  
  if (isDevelopment) {
    //console.log('🔧 Using API data (development mode)');
    return 'api';
  }
  
  if (isProduction) {
    //console.log('🗂️ Using STATIC data (production mode)');
    return 'static';
  }
  
  //console.log('🗂️ Using STATIC data (fallback)');
  return 'static';
};

// Data service with dual mode support
export const dataService = {
  // Get scenic areas data
  async getScenicAreas() {
    console.log('----------- getScenicAreas');
    const dataSource = getDataSource();
    const cacheKey = 'scenic_areas';
    
    // Try cache first
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      //console.log(`📋 Using cached scenic areas data (${dataSource})`);
      // Update in-memory cache as well
      _scenicAreasCache = cachedData;
      return cachedData;
    }
    
    try {
      let areaData;
      
      if (dataSource === 'static') {
        //console.log('🗂️ Fetching scenic areas from static file...');
        const response = await fetch(getStaticPaths().scenicAreas);
        
        if (!response.ok) {
          throw new Error(`Static file error (${response.status}): ${response.statusText}`);
        }
        
        const rawData = await response.json();
        
        // Handle different data formats
        if (rawData.scenicAreas && Array.isArray(rawData.scenicAreas)) {
          // New city structure format: { scenicAreas: [...] }
          areaData = rawData.scenicAreas;
          //console.log('✅ Static scenic areas loaded successfully from new city structure');
        } else if (Array.isArray(rawData)) {
          // Current format: direct array
          areaData = rawData;
          //console.log('✅ Static scenic areas loaded successfully from direct array');
        } else {
          throw new Error(`Unknown scenic areas data format: ${typeof rawData}`);
        }
      } else {
        //console.log('🌐 Fetching scenic areas from API...');
        const response = await fetch(`${API_BASE}/api/scenic-areas`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API error (${response.status}): ${errorData.error || 'Unknown error'}`);
        }
        
        areaData = await response.json();
        //console.log('✅ API scenic areas loaded successfully');
      }
      
      // Cache the result
      cacheService.set(cacheKey, areaData);
      //console.log(`💾 Scenic areas cached successfully (${dataSource})`);
      
      // Update in-memory cache as well
      _scenicAreasCache = areaData;
      
      return areaData;
    } catch (error) {
      //console.error(`Failed to get scenic areas (${dataSource}):`, error);
      throw new Error(`Failed to get scenic areas: ${error.message}`);
    }
  },

  // Get spot data for a specific area
  async getSpotData(areaName) {
    const dataSource = getDataSource();
    const cacheKey = `spots_${areaName}`;
    
    // Try cache first
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      //console.log(`📋 Using cached spot data for ${areaName} (${dataSource})`);
      return cachedData;
    }
    
    try {
      let spotData;
      
      if (dataSource === 'static') {
        //console.log(`🗂️ Fetching spot data for ${areaName} from static file...`);
        
        // Get spotfile path from scenic areas data
        const scenicAreas = await dataService.getScenicAreas();
        //console.log('scenicAreas', scenicAreas);
        const area = scenicAreas.find(area => area.name === areaName);
        if (!area) {
          throw new Error(`Area ${areaName} not found in scenic areas data`);
        }
        
        // For Kaifeng data, the spots files are in directory
        const spotFilePath = `${DATA_PATH}/${area.spotsFile}`;
        //console.log('spotFilePath', spotFilePath);
        
        const response = await fetch(spotFilePath);
        
        if (!response.ok) {
          throw new Error(`Static file error (${response.status}): ${response.statusText}`);
        }
        
        const rawData = await response.json();
        //console.log(`✅ Static spot data loaded successfully from ${spotFilePath}`);
        
        // Handle different data structures
        if (rawData.spots && Array.isArray(rawData.spots)) {
          // New city structure format: { scenicAreaId: "...", spots: [...] }
          spotData = rawData.spots;
          //console.log(`📋 Extracted ${spotData.length} spots from new city structure`);
        } else if (rawData.results && Array.isArray(rawData.results)) {
          // Kaifeng format: { results: [...] }
          spotData = rawData.results;
          //console.log(`📋 Extracted ${spotData.length} spots from results array`);
        } else if (Array.isArray(rawData)) {
          // Direct array format
          spotData = rawData;
          //console.log(`📋 Using direct array with ${spotData.length} spots`);
        } else {
          throw new Error(`Unknown spot data format: ${typeof rawData}`);
        }
        
        // Audio URLs remain as-is (/audio/xxx.mp3 format)
      } else {
        //console.log(`🌐 Fetching spot data for ${areaName} from API...`);
        const response = await fetch(`${API_BASE}/api/spots?area=${encodeURIComponent(areaName)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API error (${response.status}): ${errorData.error || 'Unknown error'}`);
        }
        
        spotData = await response.json();
        //console.log('✅ API spot data loaded successfully');
        
        // Audio URLs remain as-is (/audio/xxx.mp3 format)
      }
      
      // Cache the result
      cacheService.set(cacheKey, spotData);
      //console.log(`💾 Spot data for ${areaName} cached successfully (${dataSource})`);
        
      return spotData;
    } catch (error) {
      //console.error(`Failed to get spot data for ${areaName} (${dataSource}):`, error);
      throw new Error(`Failed to get spot data: ${error.message}`);
    }
  },

  // Check if we're in API mode (for features that require API)
  isApiMode() {
    return getDataSource() === 'api';
  },

  // Get current data source
  getCurrentDataSource() {
    return getDataSource();
  },

  // Clear cache (useful for development)
  clearCache() {
    cacheService.clear();
    // Also clear in-memory cache
    _scenicAreasCache = null;
  },

  // Get cache status
  getCacheStatus() {
    return cacheService.getStatus();
  },

  // Resolve audio URL based on current mode
  resolveAudioUrl(audioFile) {
    if (!audioFile) return null;
    
    const dataSource = getDataSource();
    
    // In development/API mode, prepend worker base URL + /api
    if (dataSource === 'api') {
      // audioFile is like "/audio/filename.mp3", we need "https://worker.qingfan.org/api/audio/filename.mp3"
      if (audioFile.startsWith('/audio/')) {
        return `${API_BASE}/api${audioFile}`;
      }
    }
    
    // In static/production mode, use as-is (served from public/audio/)
    return audioFile;
  }
};