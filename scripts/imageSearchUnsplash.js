import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import https from 'https';
import http from 'http';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const UNSPLASH_API_URL = 'https://api.unsplash.com/search/photos';
const IMAGES_PER_SPOT = 5;
const MIN_FILE_SIZE = 10 * 1024; // 10KB
const MAX_FILE_SIZE = 500 * 1024; // 500KB
const IMAGE_DIR = path.join(__dirname, '../public/images');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        
        const req = client.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, data });
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => req.destroy());
        req.end();
    });
}

// Search images using Unsplash API
async function searchImages(query, accessKey) {
    try {
        const searchUrl = `${UNSPLASH_API_URL}?query=${encodeURIComponent(query)}&per_page=${IMAGES_PER_SPOT}&orientation=landscape`;
        
        const response = await makeRequest(searchUrl, {
            headers: {
                'Authorization': `Client-ID ${accessKey}`
            }
        });
        
        const result = JSON.parse(response.data);
        
        if (!result.results || result.results.length === 0) {
            throw new Error('No images found');
        }
        
        // Transform Unsplash results to match our format
        const images = result.results.map(img => ({
            name: img.description || img.alt_description || 'Untitled',
            contentUrl: img.urls.regular,
            thumbnailUrl: img.urls.thumb,
            width: img.width,
            height: img.height,
            contentSize: 0, // Unsplash doesn't provide file size
            photographer: img.user.name,
            downloadUrl: img.links.download
        }));
        
        return images.slice(0, IMAGES_PER_SPOT);
        
    } catch (error) {
        console.error(`❌ Search failed for "${query}":`, error.message);
        return [];
    }
}

// Download image
async function downloadImage(url, filepath) {
    try {
        const response = await makeRequest(url);
        fs.writeFileSync(filepath, response.data);
        return true;
    } catch (error) {
        console.error(`❌ Download failed for ${url}:`, error.message);
        return false;
    }
}

// Get file size
function getFileSize(filepath) {
    try {
        const stats = fs.statSync(filepath);
        return stats.size;
    } catch {
        return 0;
    }
}

// Display images and get user selection
async function selectImage(spot, images) {
    console.log(`\n🎯 Selecting image for: ${spot.name}`);
    console.log(`🔍 Search query: "${spot.name} temple"`);
    
    if (images.length === 0) {
        console.log('❌ No suitable images found');
        return null;
    }
    
    console.log('\n📸 Available images:');
    images.forEach((img, index) => {
        console.log(`\n  ${index + 1}. ${img.name}`);
        console.log(`     📸 Photographer: ${img.photographer}`);
        console.log(`     📏 Size: ${img.width}x${img.height}`);
        console.log(`     🌐 URL: ${img.contentUrl}`);
        if (img.thumbnailUrl) {
            console.log(`     🖼️  Thumbnail: ${img.thumbnailUrl}`);
        }
    });
    console.log('\n  0. Skip this spot');
    
    return new Promise((resolve) => {
        rl.question('\n👉 Select image (1-5, or 0 to skip): ', (answer) => {
            const selection = parseInt(answer);
            if (selection === 0) {
                resolve(null);
            } else if (selection >= 1 && selection <= images.length) {
                resolve(images[selection - 1]);
            } else {
                console.log('❌ Invalid selection, skipping...');
                resolve(null);
            }
        });
    });
}

// Main function
async function main() {
    try {
        // Check for API key
        const accessKey = process.env.UNSPLASH_ACCESS_KEY;
        if (!accessKey) {
            console.error('❌ Please set your Unsplash API key:');
            console.log('export UNSPLASH_ACCESS_KEY="your-access-key"');
            console.log('\n📝 To get an Unsplash API key:');
            console.log('1. Go to https://unsplash.com/developers');
            console.log('2. Create an account and register your application');
            console.log('3. Get your Access Key');
            process.exit(1);
        }
        
        // Load spots data
        const spotsDataPath = path.join(__dirname, '../src/data/spots-shaolinsi.json');
        const spotsData = JSON.parse(fs.readFileSync(spotsDataPath, 'utf8'));
        
        console.log(`📖 Loaded ${spotsData.length} spots`);
        
        // Create images directory if it doesn't exist
        if (!fs.existsSync(IMAGE_DIR)) {
            fs.mkdirSync(IMAGE_DIR, { recursive: true });
        }
        
        let processedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < spotsData.length; i++) {
            const spot = spotsData[i];
            
            console.log(`\n📍 Processing ${i + 1}/${spotsData.length}: ${spot.name}`);
            
            // Search for images (use English terms for better results)
            const searchQuery = `${spot.name} temple china`;
            const images = await searchImages(searchQuery, accessKey);
            
            // Let user select image
            const selectedImage = await selectImage(spot, images);
            
            if (selectedImage) {
                // Create safe filename
                const safeName = spot.name.replace(/[^\w\u4e00-\u9fff]/g, '_').replace(/_+/g, '_');
                const filename = `${safeName}.jpg`;
                const filepath = path.join(IMAGE_DIR, filename);
                
                // Download image
                console.log(`⬇️  Downloading: ${filename}`);
                const downloadSuccess = await downloadImage(selectedImage.contentUrl, filepath);
                
                if (downloadSuccess) {
                    // Verify file size
                    const fileSize = getFileSize(filepath);
                    if (fileSize >= MIN_FILE_SIZE && fileSize <= MAX_FILE_SIZE) {
                        // Update spot data
                        spot.image_thumb = `/images/${filename}`;
                        processedCount++;
                        console.log(`✅ Successfully added image: ${spot.image_thumb}`);
                    } else {
                        console.log(`❌ Downloaded file size (${Math.round(fileSize / 1024)}KB) is outside acceptable range`);
                        fs.unlinkSync(filepath); // Remove invalid file
                        skippedCount++;
                    }
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }
            
            // Save progress every 10 spots
            if ((i + 1) % 10 === 0) {
                fs.writeFileSync(spotsDataPath, JSON.stringify(spotsData, null, 2), 'utf8');
                console.log(`💾 Progress saved (${i + 1}/${spotsData.length})`);
            }
            
            // Rate limiting - Unsplash has limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Final save
        fs.writeFileSync(spotsDataPath, JSON.stringify(spotsData, null, 2), 'utf8');
        
        console.log(`\n🎉 Image search completed!`);
        console.log(`✅ Successfully processed: ${processedCount} spots`);
        console.log(`⏭️  Skipped: ${skippedCount} spots`);
        console.log(`💾 Updated: spots-shaolinsi.json`);
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the script
main(); 