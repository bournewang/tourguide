import BaiduCoordinateService from './baiduCoordinateService.js';
import AmapCoordinateService from './amapCoordinateService.js';
import fs from 'fs';
import process from 'process';

/**
 * Factory class for creating coordinate services
 * Supports multiple map API providers: Baidu Maps and 高德地图 (Amap)
 */
class CoordinateServiceFactory {
  /**
   * Get the configured coordinate service based on settings
   * @param {string} provider - Optional provider override ('baidu' or 'amap')
   * @returns {Object} The coordinate service instance
   */
  static getCoordinateService(provider = null) {
    // If provider is explicitly specified, use it
    if (provider) {
      return CoordinateServiceFactory.createService(provider);
    }
    
    // Otherwise, check configuration
    const configProvider = CoordinateServiceFactory.getConfiguredProvider();
    return CoordinateServiceFactory.createService(configProvider);
  }
  
  /**
   * Create a coordinate service instance for the specified provider
   * @param {string} provider - The map provider ('baidu' or 'amap')
   * @returns {Object} The coordinate service instance
   */
  static createService(provider) {
    switch (provider.toLowerCase()) {
      case 'amap':
      case '高德':
      case 'gaode':
        console.log('🗺️ Using 高德地图 (Amap) coordinate service');
        return new AmapCoordinateService();
        
      case 'baidu':
      case '百度':
        console.log('🗺️ Using Baidu Maps coordinate service');
        return new BaiduCoordinateService();
        
      default:
        console.log(`⚠️ Unknown provider "${provider}", falling back to Baidu Maps`);
        return new BaiduCoordinateService();
    }
  }
  
  /**
   * Get the configured map provider from settings
   * @returns {string} The configured provider ('baidu' or 'amap')
   */
  static getConfiguredProvider() {
    try {
      // Check if config file exists
      if (fs.existsSync('config.json')) {
        const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        if (config.mapProvider) {
          return config.mapProvider;
        }
      }
      
      // Check environment variables
      const env = process.env || {};
      if (env.MAP_PROVIDER) {
        return env.MAP_PROVIDER;
      }
      
      // Check if .env.amap exists and has a valid key
      if (fs.existsSync('.env.amap')) {
        const amapEnv = fs.readFileSync('.env.amap', 'utf8');
        if (amapEnv.includes('AMAP_API_KEY=') && !amapEnv.includes('YOUR_AMAP_KEY_HERE')) {
          return 'amap';
        }
      }
      
      // Default to Baidu if no configuration found
      return 'baidu';
    } catch (error) {
      console.error('❌ Error reading configuration:', error.message);
      return 'baidu'; // Default to Baidu on error
    }
  }
  
  /**
   * Set the default map provider in configuration
   * @param {string} provider - The map provider to set ('baidu' or 'amap')
   * @returns {boolean} Success status
   */
  static setDefaultProvider(provider) {
    try {
      const validProvider = provider.toLowerCase();
      if (validProvider !== 'baidu' && validProvider !== 'amap') {
        console.error(`❌ Invalid provider: ${provider}. Must be 'baidu' or 'amap'`);
        return false;
      }
      
      let config = {};
      if (fs.existsSync('config.json')) {
        config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
      }
      
      config.mapProvider = validProvider;
      fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
      
      console.log(`✅ Default map provider set to: ${validProvider}`);
      return true;
    } catch (error) {
      console.error('❌ Error setting default provider:', error.message);
      return false;
    }
  }
}

export default CoordinateServiceFactory;
