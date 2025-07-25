import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const sourceDir = path.join(__dirname, '../tmp/organized-spots-images');
const targetBaseDir = path.join(__dirname, '../tmp/scenic-area-organized');
const scenicAreaFile = path.join(__dirname, '../public/data/scenic-area.json');

// Ensure target directory exists
if (!fs.existsSync(targetBaseDir)) {
  fs.mkdirSync(targetBaseDir, { recursive: true });
}

// Load scenic area data
function loadScenicAreaData() {
  try {
    const data = fs.readFileSync(scenicAreaFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading scenic area data:', error.message);
    return [];
  }
}

// Load spots data for a specific scenic area
function loadSpotsData(spotsFile) {
  try {
    const filePath = path.join(__dirname, '../public/data', spotsFile);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error loading spots data from ${spotsFile}:`, error.message);
    return [];
  }
}

// Create mapping of spot names to scenic areas
function createSpotToScenicAreaMapping() {
  const scenicAreas = loadScenicAreaData();
  const mapping = {};

  scenicAreas.forEach(scenicArea => {
    const spotsData = loadSpotsData(scenicArea.spotsFile);
    spotsData.forEach(spot => {
      // Map the spot name to the scenic area name
      mapping[spot.name] = scenicArea.name;
    });
  });

  return mapping;
}

function organizeByScenicArea() {
  console.log('🎯 Starting scenic area organization...');
  console.log(`📁 Source directory: ${sourceDir}`);
  console.log(`📁 Target directory: ${targetBaseDir}`);

  // Check if source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Source directory does not exist: ${sourceDir}`);
    return;
  }

  // Create spot to scenic area mapping
  const spotToScenicArea = createSpotToScenicAreaMapping();
  console.log(`📋 Created mapping for ${Object.keys(spotToScenicArea).length} spots`);

  // Read all spot folders in the source directory
  const spotFolders = fs.readdirSync(sourceDir).filter(item => {
    const itemPath = path.join(sourceDir, item);
    return fs.statSync(itemPath).isDirectory();
  });

  console.log(`📸 Found ${spotFolders.length} spot folders`);

  let processedCount = 0;
  let errorCount = 0;
  let unmappedCount = 0;

  spotFolders.forEach(spotFolder => {
    try {
      const scenicAreaName = spotToScenicArea[spotFolder];
      
      if (!scenicAreaName) {
        console.warn(`⚠️  No scenic area found for spot: ${spotFolder}`);
        unmappedCount++;
        return;
      }

      // Create scenic area directory
      const scenicAreaDir = path.join(targetBaseDir, scenicAreaName);
      if (!fs.existsSync(scenicAreaDir)) {
        fs.mkdirSync(scenicAreaDir, { recursive: true });
        console.log(`📁 Created scenic area directory: ${scenicAreaName}`);
      }

      // Move the spot folder to the scenic area directory
      const sourceSpotPath = path.join(sourceDir, spotFolder);
      const targetSpotPath = path.join(scenicAreaDir, spotFolder);

      // Copy the entire spot folder
      fs.cpSync(sourceSpotPath, targetSpotPath, { recursive: true });
      console.log(`✅ Moved: ${spotFolder} -> ${scenicAreaName}/${spotFolder}`);
      processedCount++;

    } catch (error) {
      console.error(`❌ Error processing ${spotFolder}:`, error.message);
      errorCount++;
    }
  });

  console.log('\n📊 Summary:');
  console.log(`✅ Successfully processed: ${processedCount} folders`);
  console.log(`⚠️  Unmapped spots: ${unmappedCount} folders`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} folders`);
  }
  console.log(`📁 Organized images are in: ${targetBaseDir}`);

  // Show unmapped spots for reference
  if (unmappedCount > 0) {
    console.log('\n🔍 Unmapped spots:');
    spotFolders.forEach(spotFolder => {
      if (!spotToScenicArea[spotFolder]) {
        console.log(`   - ${spotFolder}`);
      }
    });
  }
}

// Run the script
organizeByScenicArea(); 