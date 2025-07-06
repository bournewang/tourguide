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
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...options.headers
            }
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
        
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// Simulate Baidu image search results
async function searchBaiduImages(query) {
    try {
        console.log(`🔍 Searching Baidu for: ${query}`);
        
        // Create realistic search results for Shaolin Temple spots
        const searchTerms = [
            `${query} 少林寺`,
            `${query} 寺庙`,
            `${query} 古建筑`,
            `${query} 佛教`,
            `${query} 旅游`
        ];
        
        return searchTerms.map((term, index) => ({
            name: `${query} - 百度图片 ${index + 1}`,
            contentUrl: `https://via.placeholder.com/800x600/4a90e2/ffffff?text=${encodeURIComponent(term)}`,
            thumbnailUrl: `https://via.placeholder.com/200x150/4a90e2/ffffff?text=${encodeURIComponent(term)}`,
            width: 800,
            height: 600,
            contentSize: (150 + index * 10) * 1024,
            source: 'Baidu Images'
        }));
        
    } catch {
        console.error(`❌ Baidu search failed for "${query}"`);
        return [];
    }
}

// Download image
async function downloadImage(url, filepath) {
    try {
        const response = await makeRequest(url);
        fs.writeFileSync(filepath, response.data);
        return true;
    } catch {
        console.error(`❌ Download failed for ${url}`);
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
    console.log(`🔍 Search query: "${spot.name} 少林寺"`);
    
    if (images.length === 0) {
        console.log('❌ No suitable images found');
        return null;
    }
    
    console.log('\n📸 Available images:');
    images.forEach((img, index) => {
        const size = img.contentSize ? `${Math.round(img.contentSize / 1024)}KB` : 'Unknown';
        console.log(`\n  ${index + 1}. ${img.name}`);
        console.log(`     📏 Size: ${img.width}x${img.height} (${size})`);
        console.log(`     🌐 Source: ${img.source}`);
        console.log(`     🌐 URL: ${img.contentUrl}`);
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
        console.log('🚀 Baidu Image Search Tool for Shaolin Temple');
        console.log('📝 This tool helps you find and assign images to tour spots');
        console.log('⚠️  Note: This is a demonstration version with placeholder images');
        console.log('💡 For real Baidu images, you would need to implement web scraping or API integration\n');
        
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
            
            // Search for images
            const searchQuery = `${spot.name} 少林寺`;
            const images = await searchBaiduImages(searchQuery);
            
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
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Final save
        fs.writeFileSync(spotsDataPath, JSON.stringify(spotsData, null, 2), 'utf8');
        
        console.log(`\n🎉 Image search completed!`);
        console.log(`✅ Successfully processed: ${processedCount} spots`);
        console.log(`⏭️  Skipped: ${skippedCount} spots`);
        console.log(`💾 Updated: spots-shaolinsi.json`);
        
        console.log('\n📋 Next steps:');
        console.log('1. Replace placeholder images with real Baidu images');
        console.log('2. Implement actual Baidu API integration if needed');
        console.log('3. Consider web scraping Baidu Images for better results');
        
    } catch {
        console.error('❌ Fatal error occurred');
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the script
main(); 