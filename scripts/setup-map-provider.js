import fs from 'fs';
import process from 'process';
import CoordinateServiceFactory from '../services/coordinateServiceFactory.js';

/**
 * Script to set up and manage map provider configuration
 * Supports switching between Baidu Maps and 高德地图 (Amap)
 */
async function setupMapProvider() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'set':
      if (args.length < 2) {
        console.error('❌ Missing provider argument. Use "baidu" or "amap"');
        showHelp();
        return;
      }
      await setProvider(args[1]);
      break;
      
    case 'get':
      await getProvider();
      break;
      
    case 'check-keys':
      await checkApiKeys();
      break;
      
    case 'create-config':
      await createConfigFile();
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      showHelp();
  }
}

function showHelp() {
  console.log('Map Provider Setup Utility');
  console.log('=========================');
  console.log('');
  console.log('Commands:');
  console.log('  set <provider>    Set the default map provider (baidu or amap)');
  console.log('  get               Show the current default map provider');
  console.log('  check-keys        Check if API keys are configured for both providers');
  console.log('  create-config     Create a default config.json file');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/setup-map-provider.js set baidu');
  console.log('  node scripts/setup-map-provider.js set amap');
  console.log('  node scripts/setup-map-provider.js get');
  console.log('  node scripts/setup-map-provider.js check-keys');
}

async function setProvider(provider) {
  const validProvider = provider.toLowerCase();
  if (validProvider !== 'baidu' && validProvider !== 'amap') {
    console.error(`❌ Invalid provider: ${provider}. Must be 'baidu' or 'amap'`);
    return;
  }
  
  const success = await CoordinateServiceFactory.setDefaultProvider(validProvider);
  
  if (success) {
    console.log(`✅ Default map provider set to: ${validProvider}`);
    
    // Check if API key is configured
    if (validProvider === 'baidu') {
      checkBaiduApiKey();
    } else {
      checkAmapApiKey();
    }
  } else {
    console.error('❌ Failed to set default map provider');
  }
}

async function getProvider() {
  const provider = CoordinateServiceFactory.getConfiguredProvider();
  console.log(`🗺️ Current default map provider: ${provider}`);
  
  // Check if config file exists
  if (fs.existsSync('config.json')) {
    const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    console.log(`📄 Configuration file: ${JSON.stringify(config, null, 2)}`);
  } else {
    console.log('⚠️ No config.json file found. Using fallback configuration.');
  }
  
  // Check if the current provider's API key is configured
  if (provider === 'baidu') {
    checkBaiduApiKey();
  } else {
    checkAmapApiKey();
  }
}

async function checkApiKeys() {
  console.log('🔑 Checking API keys configuration...');
  
  const baiduKeyStatus = checkBaiduApiKey(false);
  const amapKeyStatus = checkAmapApiKey(false);
  
  console.log('\n📊 API Keys Summary:');
  console.log(`   Baidu Maps: ${baiduKeyStatus ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   高德地图 (Amap): ${amapKeyStatus ? '✅ Configured' : '❌ Not configured'}`);
  
  // Provide guidance based on the status
  if (!baiduKeyStatus && !amapKeyStatus) {
    console.log('\n⚠️ No API keys configured. Please set up at least one provider:');
    console.log('   - For Baidu Maps: See BAIDU_API_SETUP_GUIDE.md');
    console.log('   - For 高德地图: See AMAP_API_SETUP_GUIDE.md');
  } else if (baiduKeyStatus && !amapKeyStatus) {
    console.log('\n✅ Baidu Maps is configured and can be used.');
    console.log('   To set up 高德地图 as an alternative, see AMAP_API_SETUP_GUIDE.md');
  } else if (!baiduKeyStatus && amapKeyStatus) {
    console.log('\n✅ 高德地图 (Amap) is configured and can be used.');
    console.log('   To set up Baidu Maps as an alternative, see BAIDU_API_SETUP_GUIDE.md');
  } else {
    console.log('\n✅ Both map providers are configured! You can switch between them:');
    console.log('   - Set default: node scripts/setup-map-provider.js set [baidu|amap]');
    console.log('   - Or specify when running: --provider [baidu|amap]');
  }
}

