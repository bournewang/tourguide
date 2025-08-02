#!/usr/bin/env node

/**
 * City Manager Script
 * Manages multiple city configurations for TourGuide deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CITIES_DIR = path.join(__dirname, '../cities');
const ENV_FILE = path.join(__dirname, '../.env');
const ENV_LOCAL_FILE = path.join(__dirname, '../.env.local');
const ENV_COMMON_FILE = path.join(__dirname, '../.env.common');
// const API_KEYS_FILE = path.join(__dirname, '../config/api-keys.json');

// Load common environment variables
function loadCommonEnvVars() {
  if (!fs.existsSync(ENV_COMMON_FILE)) {
    console.warn(`⚠️  Common environment file not found: ${ENV_COMMON_FILE}`);
    return {
      VITE_BAIDU_API_KEY: 'nxCgqEZCeYebMtEi2YspKyYElw9GuCiv',
      VITE_AZURE_SPEECH_REGION: 'eastasia',
      VITE_AZURE_SPEECH_KEY: 'xxx-global',
      VITE_DASHSCOPE_API_KEY: 'sk-xxx-global',
      VITE_OPENAI_API_KEY: 'sk-xxx-global',
      EDGEONE_PAGES_API_TOKEN: ''
    };
  }
  
  const content = fs.readFileSync(ENV_COMMON_FILE, 'utf8');
  const envVars = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
      }
    }
  });
  
  return envVars;
}

// Load city configuration
function loadCityConfig(cityName) {
  const configPath = path.join(CITIES_DIR, `${cityName}.json`);
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`City configuration not found: ${cityName}`);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Set NFC baseUrl to workerUrl if not specified
  if (!config.nfc.baseUrl) {
    config.nfc.baseUrl = config.workerUrl;
  }
  
  console.log(`✅ Loaded configuration for ${config.displayName}`);
  return config;
}

// List available cities
function listCities() {
  const cities = [];
  
  if (fs.existsSync(CITIES_DIR)) {
    const files = fs.readdirSync(CITIES_DIR);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const cityName = file.replace('.json', '');
        try {
          const config = loadCityConfig(cityName);
          cities.push({
            name: cityName,
            displayName: config.displayName,
            description: config.description,
            projectName: config.projectName,
            domain: config.domain
          });
        } catch {
          console.warn(`⚠️  Invalid city config: ${file}`);
        }
      }
    });
  }
  
  return cities;
}

// Switch to a city
function switchToCity(cityName) {
  console.log(`🔄 Switching to city: ${cityName}`);
  
  const config = loadCityConfig(cityName);
  
  // Load common environment variables
  const commonEnvVars = loadCommonEnvVars();
  
  // Create .env.local file with city-specific environment variables
  const envContent = [
    `VITE_RESOURCE_BASE_URL=http://localhost:5173`,
    `VITE_WORKER_URL=${config.workerUrl}`,
    `VITE_CITY_NAME=${config.cityName || config.displayName}`,
    `VITE_BAIDU_API_KEY=${commonEnvVars.VITE_BAIDU_API_KEY}`,
    `VITE_AZURE_SPEECH_REGION=${commonEnvVars.VITE_AZURE_SPEECH_REGION}`,
    `VITE_AZURE_SPEECH_KEY=${commonEnvVars.VITE_AZURE_SPEECH_KEY}`,
    `VITE_DASHSCOPE_API_KEY=${commonEnvVars.VITE_DASHSCOPE_API_KEY}`,
    `VITE_OPENAI_API_KEY=${commonEnvVars.VITE_OPENAI_API_KEY}`
  ].join('\n');
  
  fs.writeFileSync(ENV_FILE, envContent);
  console.log(`✅ Environment variables updated for ${config.displayName}`);
  console.log(`📄 Written to: ${ENV_FILE}`);
  console.log(`📋 Content:`);
  console.log(envContent);
  
  // Update NFC configuration in functions
  updateNFCConfig(config);
  
  // Update dataService configuration
  updateDataServiceConfig(config);
  
  // Update HTML title
  updateHTMLTitle(config);
  
  // Update HTML logo
  updateHTMLLogo(config);
  
  // Update asset links
  updateAssetLinks(config);
  
  console.log(`🎯 Successfully switched to ${config.displayName}`);
  console.log(`📊 Project: ${config.projectName}`);
  console.log(`🌐 Domain: ${config.domain}`);
  console.log(`🌐 Worker URL: ${config.workerUrl}`);
  console.log(`📦 Resource URL: ${config.resourceBaseUrl}`);
  console.log(`📁 Assets: ${config.assetsPath}`);
}

// Update NFC configuration
function updateNFCConfig(config) {
  const nfcFile = path.join(__dirname, '../functions/api/nfc/validate.js');
  
  if (fs.existsSync(nfcFile)) {
    let content = fs.readFileSync(nfcFile, 'utf8');
    
    // Update secret key
    content = content.replace(
      /const SECRET_KEY = '[^']*'/,
      `const SECRET_KEY = '${config.nfc.secretKey}'`
    );
    
    // Update default scenic area file
    content = content.replace(
      /const DEFAULT_SCENIC_AREA_FILE = '[^']*'/,
      `const DEFAULT_SCENIC_AREA_FILE = '${config.scenicAreaFile}'`
    );
    
    // Update city name and description
    content = content.replace(
      /const CITY_NAME = '[^']*'/,
      `const CITY_NAME = '${config.displayName}'`
    );
    
    content = content.replace(
      /const CITY_DESCRIPTION = '[^']*'/,
      `const CITY_DESCRIPTION = '${config.description}'`
    );
    
    fs.writeFileSync(nfcFile, content);
    console.log(`✅ NFC configuration updated`);
  }
}

// Update dataService configuration
function updateDataServiceConfig(config) {
  const dataServiceFile = path.join(__dirname, '../src/utils/dataService.js');
  
  if (fs.existsSync(dataServiceFile)) {
    let content = fs.readFileSync(dataServiceFile, 'utf8');
    
    // Update default scenic area file
    content = content.replace(
      /const DEFAULT_SCENIC_AREA_FILE = '[^']*'/,
      `const DEFAULT_SCENIC_AREA_FILE = '${config.scenicAreaFile}'`
    );
    
    fs.writeFileSync(dataServiceFile, content);
    console.log(`✅ DataService configuration updated`);
  }
}

// Update HTML title
function updateHTMLTitle(config) {
  const htmlFile = path.join(__dirname, '../index.html');
  
  if (fs.existsSync(htmlFile)) {
    let content = fs.readFileSync(htmlFile, 'utf8');
    
    // Generate title based on city configuration
    const title = `${config.displayName}导游解说`;
    
    // Update title tag
    content = content.replace(
      /<title>[^<]*<\/title>/,
      `<title>${title}</title>`
    );
    
    fs.writeFileSync(htmlFile, content);
    console.log(`✅ HTML title updated to: ${title}`);
  } else {
    console.warn(`⚠️ HTML file not found: ${htmlFile}`);
  }
}

// Update HTML logo
function updateHTMLLogo(config) {
  const logosDir = path.join(__dirname, '../logos');
  const targetLogoPath = path.join(__dirname, '../public/logo.png');
  const sourceLogoPath = path.join(__dirname, '..', config.logoPath);
  
  // Create logos directory if it doesn't exist
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
    console.log(`📁 Created logos directory: ${logosDir}`);
  }
  
  // Check if city-specific logo exists
  if (fs.existsSync(sourceLogoPath)) {
    // Copy city logo to main logo.png
    fs.copyFileSync(sourceLogoPath, targetLogoPath);
    console.log(`✅ Logo updated to: ${config.logoPath}`);
  } else {
    console.warn(`⚠️ City logo not found: ${config.logoPath}`);
    console.log(`💡 Please add a logo file at: ${sourceLogoPath}`);
    
    // If no city logo, keep the existing logo.png
    if (fs.existsSync(targetLogoPath)) {
      console.log(`📋 Keeping existing logo.png`);
    } else {
      console.warn(`⚠️ No logo.png found, please add a default logo`);
    }
  }
}

// Update asset links
function updateAssetLinks(config) {
  const publicAssetsDir = path.join(__dirname, '../public/assets');
  const cityAssetsDir = path.join(__dirname, '..', config.assetsPath);
  
  // Remove existing assets link if it exists
  if (fs.existsSync(publicAssetsDir)) {
    if (fs.lstatSync(publicAssetsDir).isSymbolicLink()) {
      fs.unlinkSync(publicAssetsDir);
      console.log(`🗑️ Removed existing assets symlink`);
    } else {
      // If it's a directory, remove it
      fs.rmSync(publicAssetsDir, { recursive: true, force: true });
      console.log(`🗑️ Removed existing assets directory`);
    }
  }
  
  // Create symlink from city assets to public/assets
  if (fs.existsSync(cityAssetsDir)) {
    try {
      fs.symlinkSync(cityAssetsDir, publicAssetsDir, 'dir');
      console.log(`🔗 Created assets symlink: ${config.assetsPath} → public/assets`);
    } catch (error) {
      console.error(`❌ Failed to create assets symlink: ${error.message}`);
    }
  } else {
    console.warn(`⚠️ City assets directory not found: ${config.assetsPath}`);
    console.log(`💡 Please create the assets directory: ${cityAssetsDir}`);
  }
}

// Prepare for deployment
function prepareForDeployment(config) {
  console.log(`🔧 Preparing for deployment...`);
  
  // Update .env.local to use real resource URL
  const envFile = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envFile)) {
    let envContent = fs.readFileSync(envFile, 'utf8');
    
    // Replace localhost with real resource URL
    envContent = envContent.replace(
      /VITE_RESOURCE_BASE_URL=http:\/\/localhost:5173/,
      `VITE_RESOURCE_BASE_URL=${config.resourceBaseUrl}`
    );
    
    fs.writeFileSync(envFile, envContent);
    console.log(`✅ Updated VITE_RESOURCE_BASE_URL to: ${config.resourceBaseUrl}`);
  }
  
  // Remove assets symlink to avoid including assets in deployment
  const publicAssetsDir = path.join(__dirname, '../public/assets');
  if (fs.existsSync(publicAssetsDir)) {
    if (fs.lstatSync(publicAssetsDir).isSymbolicLink()) {
      fs.unlinkSync(publicAssetsDir);
      console.log(`🗑️ Removed assets symlink for deployment`);
    }
  }
}

// Restore development setup
function restoreDevelopmentSetup(config) {
  console.log(`🔄 Restoring development setup...`);
  
  // Update .env.local back to localhost
  const envFile = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envFile)) {
    let envContent = fs.readFileSync(envFile, 'utf8');
    
    // Replace real resource URL with localhost
    envContent = envContent.replace(
      /VITE_RESOURCE_BASE_URL=https?:\/\/[^/\s]+/,
      'VITE_RESOURCE_BASE_URL=http://localhost:5173'
    );
    
    fs.writeFileSync(envFile, envContent);
    console.log(`✅ Restored VITE_RESOURCE_BASE_URL to: http://localhost:5173`);
  }
  
  // Recreate assets symlink for development
  updateAssetLinks(config);
}

// Deploy city
async function deployCity(cityName) {
  console.log(`🚀 Deploying city: ${cityName}`);
  
  const config = loadCityConfig(cityName);
  
  // Switch to city first
  switchToCity(cityName);
  
  // Prepare for deployment
  prepareForDeployment(config);
  
  // Run deployment
  console.log(`📦 Building and deploying ${config.displayName}...`);
  
  // Execute deployment command
  const { execSync } = await import('child_process');
  try {
    execSync(`./deploy.sh ${config.projectName}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log(`✅ Successfully deployed ${config.displayName} to ${config.projectName}`);
    
    // Restore development setup after deployment
    restoreDevelopmentSetup(config);
  } catch (error) {
    console.error(`❌ Deployment failed: ${error.message}`);
    // Restore development setup even if deployment fails
    restoreDevelopmentSetup(config);
    process.exit(1);
  }
}

// Show current city
function showCurrentCity() {
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const lines = envContent.split('\n');
    
    let currentCity = 'Unknown';
    let domain = 'Unknown';
    
    lines.forEach(line => {
      if (line.startsWith('VITE_WORKER_URL=')) {
        const url = line.split('=')[1];
        // Extract city from URL
        if (url.includes('df.qingfan.wang')) {
          currentCity = 'dengfeng';
          domain = 'df.qingfan.wang';
        } else if (url.includes('kf.qingfan.wang')) {
          currentCity = 'kaifeng';
          domain = 'kf.qingfan.wang';
        } else if (url.includes('preview.qingfan.wang')) {
          currentCity = 'preview';
          domain = 'preview.qingfan.wang';
        }
      }
    });
    
    console.log(`📍 Current city: ${currentCity}`);
    console.log(`🌐 Domain: ${domain}`);
    
    // Show current HTML title
    const htmlFile = path.join(__dirname, '../index.html');
    if (fs.existsSync(htmlFile)) {
      const htmlContent = fs.readFileSync(htmlFile, 'utf8');
      const titleMatch = htmlContent.match(/<title>([^<]*)<\/title>/);
      if (titleMatch) {
        console.log(`📄 HTML title: ${titleMatch[1]}`);
      }
    }
    
    // Show current logo
    const logoFile = path.join(__dirname, '../public/logo.png');
    if (fs.existsSync(logoFile)) {
      const stats = fs.statSync(logoFile);
      console.log(`🖼️ Current logo: logo.png (${(stats.size / 1024).toFixed(1)}KB)`);
    } else {
      console.log(`🖼️ No logo.png found`);
    }
    
    // Show current assets link
    const assetsLink = path.join(__dirname, '../public/assets');
    if (fs.existsSync(assetsLink)) {
      if (fs.lstatSync(assetsLink).isSymbolicLink()) {
        const target = fs.readlinkSync(assetsLink);
        console.log(`🔗 Assets link: public/assets → ${target}`);
      } else {
        console.log(`📁 Assets: public/assets (directory)`);
      }
    } else {
      console.log(`❌ No assets link found`);
    }
  } else {
    console.log(`📍 No city currently selected`);
  }
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'list': {
      console.log('🏙️  Available cities:');
      const cities = listCities();
      cities.forEach(city => {
        console.log(`  • ${city.name} (${city.displayName})`);
        console.log(`    Project: ${city.projectName}`);
        console.log(`    Domain: ${city.domain}`);
        console.log('');
      });
      break;
    }
      
    case 'switch':
      if (!args[1]) {
        console.error('❌ Please specify a city name');
        console.error('Usage: node city-manager.js switch <city-name>');
        console.error('Example: node city-manager.js switch dengfeng');
        process.exit(1);
      }
      switchToCity(args[1]);
      break;
      
    case 'deploy':
      if (!args[1]) {
        console.error('❌ Please specify a city name');
        console.error('Usage: node city-manager.js deploy <city-name>');
        console.error('Example: node city-manager.js deploy dengfeng');
        process.exit(1);
      }
      deployCity(args[1]);
      break;
      
    case 'current':
      showCurrentCity();
      break;
      
    default:
      console.log('🏙️  City Manager for TourGuide');
      console.log('');
      console.log('Usage:');
      console.log('  node city-manager.js list                    - List available cities');
      console.log('  node city-manager.js switch <city-name>      - Switch to a city');
      console.log('  node city-manager.js deploy <city-name>      - Deploy a city');
      console.log('  node city-manager.js current                 - Show current city');
      console.log('');
      console.log('Examples:');
      console.log('  node city-manager.js switch dengfeng');
      console.log('  node city-manager.js deploy kaifeng');
      break;
  }
}

main(); 