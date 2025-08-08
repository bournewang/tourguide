// Data service that switches between static files and API calls
import { cacheService } from './cacheService';
import locations from '../data/locations.json';

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
const forceStatic = import.meta.env.VITE_USE_STATIC_DATA === 'true';

// API configuration
const API_BASE = import.meta.env.VITE_WORKER_URL || 'https://worker.qingfan.org';

const DATA_PATH_PREFIX = '/assets';

// Resource base URL for static assets
const RESOURCE_BASE_URL = import.meta.env.VITE_RESOURCE_BASE_URL || '';

// Helper to find province for a city
const getProvinceIdForCity = (cityId) => {
  for (const province of locations) {
    if (province.cities.some(city => city.id === cityId)) {
      return province.province_id;
    }
  }
  return null;
};




// Static data paths (now dynamic based on city and province)
const getStaticPaths = (cityId) => {
  const provinceId = getProvinceIdForCity(cityId);
  if (!provinceId) {
    console.error(`Could not find province for city: ${cityId}`);
    return { scenicAreas: '', spotsBasePath: '', assetsBasePath: '' };
  }
  const assetsBasePath = `${RESOURCE_BASE_URL}${DATA_PATH_PREFIX}/${provinceId}/${cityId}`;
  return {
    scenicAreas: `${assetsBasePath}/data/scenic-area.json`,
    spotsBasePath: `${assetsBasePath}/data/`,
    assetsBasePath: assetsBasePath
  };
};

// Centralized function to resolve any asset path
const resolveAssetPath = (cityId, relativePath) => {
  if (!relativePath) return null;
  if (relativePath.startsWith('http')) return relativePath;

  const { assetsBasePath } = getStaticPaths(cityId);
  if (!assetsBasePath) return null;

  // Ensure we don't have double slashes
  return relativePath.startsWith('/') 
    ? `${assetsBasePath}${relativePath}` 
    : `${assetsBasePath}/${relativePath}`;
};


// Cache for scenic areas data to avoid repeated fetches
const _scenicAreasCache = {};

// Determine data source based on environment
export const getDataSource = () => {
  // if (isDevelopment) {
  //   return 'api';
  // }
    
  if (forceStatic) {
    return 'static';
  }
  
  if (isProduction) {
    return 'static';
  }
  
  return 'static';
};

