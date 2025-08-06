// Data service that switches between static files and API calls
import { cacheService } from './cacheService';

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
const forceStatic = import.meta.env.VITE_USE_STATIC_DATA === 'true';

// API configuration
const API_BASE = import.meta.env.VITE_WORKER_URL || 'https://worker.qingfan.org';

// Location configuration for multi-province/city support
const PROVINCE_NAME = import.meta.env.VITE_PROVINCE_NAME || '';
const CITY_NAME = import.meta.env.VITE_CITY_NAME || '';
const CITY_ASSETS_BASE = `/assets/${PROVINCE_NAME}/${CITY_NAME}`;
const DATA_PATH = `${CITY_ASSETS_BASE}/data`;

// Resource base URL for static assets
const RESOURCE_BASE_URL = import.meta.env.VITE_RESOURCE_BASE_URL || '';

// Static data paths scoped to current province/city
const getStaticPaths = () => ({
  scenicAreas: `${RESOURCE_BASE_URL}${DATA_PATH}/scenic-area.json`
});

// Cache for scenic areas data to avoid repeated fetches
let _scenicAreasCache = null;

// Determine data source based on environment
export const getDataSource = () => {
  if (isDevelopment) {
    //console.log('🔧 Using API data (development mode)');
    return 'api';
  }
    
  if (forceStatic) {
    //console.log('🗂️ Using STATIC data (forced by VITE_USE_STATIC_DATA)');
    return 'static';
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
    
    // Try cache first (for fetched boundaries)
    const fetchedBoundariesData = cacheService.get('scenic_areas_fetched');
    if (fetchedBoundariesData) {
      console.log('📋 Using scenic areas from cache (fetched boundaries):', fetchedBoundariesData.length, 'areas');
      // Update in-memory cache as well
      _scenicAreasCache = fetchedBoundariesData;
      return fetchedBoundariesData;
    }
    
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
      
      // Ensure each area has a display field (default to 'show' if not present)
      areaData = areaData.map(area => ({
        ...area,
        display: area.display || 'show'
      }));
      
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

  // Get visible scenic areas (filtered by display status)
  async getVisibleScenicAreas() {
    const allAreas = await this.getScenicAreas();
    return allAreas.filter(area => area.display !== 'hide');
  },

  // Convert resolved URL back to relative path for storage
  getRelativePath(resolvedUrl) {
    if (!resolvedUrl) return '';
    
    console.log('Converting to relative path:', { resolvedUrl, RESOURCE_BASE_URL });
    
    // If it's already a relative path, return as is
    if (!resolvedUrl.startsWith('http')) {
      return resolvedUrl;
    }
    
    // Remove the resource base URL prefix
    if (RESOURCE_BASE_URL && resolvedUrl.startsWith(RESOURCE_BASE_URL)) {
      const relativePath = resolvedUrl.substring(RESOURCE_BASE_URL.length);
      // Remove leading slash if present
      return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    }
    
    // If no resource base URL or doesn't match, return the original
    return resolvedUrl;
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
        const spotFilePath = `${RESOURCE_BASE_URL}${DATA_PATH}/${area.spotsFile}`;
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

    // In development/API mode, prepend worker base URL
    if (dataSource === 'api') {
      if (audioFile.startsWith('/assets/')) {
        return `${API_BASE}${audioFile}`;
      }
    }

    // In static/production mode, serve from resource base
    if (dataSource === 'static') {
      if (audioFile.startsWith('/')) {
        return `${RESOURCE_BASE_URL}${audioFile}`;
      }
    }

    // Fallback to original path
    return audioFile;
  },

  // Resolve image URL based on current mode
  resolveImageUrl(imagePath) {
    if (!imagePath) return null;
    
    console.log('Resolving image URL:', { imagePath, RESOURCE_BASE_URL, dataSource: getDataSource() });
    
    // const dataSource = getDataSource();
    // if (dataSource === 'static') {
      // If it's already a full URL, return as is
      if (imagePath.startsWith('http')) {
        console.log('Already a full URL, returning as is');
        return imagePath;
      }
      
      // If it starts with /, prepend RESOURCE_BASE_URL
      if (imagePath.startsWith('/')) {
        const resolvedUrl = `${RESOURCE_BASE_URL}${imagePath}`;
        console.log('Resolved URL (starts with /):', resolvedUrl);
        return resolvedUrl;
      }
      
      // If it doesn't start with /, assume it's a relative path and prepend RESOURCE_BASE_URL + /
      if (RESOURCE_BASE_URL) {
        const resolvedUrl = `${RESOURCE_BASE_URL}/${imagePath}`;
        console.log('Resolved URL (relative path):', resolvedUrl);
        return resolvedUrl;
      }
    // }
    
    console.log('Returning original path (not static mode or no RESOURCE_BASE_URL):', imagePath);
    return imagePath;
  },

  // Resolve thumb URL based on current mode
  resolveThumbUrl(thumbPath) {
    if (!thumbPath) return null;
    // const dataSource = getDataSource();
    // if (dataSource === 'static') {
      if (thumbPath.startsWith('/')) {
        return `${RESOURCE_BASE_URL}${thumbPath}`;
      }
    // }
    return thumbPath;
  },

  // Update scenic areas data (for fetched boundaries)
  updateScenicAreas(updatedAreas) {
    const success = cacheService.set('scenic_areas_fetched', updatedAreas);
    if (success) {
      console.log('💾 Updated scenic areas in cache:', updatedAreas.length, 'areas');
      
      // Also update in-memory cache
      _scenicAreasCache = updatedAreas;
    } else {
      console.error('Failed to update scenic areas in cache');
    }
    return success;
  },

  // Clear fetched scenic areas (restore original)
  clearFetchedScenicAreas() {
    cacheService.clear('scenic_areas_fetched');
    console.log('🗑️ Cleared fetched scenic areas from cache');
    
    // Clear in-memory cache to force reload from original source
    _scenicAreasCache = null;
    
    return true;
  }
};