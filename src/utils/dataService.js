// Data service that switches between static files and API calls
import { cacheService } from './cacheService';

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
const forceStatic = import.meta.env.VITE_USE_STATIC_DATA === 'true';

// API configuration
const API_BASE = import.meta.env.VITE_WORKER_URL || 'https://worker.qingfan.org';

// Static data paths
const STATIC_PATHS = {
  scenicAreas: '/data/scenic-area.json'
};

// Cache for scenic areas data to avoid repeated fetches
let scenicAreasCache = null;

// Helper to get spot file name from area name using scenic-areas.json
async function getSpotFileName(areaName) {
  try {
    console.log('-----------getSpotFileName', areaName);
    // Get scenic areas data (with caching) - respect static/API mode
    if (!scenicAreasCache) {
      const dataSource = getDataSource();

      console.log('dataSource', dataSource);
      
      if (dataSource === 'static') {
        console.log('STATIC_PATHS.scenicAreas', STATIC_PATHS.scenicAreas);
        const response = await fetch(STATIC_PATHS.scenicAreas);
        if (response.ok) {
          scenicAreasCache = await response.json();
        }
      } else {
        console.log('fetch ', `${API_BASE}/api/scenic-areas`);
        const response = await fetch(`${API_BASE}/api/scenic-areas`);
        if (response.ok) {
          scenicAreasCache = await response.json();
        }
      }
    }
    
    if (scenicAreasCache) {
      const area = scenicAreasCache.find(area => area.name === areaName);
      if (area && area.spotsFile) {
        // Extract filename from spotsFile path (e.g., "spots/shaolinsi.json" -> "shaolinsi.json")
        return area.spotsFile.replace('spots/', '');
      }
    }
    
    // Fallback to area name if not found
    console.warn(`No spotsFile found for area: ${areaName}, using fallback`);
    return `${areaName}.json`;
  } catch (error) {
    console.error('Error getting spot file name:', error);
    return `${areaName}.json`;
  }
}

// Determine data source based on environment
export const getDataSource = () => {
  if (forceStatic) {
    console.log('🗂️ Using STATIC data (forced by VITE_USE_STATIC_DATA)');
    return 'static';
  }
  
  if (isDevelopment) {
    console.log('🔧 Using API data (development mode)');
    return 'api';
  }
  
  if (isProduction) {
    console.log('🗂️ Using STATIC data (production mode)');
    return 'static';
  }
  
  console.log('🗂️ Using STATIC data (fallback)');
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
      console.log(`📋 Using cached scenic areas data (${dataSource})`);
      // Update in-memory cache as well
      scenicAreasCache = cachedData;
      return cachedData;
    }
    
    try {
      let areaData;
      
      if (dataSource === 'static') {
        console.log('🗂️ Fetching scenic areas from static file...');
        const response = await fetch(STATIC_PATHS.scenicAreas);
        
        if (!response.ok) {
          throw new Error(`Static file error (${response.status}): ${response.statusText}`);
        }
        
        areaData = await response.json();
        console.log('✅ Static scenic areas loaded successfully');
      } else {
        console.log('🌐 Fetching scenic areas from API...');
        const response = await fetch(`${API_BASE}/api/scenic-areas`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API error (${response.status}): ${errorData.error || 'Unknown error'}`);
        }
        
        areaData = await response.json();
        console.log('✅ API scenic areas loaded successfully');
      }
      
      // Cache the result
      cacheService.set(cacheKey, areaData);
      console.log(`💾 Scenic areas cached successfully (${dataSource})`);
      
      // Update in-memory cache as well
      scenicAreasCache = areaData;
      
      return areaData;
    } catch (error) {
      console.error(`Failed to get scenic areas (${dataSource}):`, error);
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
      console.log(`📋 Using cached spot data for ${areaName} (${dataSource})`);
      return cachedData;
    }
    
    try {
      let spotData;
      
      if (dataSource === 'static') {
        console.log(`🗂️ Fetching spot data for ${areaName} from static file...`);
        
        // Get the correct filename from scenic-areas.json
        const spotFileName = await getSpotFileName(areaName);
        const spotFilePath = `/data/spots/${spotFileName}`;
        
        const response = await fetch(spotFilePath);
        
        if (!response.ok) {
          throw new Error(`Static file error (${response.status}): ${response.statusText}`);
        }
        
        spotData = await response.json();
        console.log(`✅ Static spot data loaded successfully from ${spotFileName}`);
        
        // Audio URLs remain as-is (/audio/xxx.mp3 format)
      } else {
        console.log(`🌐 Fetching spot data for ${areaName} from API...`);
        const response = await fetch(`${API_BASE}/api/spots?area=${encodeURIComponent(areaName)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API error (${response.status}): ${errorData.error || 'Unknown error'}`);
        }
        
        spotData = await response.json();
        console.log('✅ API spot data loaded successfully');
        
        // Audio URLs remain as-is (/audio/xxx.mp3 format)
      }
      
      // Cache the result
      cacheService.set(cacheKey, spotData);
      console.log(`💾 Spot data for ${areaName} cached successfully (${dataSource})`);
        
      return spotData;
    } catch (error) {
      console.error(`Failed to get spot data for ${areaName} (${dataSource}):`, error);
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
    scenicAreasCache = null;
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