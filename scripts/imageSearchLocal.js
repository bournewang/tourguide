import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const IMAGE_DIR = path.join(__dirname, '../public/images');
const TEMP_IMAGE_DIR = path.join(__dirname, '../temp_images');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to ask user input
function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

// Check if image exists
function imageExists(filename) {
    const filepath = path.join(IMAGE_DIR, filename);
    return fs.existsSync(filepath);
}

// Copy image from temp directory
function copyImage(sourcePath, destFilename) {
    try {
        const destPath = path.join(IMAGE_DIR, destFilename);
        fs.copyFileSync(sourcePath, destPath);
        return true;
    } catch (error) {
        console.error(`❌ Failed to copy image: ${error.message}`);
        return false;
    }
}

// List available images in temp directory
function listTempImages() {
    if (!fs.existsSync(TEMP_IMAGE_DIR)) {
        console.log('📁 Creating temp_images directory...');
        fs.mkdirSync(TEMP_IMAGE_DIR, { recursive: true });
        console.log('✅ Created temp_images directory');
        console.log('📝 Please place your images in the temp_images directory');
        console.log(`📍 Path: ${TEMP_IMAGE_DIR}`);
        return [];
    }
    
    const files = fs.readdirSync(TEMP_IMAGE_DIR)
        .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
    
    return files;
}

// Main function
async function main() {
    try {
        // Load spots data
        const spotsDataPath = path.join(__dirname, '../src/data/spots-shaolinsi.json');
        const spotsData = JSON.parse(fs.readFileSync(spotsDataPath, 'utf8'));
        
        console.log(`📖 Loaded ${spotsData.length} spots`);
        
        // Create images directory if it doesn't exist
        if (!fs.existsSync(IMAGE_DIR)) {
            fs.mkdirSync(IMAGE_DIR, { recursive: true });
        }
        
        // Check temp images
        const tempImages = listTempImages();
        
        if (tempImages.length === 0) {
            console.log('\n📋 No images found in temp_images directory');
            console.log('📝 Please add some images and run the script again');
            console.log(`📍 Expected path: ${TEMP_IMAGE_DIR}`);
            process.exit(0);
        }
        
        console.log(`\n📸 Found ${tempImages.length} images in temp directory:`);
        tempImages.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file}`);
        });
        
        let processedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < spotsData.length; i++) {
            const spot = spotsData[i];
            
            console.log(`\n📍 Processing ${i + 1}/${spotsData.length}: ${spot.name}`);
            
            // Check if image already exists
            const safeName = spot.name.replace(/[^\w\u4e00-\u9fff]/g, '_').replace(/_+/g, '_');
            const expectedFilename = `${safeName}.jpg`;
            
            if (imageExists(expectedFilename)) {
                console.log(`✅ Image already exists: ${expectedFilename}`);
                processedCount++;
                continue;
            }
            
            // Show available images
            console.log('\n📸 Available images:');
            tempImages.forEach((file, index) => {
                console.log(`  ${index + 1}. ${file}`);
            });
            console.log('  0. Skip this spot');
            
            // Get user selection
            const answer = await askQuestion('\n👉 Select image (1-' + tempImages.length + ', or 0 to skip): ');
            const selection = parseInt(answer);
            
            if (selection === 0) {
                console.log('⏭️  Skipped');
                skippedCount++;
                continue;
            } else if (selection >= 1 && selection <= tempImages.length) {
                const selectedImage = tempImages[selection - 1];
                const sourcePath = path.join(TEMP_IMAGE_DIR, selectedImage);
                
                console.log(`📋 Copying: ${selectedImage} -> ${expectedFilename}`);
                
                if (copyImage(sourcePath, expectedFilename)) {
                    // Update spot data
                    spot.image_thumb = `/images/${expectedFilename}`;
                    processedCount++;
                    console.log(`✅ Successfully added image: ${spot.image_thumb}`);
                } else {
                    skippedCount++;
                }
            } else {
                console.log('❌ Invalid selection, skipping...');
                skippedCount++;
            }
            
            // Save progress every 10 spots
            if ((i + 1) % 10 === 0) {
                fs.writeFileSync(spotsDataPath, JSON.stringify(spotsData, null, 2), 'utf8');
                console.log(`💾 Progress saved (${i + 1}/${spotsData.length})`);
            }
        }
        
        // Final save
        fs.writeFileSync(spotsDataPath, JSON.stringify(spotsData, null, 2), 'utf8');
        
        console.log(`\n🎉 Image assignment completed!`);
        console.log(`✅ Successfully processed: ${processedCount} spots`);
        console.log(`⏭️  Skipped: ${skippedCount} spots`);
        console.log(`💾 Updated: spots-shaolinsi.json`);
        
        // Ask if user wants to clean up temp directory
        const cleanup = await askQuestion('\n🧹 Clean up temp_images directory? (y/n): ');
        if (cleanup.toLowerCase() === 'y' || cleanup.toLowerCase() === 'yes') {
            if (fs.existsSync(TEMP_IMAGE_DIR)) {
                fs.rmSync(TEMP_IMAGE_DIR, { recursive: true, force: true });
                console.log('✅ Cleaned up temp_images directory');
            }
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the script
main(); 