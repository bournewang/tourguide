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
const WIKIPEDIA_API_URL = 'https://commons.wikimedia.org/w/api.php';
const IMAGES_PER_SPOT = 5;
const MIN_FILE_SIZE = 10 * 1024; // 10KB
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
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
                'User-Agent': 'TourGuide-Image-Search/1.0',
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
        req.setTimeout(15000, () => req.destroy());
        req.end();
    });
}

// Search images using Wikipedia Commons API
async function searchWikipediaImages(query) {
    try {
        const searchUrl = `${WIKIPEDIA_API_URL}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=${IMAGES_PER_SPOT}`;
        
        console.log(`🔍 Searching Wikipedia Commons for: "${query}"`);
        
        const response = await makeRequest(searchUrl);
        const result = JSON.parse(response.data);
        
        if (!result.query || !result.query.search || result.query.search.length === 0) {
            console.log('❌ No images found in Wikipedia Commons');
            return [];
        }
        
        console.log(`✅ Found ${result.query.search.length} images`);
        
        // Get detailed info for each image
        const imageTitles = result.query.search.map(item => item.title);
        const detailedImages = await getImageDetails(imageTitles);
        
        return detailedImages;
        
    } catch (error) {
        console.error(`❌ Wikipedia search failed for "${query}":`, error.message);
        return [];
    }
}

// Get detailed information about images
async function getImageDetails(imageTitles) {
    try {
        const titles = imageTitles.join('|');
        const url = `${WIKIPEDIA_API_URL}?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|size|width|height|mime&format=json`;
        
        const response = await makeRequest(url);
        const result = JSON.parse(response.data);
        
        const images = [];
        
        if (result.query && result.query.pages) {
            Object.values(result.query.pages).forEach(page => {
                if (page.imageinfo && page.imageinfo[0]) {
                    const info = page.imageinfo[0];
                    
                    // Filter by size and type
                    if (info.size >= MIN_FILE_SIZE && 
                        info.size <= MAX_FILE_SIZE && 
                        info.mime.startsWith('image/')) {
                        
                        images.push({
                            title: page.title,
                            url: info.url,
                            size: info.size,
                            width: info.width,
                            height: info.height,
                            mime: info.mime
                        });
                    }
                }
            });
        }
        
        return images;
        
    } catch (error) {
        console.error('❌ Failed to get image details:', error.message);
        return [];
    }
}

// Download image
async function downloadImage(url, filepath) {
    try {
        console.log(`⬇️  Downloading: ${url}`);
        
        const response = await makeRequest(url);
        
        // Check if response is actually an image
        if (response.data.length < MIN_FILE_SIZE) {
            console.log('❌ Downloaded file too small, might not be an image');
            return false;
        }
        
        fs.writeFileSync(filepath, response.data);
        console.log(`✅ Downloaded: ${path.basename(filepath)}`);
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

// Display images with details
async function selectImage(spot, images) {
    console.log(`\n🎯 Selecting image for: ${spot.name}`);
    console.log(`🔍 Search query: "${spot.name} 少林寺"`);
    
    if (images.length === 0) {
        console.log('❌ No suitable images found');
        return null;
    }
    
    console.log('\n📸 Available images from Wikipedia Commons:');
    images.forEach((img, index) => {
        const size = img.size ? `${Math.round(img.size / 1024)}KB` : 'Unknown';
        const width = img.width || 'Unknown';
        const height = img.height || 'Unknown';
        console.log(`\n  ${index + 1}. ${img.title}`);
        console.log(`     📏 Size: ${width}x${height} (${size})`);
        console.log(`     🖼️  Type: ${img.mime}`);
        console.log(`     🌐 URL: ${img.url}`);
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
        // Load spots data
        const spotsDataPath = path.join(__dirname, '../src/data/spots-shaolinsi.json');
        const spotsData = JSON.parse(fs.readFileSync(spotsDataPath, 'utf8'));
        
        console.log(`📖 Loaded ${spotsData.length} spots`);
        console.log('🌐 Using Wikipedia Commons for image search');
        
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
            const images = await searchWikipediaImages(searchQuery);
            
            // Let user select image
            const selectedImage = await selectImage(spot, images);
            
            if (selectedImage) {
                // Create safe filename
                const safeName = spot.name.replace(/[^\w\u4e00-\u9fff]/g, '_').replace(/_+/g, '_');
                const filename = `${safeName}.jpg`;
                const filepath = path.join(IMAGE_DIR, filename);
                
                // Download image
                const downloadSuccess = await downloadImage(selectedImage.url, filepath);
                
                if (downloadSuccess) {
                    // Verify file size
                    const fileSize = getFileSize(filepath);
                    if (fileSize >= MIN_FILE_SIZE && fileSize <= MAX_FILE_SIZE) {
                        console.log(`✅ Successfully processed: ${spot.name}`);
                        processedCount++;
                    } else {
                        console.log(`❌ File size verification failed: ${fileSize} bytes`);
                        fs.unlinkSync(filepath);
                    }
                }
            } else {
                console.log(`⏭️  Skipped: ${spot.name}`);
                skippedCount++;
            }
            
            // Add delay to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`\n🎉 Processing complete!`);
        console.log(`✅ Processed: ${processedCount} spots`);
        console.log(`⏭️  Skipped: ${skippedCount} spots`);
        
    } catch (error) {
        console.error('❌ Main process failed:', error);
    } finally {
        rl.close();
    }
}

// Run the script
main(); 