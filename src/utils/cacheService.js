// Cache service for localStorage with expiration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const CACHE_PREFIX = 'tourguide_';

export const cacheService = {
  // Get cached data if not expired
  get(key) {
    try {
      const cacheKey = CACHE_PREFIX + key;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        console.log(`🗄️ Cache miss: ${key}`);
        return null;
      }
      
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      if (now - timestamp > CACHE_DURATION) {
        console.log(`⏰ Cache expired: ${key} (${Math.round((now - timestamp) / 1000 / 60)} minutes old)`);
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      console.log(`✅ Cache hit: ${key} (${Math.round((now - timestamp) / 1000 / 60)} minutes old)`);
      return data;
    } catch (error) {
      console.error(`❌ Cache get error for ${key}:`, error);
      return null;
    }
  },

  // Set cached data with timestamp
  set(key, data) {
    try {
      const cacheKey = CACHE_PREFIX + key;
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`💾 Cache set: ${key} (${JSON.stringify(cacheData).length} bytes)`);
      return true;
    } catch (error) {
      console.error(`❌ Cache set error for ${key}:`, error);
      // Handle quota exceeded or other localStorage errors
      if (error.name === 'QuotaExceededError') {
        console.warn('🚨 localStorage quota exceeded, clearing old cache');
        this.clearExpired();
        // Try again after clearing
        try {
          const retryKey = CACHE_PREFIX + key;
          const retryData = {
            data,
            timestamp: Date.now()
          };
          localStorage.setItem(retryKey, JSON.stringify(retryData));
          return true;
        } catch (retryError) {
          console.error('❌ Cache set failed even after clearing:', retryError);
        }
      }
      return false;
    }
  },

  // Clear specific cache entry
  clear(key) {
    try {
      const cacheKey = CACHE_PREFIX + key;
      localStorage.removeItem(cacheKey);
      console.log(`🗑️ Cache cleared: ${key}`);
    } catch (error) {
      console.error(`❌ Cache clear error for ${key}:`, error);
    }
  },

  // Clear all tourguide cache entries
  clearAll() {
    try {
      const keys = Object.keys(localStorage);
      const tourguideKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      
      tourguideKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log(`🧹 Cleared ${tourguideKeys.length} cache entries`);
    } catch (error) {
      console.error('❌ Cache clear all error:', error);
    }
  },

  // Clear expired cache entries
  clearExpired() {
    try {
      const keys = Object.keys(localStorage);
      const tourguideKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      const now = Date.now();
      let clearedCount = 0;
      
      tourguideKeys.forEach(key => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            if (now - timestamp > CACHE_DURATION) {
              localStorage.removeItem(key);
              clearedCount++;
            }
          }
        } catch (parseError) {
          // If we can't parse the cached data, remove it
          console.warn(`🗑️ Removing corrupted cache entry: ${key}`, parseError);
          localStorage.removeItem(key);
          clearedCount++;
        }
      });
      
      if (clearedCount > 0) {
        console.log(`🧹 Cleared ${clearedCount} expired cache entries`);
      }
    } catch (error) {
      console.error('❌ Cache clear expired error:', error);
    }
  },

  // Get cache status for debugging
  getStatus() {
    try {
      const keys = Object.keys(localStorage);
      const tourguideKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      const now = Date.now();
      
      const status = {
        totalEntries: tourguideKeys.length,
        validEntries: 0,
        expiredEntries: 0,
        totalSize: 0,
        entries: []
      };
      
      tourguideKeys.forEach(key => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            const age = now - timestamp;
            const isExpired = age > CACHE_DURATION;
            
            status.totalSize += cached.length;
            if (isExpired) {
              status.expiredEntries++;
            } else {
              status.validEntries++;
            }
            
            status.entries.push({
              key: key.replace(CACHE_PREFIX, ''),
              age: Math.round(age / 1000 / 60), // minutes
              size: cached.length,
              expired: isExpired
            });
          }
                  } catch (parseError) {
            console.warn(`🗑️ Corrupted cache entry in status: ${key}`, parseError);
            status.expiredEntries++;
            status.entries.push({
              key: key.replace(CACHE_PREFIX, ''),
              age: -1,
              size: 0,
              expired: true,
              error: true
            });
          }
      });
      
      return status;
    } catch (error) {
      console.error('❌ Cache status error:', error);
      return null;
    }
  }
}; 