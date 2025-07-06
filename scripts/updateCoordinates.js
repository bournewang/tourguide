// Script to update shaolin.json with new coordinates
// Usage: node scripts/updateCoordinates.js coordinates_file.json

import fs from 'fs';

function updateCoordinates(coordinatesFile) {
  try {
    // Read the coordinates file
    const coordinatesData = JSON.parse(fs.readFileSync(coordinatesFile, 'utf8'));
    
    // Read the current shaolin.json
    const shaolinData = JSON.parse(fs.readFileSync('src/shaolin.json', 'utf8'));
    
    console.log('📊 Updating coordinates in shaolin.json...\n');
    
    let updatedCount = 0;
    
    // Update coordinates for each spot
    shaolinData.forEach(spot => {
      const coordData = coordinatesData.find(coord => 
        coord.name === spot.name || 
        coord.name.includes(spot.name) || 
        spot.name.includes(coord.name)
      );
      
      if (coordData) {
        const oldLat = spot.latitude;
        const oldLng = spot.longitude;
        
        spot.latitude = coordData.latitude;
        spot.longitude = coordData.longitude;
        
        console.log(`✅ Updated ${spot.name}:`);
        console.log(`   Old: ${oldLat}, ${oldLng}`);
        console.log(`   New: ${coordData.latitude}, ${coordData.longitude}`);
        
        // Calculate distance difference (rough estimate)
        const latDiff = Math.abs(oldLat - coordData.latitude);
        const lngDiff = Math.abs(oldLng - coordData.longitude);
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000; // rough meters
        
        if (distance > 100) {
          console.log(`   📏 Distance change: ~${Math.round(distance)}m`);
        }
        console.log('');
        
        updatedCount++;
      } else {
        console.log(`⚠️  No coordinates found for: ${spot.name}`);
      }
    });
    
    // Backup original file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const backupFile = `src/shaolin_backup_${timestamp}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(shaolinData, null, 2), 'utf8');
    console.log(`💾 Original file backed up to: ${backupFile}`);
    
    // Write updated file
    fs.writeFileSync('src/shaolin.json', JSON.stringify(shaolinData, null, 2), 'utf8');
    
    console.log(`\n✅ Updated ${updatedCount}/${shaolinData.length} spots in shaolin.json`);
    console.log('🎉 Coordinates update complete!');
    
  } catch (error) {
    console.error('❌ Error updating coordinates:', error.message);
  }
}

// Get command line arguments
const args = typeof process !== 'undefined' ? process.argv.slice(2) : [];

if (args.length === 0) {
  console.log('🔧 Coordinate Update Tool');
  console.log('Usage: node scripts/updateCoordinates.js <coordinates_file.json>');
  console.log('');
  console.log('Example:');
  console.log('1. Run: node scripts/baiduCoordinates.js');
  console.log('2. Run: node scripts/updateCoordinates.js coordinates_baidu_2025-07-02T04-32-17.json');
  console.log('');
  console.log('Available coordinate files:');
  
  // List available coordinate files
  try {
    const files = fs.readdirSync('.')
      .filter(file => file.startsWith('coordinates_') && file.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
    
    if (files.length > 0) {
      files.forEach(file => {
        console.log(`  - ${file}`);
      });
    } else {
      console.log('  No coordinate files found. Run a coordinate fetching script first.');
    }
  } catch (error) {
    console.log('  Could not list files.');
  }
} else {
  const coordinatesFile = args[0];
  
  // Check if file exists
  if (!fs.existsSync(coordinatesFile)) {
    console.error(`❌ File not found: ${coordinatesFile}`);
    console.log('Available files:');
    try {
      const files = fs.readdirSync('.')
        .filter(file => file.startsWith('coordinates_') && file.endsWith('.json'));
      files.forEach(file => console.log(`  - ${file}`));
    } catch (error) {
      console.log('  Could not list files.');
    }
  } else {
    updateCoordinates(coordinatesFile);
  }
}

// Export function for use
export { updateCoordinates }; 