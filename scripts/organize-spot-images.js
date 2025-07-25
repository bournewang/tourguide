import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const sourceDir = path.join(__dirname, '../tmp/spots-images');
const targetBaseDir = path.join(__dirname, '../tmp/organized-spots-images');

// Ensure target directory exists
if (!fs.existsSync(targetBaseDir)) {
  fs.mkdirSync(targetBaseDir, { recursive: true });
}

function organizeSpotImages() {
  console.log('🎯 Starting spot image organization...');
  console.log(`📁 Source directory: ${sourceDir}`);
  console.log(`📁 Target directory: ${targetBaseDir}`);

  // Check if source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Source directory does not exist: ${sourceDir}`);
    return;
  }

  // Read all files in the source directory
  const files = fs.readdirSync(sourceDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });

  console.log(`📸 Found ${imageFiles.length} image files`);

  let processedCount = 0;
  let errorCount = 0;

  imageFiles.forEach(file => {
    try {
      // Parse the filename to extract spot name and number
      // Format: "三佛殿-1.jpg" -> spotName: "三佛殿", number: "1"
      const nameWithoutExt = path.parse(file).name; // "三佛殿-1"
      const ext = path.parse(file).ext; // ".jpg"
      
      // Split by the last dash to separate spot name from number
      const lastDashIndex = nameWithoutExt.lastIndexOf('-');
      if (lastDashIndex === -1) {
        console.warn(`⚠️  Skipping file with unexpected format: ${file}`);
        return;
      }

      const spotName = nameWithoutExt.substring(0, lastDashIndex); // "三佛殿"
      const number = nameWithoutExt.substring(lastDashIndex + 1); // "1"
      
      // Create spot directory
      const spotDir = path.join(targetBaseDir, spotName);
      if (!fs.existsSync(spotDir)) {
        fs.mkdirSync(spotDir, { recursive: true });
        console.log(`📁 Created directory: ${spotName}`);
      }

      // Create new filename
      const newFileName = `${number}${ext}`; // "1.jpg"
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(spotDir, newFileName);

      // Move the file
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ Moved: ${file} -> ${spotName}/${newFileName}`);
      processedCount++;

    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
      errorCount++;
    }
  });

  console.log('\n📊 Summary:');
  console.log(`✅ Successfully processed: ${processedCount} files`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} files`);
  }
  console.log(`📁 Organized images are in: ${targetBaseDir}`);
}

// Run the script
organizeSpotImages(); 