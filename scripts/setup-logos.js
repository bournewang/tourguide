#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup logos directory and copy current logo as template
function setupLogos() {
  console.log('🖼️ Setting up logo structure...');
  
  const logosDir = path.join(__dirname, '../logos');
  const currentLogo = path.join(__dirname, '../public/logo.png');
  
  // Create logos directory
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
    console.log(`✅ Created logos directory: ${logosDir}`);
  }
  
  // Copy current logo as template for cities
  if (fs.existsSync(currentLogo)) {
    const cities = ['dengfeng', 'kaifeng', 'preview'];
    
    cities.forEach(city => {
      const cityLogoPath = path.join(logosDir, `${city}.png`);
      if (!fs.existsSync(cityLogoPath)) {
        fs.copyFileSync(currentLogo, cityLogoPath);
        console.log(`📋 Created template logo for ${city}: ${cityLogoPath}`);
      } else {
        console.log(`📋 Logo already exists for ${city}: ${cityLogoPath}`);
      }
    });
    
    console.log('\n🎨 Logo setup complete!');
    console.log('💡 You can now customize each city logo by replacing the files in logos/');
    console.log('📁 Files created:');
    cities.forEach(city => {
      console.log(`   • logos/${city}.png`);
    });
  } else {
    console.error('❌ Current logo.png not found!');
    console.log('💡 Please add a logo.png file to public/ directory first');
  }
}

setupLogos(); 