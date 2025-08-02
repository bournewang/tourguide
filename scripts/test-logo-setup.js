#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test logo setup and city switching
function testLogoSetup() {
  console.log('🧪 Testing logo setup...');
  
  const logosDir = path.join(__dirname, '../logos');
  const publicLogo = path.join(__dirname, '../public/logo.png');
  
  // Test 1: Check if logos directory exists
  if (fs.existsSync(logosDir)) {
    console.log('✅ Logos directory exists');
  } else {
    console.log('❌ Logos directory missing - run: node scripts/setup-logos.js');
    return;
  }
  
  // Test 2: Check if city logos exist
  const cities = ['dengfeng', 'kaifeng', 'preview'];
  let allLogosExist = true;
  
  cities.forEach(city => {
    const cityLogo = path.join(logosDir, `${city}.png`);
    if (fs.existsSync(cityLogo)) {
      const stats = fs.statSync(cityLogo);
      console.log(`✅ ${city}.png exists (${(stats.size / 1024).toFixed(1)}KB)`);
    } else {
      console.log(`❌ ${city}.png missing`);
      allLogosExist = false;
    }
  });
  
  // Test 3: Check if public logo exists
  if (fs.existsSync(publicLogo)) {
    const stats = fs.statSync(publicLogo);
    console.log(`✅ public/logo.png exists (${(stats.size / 1024).toFixed(1)}KB)`);
  } else {
    console.log('❌ public/logo.png missing');
  }
  
  // Test 4: Test city switching simulation
  console.log('\n🔄 Testing city switching simulation...');
  cities.forEach(city => {
    const cityLogo = path.join(logosDir, `${city}.png`);
    if (fs.existsSync(cityLogo)) {
      // Simulate copying (without actually doing it)
      console.log(`📋 Would copy ${city}.png → public/logo.png`);
    }
  });
  
  console.log('\n🎯 Logo setup test complete!');
  if (allLogosExist) {
    console.log('✅ All city logos are ready for switching');
  } else {
    console.log('⚠️ Some logos missing - run: node scripts/setup-logos.js');
  }
}

testLogoSetup(); 