function checkBaiduApiKey(verbose = true) {
  if (verbose) console.log('\n🔍 Checking Baidu Maps API key...');
  
  try {
    if (fs.existsSync('.env.baidu')) {
      const content = fs.readFileSync('.env.baidu', 'utf8');
      const keyMatch = content.match(/export\s+BAIDU_API_KEY=([^\s#]+)/);
      
      if (keyMatch && keyMatch[1] && keyMatch[1] !== 'YOUR_BAIDU_API_KEY_HERE') {
        if (verbose) {
          console.log('✅ Baidu Maps API key is configured');
          console.log(`   Key: ${keyMatch[1].substring(0, 4)}...${keyMatch[1].substring(keyMatch[1].length - 4)}`);
        }
        return true;
      } else {
        if (verbose) console.log('❌ Baidu Maps API key is not properly configured in .env.baidu');
        return false;
      }
    } else {
      if (verbose) console.log('❌ .env.baidu file not found');
      return false;
    }
  } catch (error) {
    if (verbose) console.error('❌ Error checking Baidu API key:', error.message);
    return false;
  }
}

function checkAmapApiKey(verbose = true) {
  if (verbose) console.log('\n🔍 Checking 高德地图 (Amap) API key...');
  
  try {
    if (fs.existsSync('.env.amap')) {
      const content = fs.readFileSync('.env.amap', 'utf8');
      const keyMatch = content.match(/export\s+AMAP_API_KEY=([^\s#]+)/);
      
      if (keyMatch && keyMatch[1] && keyMatch[1] !== 'YOUR_AMAP_KEY_HERE') {
        if (verbose) {
          console.log('✅ 高德地图 API key is configured');
          console.log(`   Key: ${keyMatch[1].substring(0, 4)}...${keyMatch[1].substring(keyMatch[1].length - 4)}`);
        }
        return true;
      } else {
        if (verbose) console.log('❌ 高德地图 API key is not properly configured in .env.amap');
        return false;
      }
    } else {
      if (verbose) console.log('❌ .env.amap file not found');
      return false;
    }
  } catch (error) {
    if (verbose) console.error('❌ Error checking Amap API key:', error.message);
    return false;
  }
}

async function createConfigFile() {
  try {
    // Check if config file already exists
    if (fs.existsSync('config.json')) {
      console.log('⚠️ config.json already exists. Do you want to overwrite it? (y/n)');
      // In a real interactive environment, we would wait for user input
      // Since we can't do that here, we'll just warn and proceed
      console.log('⚠️ Proceeding with overwrite...');
    }
    
    // Determine which provider to use as default based on API key availability
    const baiduKeyConfigured = checkBaiduApiKey(false);
    const amapKeyConfigured = checkAmapApiKey(false);
    
    let defaultProvider = 'baidu'; // Default fallback
    
    if (baiduKeyConfigured && !amapKeyConfigured) {
      defaultProvider = 'baidu';
    } else if (!baiduKeyConfigured && amapKeyConfigured) {
      defaultProvider = 'amap';
    } else if (baiduKeyConfigured && amapKeyConfigured) {
      // Both are configured, prefer Amap as it's the newer addition
      defaultProvider = 'amap';
    }
    
    // Create basic config
    const config = {
      mapProvider: defaultProvider,
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    };
    
    // Write config file
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    
    console.log('✅ Created config.json with the following settings:');
    console.log(JSON.stringify(config, null, 2));
    
    // Check API keys status
    await checkApiKeys();
    
  } catch (error) {
    console.error('❌ Error creating config file:', error.message);
  }
}

// Run the script
setupMapProvider().catch(error => {
  console.error('❌ Script failed with error:', error);
});
