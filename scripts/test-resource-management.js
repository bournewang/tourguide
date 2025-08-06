#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test resource management system
function testResourceManagement() {
  console.log('🧪 Testing resource management system...');
  
  const envFile = path.join(__dirname, '..', '.env.local');
  const publicAssetsDir = path.join(__dirname, '../public/assets');
  
  // Test 1: Check environment file
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    const resourceUrlMatch = envContent.match(/VITE_RESOURCE_BASE_URL=(.+)/);
    
    if (resourceUrlMatch) {
      const resourceUrl = resourceUrlMatch[1];
      console.log(`✅ VITE_RESOURCE_BASE_URL: ${resourceUrl}`);
      
      if (resourceUrl === 'http://localhost:5173') {
        console.log('📋 Mode: Development (localhost)');
      } else if (resourceUrl.includes('qingfan.wang')) {
        console.log('📋 Mode: Production (remote)');
      } else {
        console.log('⚠️ Mode: Unknown URL format');
      }
    } else {
      console.log('❌ VITE_RESOURCE_BASE_URL not found in .env.local');
    }
  } else {
    console.log('❌ .env.local file not found');
  }
  
  // Test 2: Check assets symlink
  if (fs.existsSync(publicAssetsDir)) {
    if (fs.lstatSync(publicAssetsDir).isSymbolicLink()) {
      const target = fs.readlinkSync(publicAssetsDir);
      console.log(`✅ Assets symlink: public/assets → ${target}`);
      
      // Check if target exists
      if (fs.existsSync(target)) {
        console.log('✅ Symlink target exists');
      } else {
        console.log('❌ Symlink target missing');
      }
    } else {
      console.log('📁 Assets: public/assets (directory, not symlink)');
    }
  } else {
    console.log('❌ public/assets not found');
  }
  
  // Test 3: Check province/city assets directories
  const locations = [
    { province: 'henan', city: 'dengfeng' },
    { province: 'henan', city: 'kaifeng' }
  ];
  console.log('\n📁 Checking city assets directories:');

  locations.forEach(({ province, city }) => {
    const dir = path.join(__dirname, '..', 'assets', province, city);
    if (fs.existsSync(dir)) {
      console.log(`✅ assets/${province}/${city}/ exists`);
    } else {
      console.log(`❌ assets/${province}/${city}/ missing`);
    }
  });
  
  // Test 4: Simulate deployment workflow
  console.log('\n🔄 Simulating deployment workflow...');
  
  // Check current state
  const currentEnv = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const hasSymlink = fs.existsSync(publicAssetsDir) && fs.lstatSync(publicAssetsDir).isSymbolicLink();
  
  console.log(`📋 Current state:`);
  console.log(`   • Environment: ${currentEnv.includes('localhost') ? 'Development' : 'Production'}`);
  console.log(`   • Assets symlink: ${hasSymlink ? 'Exists' : 'Missing'}`);
  
  // Simulate deployment preparation
  console.log(`\n🔧 Would prepare for deployment:`);
  console.log(`   • Update VITE_RESOURCE_BASE_URL to production URL`);
  console.log(`   • Remove assets symlink`);
  
  // Simulate deployment restoration
  console.log(`\n🔄 Would restore after deployment:`);
  console.log(`   • Set VITE_RESOURCE_BASE_URL back to localhost`);
  console.log(`   • Recreate assets symlink`);
  
  console.log('\n🎯 Resource management test complete!');
}

testResourceManagement(); 