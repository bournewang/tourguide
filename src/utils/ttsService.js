// TTS Service utility for calling Cloudflare Worker backend
import { cacheService } from './cacheService';
import { dataService } from './dataService';

// API configuration for TTS-specific features
const API_BASE = import.meta.env.VITE_WORKER_URL || 'https://worker.qingfan.org';

export const ttsService = {
  // Main TTS generation function - Only available in API mode
  async generateAudio(text, options = {}) {
    if (!dataService.isApiMode()) {
      throw new Error('TTS generation is only available in development mode');
    }

    const {
      voice = 'xiaoxiao',
      rate = '-10%',
      pitch = '0%',
      spotName = 'narration',
      areaName = 'default'
    } = options;

    if (!text.trim()) {
      throw new Error('No text provided for TTS generation');
    }

    try {
      const response = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice,
          rate,
          pitch,
          spotName,
          areaName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TTS API error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      
      console.log(`✅ TTS generation successful`);
      console.log(`📊 Audio size: ${result.fileSizeKB} KB`);
      console.log(`⏱️  Text length: ${result.textLength} characters`);
      console.log(`🎵 Voice: ${result.voice}`);
      console.log(`⚡ Rate: ${result.rate}`);
      console.log(`🎶 Pitch: ${result.pitch}`);
      console.log(`🌐 Audio URL: ${result.audioFile}`);

      return {
        success: true,
        audioFile: `${API_BASE}${result.audioFile}`,
        fileName: result.fileName,
        audioVersion: result.audioVersion,
        fileSizeKB: result.fileSizeKB,
        textLength: result.textLength,
        voice: result.voice,
        rate: result.rate,
        pitch: result.pitch
      };

    } catch (error) {
      console.error('TTS generation failed:', error);
      throw new Error(`TTS generation failed: ${error.message}`);
    }
  },

  // Validate device access for NFC authentication
  async validateDeviceAccess(uid, deviceFingerprint, maxDevices = 3) {
    try {
      const response = await fetch(`${API_BASE}/api/nfc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          deviceFingerprint,
          maxDevices
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('❌ Device access validation failed:', data);
        return {
          success: false,
          error: data.error,
          deviceCount: data.deviceCount,
          maxDevices: data.maxDevices
        };
      }

      console.log('✅ Device access granted:', data);
      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('Device validation API error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Generate narration using QWen AI - Only available in API mode
  async generateNarration(spotInfo, customPrompt = '') {
    if (!dataService.isApiMode()) {
      throw new Error('AI narration generation is only available in development mode');
    }

    if (!spotInfo || !spotInfo.name) {
      throw new Error('Missing spot information');
    }

    try {
      const response = await fetch(`${API_BASE}/api/narration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spotInfo,
          customPrompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Narration API error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      
      console.log(`✅ Narration generation successful`);
      console.log(`📝 Generated text length: ${result.narration?.length || 0} characters`);

      return {
        success: true,
        narration: result.narration
      };

    } catch (error) {
      console.error('Narration generation failed:', error);
      throw new Error(`Narration generation failed: ${error.message}`);
    }
  },

  // Get spot data - Uses dataService for dual mode support
  async getSpotData(areaName) {
    return dataService.getSpotData(areaName);
  },

  // Get scenic areas - Uses dataService for dual mode support
  async getScenicAreas() {
    return dataService.getScenicAreas();
  },

  // Update spot data - Only available in API mode
  async updateSpotData(areaName, spotData) {
    if (!dataService.isApiMode()) {
      throw new Error('Spot data updates are only available in development mode');
    }

    try {
      const response = await fetch(`${API_BASE}/api/spots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          areaName,
          spotData
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Update spot data API error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      
      // Invalidate cache for this area since data has changed
      const cacheKey = `spots_${areaName}`;
      cacheService.clear(cacheKey);
      console.log(`🗑️ Cache invalidated for ${areaName} after bulk update`);
      
      return result;

    } catch (error) {
      console.error('Failed to update spot data:', error);
      throw new Error(`Failed to update spot data: ${error.message}`);
    }
  },

  // Update single spot - Only available in API mode
  async updateSingleSpot(areaName, spotName, spotUpdate) {
    if (!dataService.isApiMode()) {
      throw new Error('Single spot updates are only available in development mode');
    }

    try {
      const response = await fetch(`${API_BASE}/api/spots`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          areaName,
          spotName,
          spotUpdate
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Update single spot API error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      
      // Invalidate cache for this area since data has changed
      const cacheKey = `spots_${areaName}`;
      cacheService.clear(cacheKey);
      console.log(`🗑️ Cache invalidated for ${areaName} after single spot update`);
      
      return result;

    } catch (error) {
      console.error('Failed to update single spot:', error);
      throw new Error(`Failed to update single spot: ${error.message}`);
    }
  },

  // Update scenic areas - Only available in API mode
  async updateScenicAreas(areaData) {
    if (!dataService.isApiMode()) {
      throw new Error('Scenic area updates are only available in development mode');
    }

    try {
      const response = await fetch(`${API_BASE}/api/scenic-areas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          areaData
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Update scenic areas API error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      
      // Invalidate cache since data has changed
      const cacheKey = 'scenic_areas';
      cacheService.clear(cacheKey);
      console.log(`🗑️ Cache invalidated for scenic areas after update`);
      
      return result;

    } catch (error) {
      console.error('Failed to update scenic areas:', error);
      throw new Error(`Failed to update scenic areas: ${error.message}`);
    }
  },

  // Clear cache
  clearCache() {
    return dataService.clearCache();
  },

  // Get cache status
  getCacheStatus() {
    return dataService.getCacheStatus();
  },

  // Clear expired cache entries
  clearExpiredCache() {
    return cacheService.clearExpired();
  },

  // Check if API features are available
  isApiMode() {
    return dataService.isApiMode();
  },

  // Get current data source
  getCurrentDataSource() {
    return dataService.getCurrentDataSource();
  }
}; 