// Data service with dual mode support
export const dataService = {
  // Get scenic areas data for a specific city
  async getScenicAreas(cityId) {
    console.log(`----------- getScenicAreas for ${cityId}`);
    if (!cityId) {
      throw new Error('cityId is required to get scenic areas');
    }

    const dataSource = getDataSource();
    const cacheKey = `scenic_areas_${cityId}`;
    
    // Try in-memory cache first
    if (_scenicAreasCache[cityId]) {
      return _scenicAreasCache[cityId];
    }

    // Try persistent cache next
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      _scenicAreasCache[cityId] = cachedData;
      return cachedData;
    }
    
    try {
      let areaData;
      
      if (dataSource === 'static') {
        const staticPaths = getStaticPaths(cityId);
        if (!staticPaths.scenicAreas) throw new Error(`Could not determine path for ${cityId}`);
        
        const response = await fetch(staticPaths.scenicAreas);
        
        if (!response.ok) {
          throw new Error(`Static file error (${response.status}): ${response.statusText} for ${staticPaths.scenicAreas}`);
        }
        
        const rawData = await response.json();
        
        if (rawData.scenicAreas && Array.isArray(rawData.scenicAreas)) {
          areaData = rawData.scenicAreas;
        } else if (Array.isArray(rawData)) {
          areaData = rawData;
        } else {
          throw new Error(`Unknown scenic areas data format: ${typeof rawData}`);
        }
      } else {
        const response = await fetch(`${API_BASE}/api/scenic-areas?city=${cityId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API error (${response.status}): ${errorData.error || 'Unknown error'}`);
        }
        
        areaData = await response.json();
      }
      
      areaData = areaData.map(area => ({
        ...area,
        display: area.display || 'show'
      }));
      
      cacheService.set(cacheKey, areaData);
      _scenicAreasCache[cityId] = areaData;
      
      return areaData;
    } catch (error) {
      throw new Error(`Failed to get scenic areas for ${cityId}: ${error.message}`);
    }
  },

  // Get visible scenic areas (filtered by display status)
  async getVisibleScenicAreas(cityId) {
    const allAreas = await this.getScenicAreas(cityId);
    return allAreas.filter(area => area.display !== 'hide');
  },

  async updateScenicArea(cityId, areaName, spotData) {
    if (!cityId) {
      throw new Error('cityId is required to get spot data');
    }
    // const dataSource = getDataSource();
    const cacheKey = `spots_${cityId}_${areaName}`;
    console.log(`Updating spot data for ${areaName} in ${cityId}, key`, cacheKey);
    
    cacheService.set(cacheKey, spotData);
  },

  async updateSpotData(cityId, areaName, spotId, updatedData) {
    if (!cityId || !areaName || !spotId) {
      throw new Error('cityId, areaName and spotId are required to update spot data')
    }
    const cacheKey = `spots_${cityId}_${areaName}`;
    const cachedData = cacheService.get(cacheKey);
    if (!cachedData) {
      throw new Error(`No cached data found for ${areaName} in ${cityId}`);
    }
    const updatedSpots = cachedData.map(spot => 
      spot.name === spotId ? { ...spot, ...updatedData } : spot
    );
    cacheService.set(cacheKey, updatedSpots);
  },

  // Get spot data for a specific area in a specific city
  async getScenicArea(cityId, areaName) {
    if (!cityId) {
      throw new Error('cityId is required to get spot data');
    }
    const dataSource = getDataSource();
    const cacheKey = `spots_${cityId}_${areaName}`;
    
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    try {
      let spotData;
      
      if (dataSource === 'static') {
        const scenicAreas = await dataService.getScenicAreas(cityId);
        const area = scenicAreas.find(area => area.name === areaName);
        if (!area) {
          throw new Error(`Area ${areaName} not found in scenic areas data for ${cityId}`);
        }
        
        const staticPaths = getStaticPaths(cityId);
        const spotFilePath = `${staticPaths.spotsBasePath}${area.spotsFile}`;
        
        const response = await fetch(spotFilePath);
        
        if (!response.ok) {
          throw new Error(`Static file error (${response.status}): ${response.statusText}`);
        }
        
        const rawData = await response.json();
        
        if (rawData.spots && Array.isArray(rawData.spots)) {
          spotData = rawData.spots;
        } else if (rawData.results && Array.isArray(rawData.results)) {
          spotData = rawData.results;
        } else if (Array.isArray(rawData)) {
          spotData = rawData;
        } else {
          throw new Error(`Unknown spot data format: ${typeof rawData}`);
        }
      } else {
        const response = await fetch(`${API_BASE}/api/spots?city=${cityId}&area=${encodeURIComponent(areaName)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API error (${response.status}): ${errorData.error || 'Unknown error'}`);
        }
        
        spotData = await response.json();
      }
      
      cacheService.set(cacheKey, spotData);
        
      return spotData;
    } catch (error) {
      throw new Error(`Failed to get spot data for ${areaName}: ${error.message}`);
    }
  },

  isApiMode() {
    return getDataSource() === 'api';
  },

  getCurrentDataSource() {
    return getDataSource();
  },

  clearCache() {
    cacheService.clear();
    Object.keys(_scenicAreasCache).forEach(key => delete _scenicAreasCache[key]);
  },

  getCacheStatus() {
    return cacheService.getStatus();
  },

  resolveAudioUrl(cityId, audioFile) {
    return resolveAssetPath(cityId, audioFile);
  },

  resolveImageUrl(cityId, imagePath) {
    return resolveAssetPath(cityId, imagePath);
  },

  resolveThumbUrl(cityId, thumbPath) {
    return resolveAssetPath(cityId, thumbPath);
  },

  updateScenicAreas(cityId, updatedAreas) {
    const cacheKey = `scenic_areas_fetched_${cityId}`;
    const success = cacheService.set(cacheKey, updatedAreas);
    if (success) {
      _scenicAreasCache[cityId] = updatedAreas;
    }
    return success;
  },

  clearFetchedScenicAreas(cityId) {
    const cacheKey = `scenic_areas_fetched_${cityId}`;
    cacheService.clear(cacheKey);
    if (_scenicAreasCache[cityId]) {
      delete _scenicAreasCache[cityId];
    }
    return true;
  }
};