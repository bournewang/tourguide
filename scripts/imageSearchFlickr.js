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
const FLICKR_API_URL = 'https://api.flickr.com/services/rest/';
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

// Search images using Flickr API
async function searchFlickrImages(query, apiKey) {
    try {
        const searchUrl = `${FLICKR_API_URL}?method=flickr.photos.search&api_key=${apiKey}&text=${encodeURIComponent(query)}&per_page=${IMAGES_PER_SPOT}&format=json&nojsoncallback=1&sort=relevance&content_type=1&media=photos&license=1,2,3,4,5,6`;
        
        console.log(`🔍 Searching Flickr for: "${query}"`);
        
        const response = await makeRequest(searchUrl);
        const result = JSON.parse(response.data);
        
        if (result.stat !== 'ok' || !result.photos || !result.photos.photo || result.photos.photo.length === 0) {
            console.log('❌ No images found on Flickr');
            return [];
        }
        
        console.log(`✅ Found ${result.photos.photo.length} images on Flickr`);
        
        // Get detailed info for each photo
        const photos = result.photos.photo;
        const detailedPhotos = await Promise.all(
            photos.map(photo => getFlickrPhotoInfo(photo, apiKey))
        );
        
        return detailedPhotos.filter(photo => photo !== null);
        
    } catch (error) {
        console.error(`❌ Flickr search failed for "${query}":`, error.message);
        return [];
    }
}

// Get detailed information about a Flickr photo
async function getFlickrPhotoInfo(photo, apiKey) {
    try {
        const infoUrl = `${FLICKR_API_URL}?method=flickr.photos.getInfo&api_key=${apiKey}&photo_id=${photo.id}&format=json&nojsoncallback=1`;
        
        const response = await makeRequest(infoUrl);
        const result = JSON.parse(response.data);
        
        if (result.stat !== 'ok' || !result.photo) {
            return null;
        }
        
        const photoInfo = result.photo;
        
        // Build image URL
        const imageUrl = `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`;
        
        return {
            id: photo.id,
            title: photoInfo.title._content || 'Untitled',
            description: photoInfo.description._content || '',
            url: imageUrl,
            owner: photoInfo.owner.username,
            license: photoInfo.license,
            tags: photoInfo.tags ? photoInfo.tags.tag.map(tag => tag._content) : []
        };
        
    } catch (error) {
        console.error(`❌ Failed to get photo info for ${photo.id}:`, error.message);
        return null;
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
    
    console.log('\n📸 Available images from Flickr:');
    images.forEach((img, index) => {
        console.log(`\n  ${index + 1}. ${img.title}`);
        console.log(`     👤 By: ${img.owner}`);
        console.log(`     🏷️  Tags: ${img.tags.slice(0, 3).join(', ')}`);
        console.log(`     🌐 URL: ${img.url}`);
        if (img.description) {
            console.log(`     📝 Description: ${img.description.substring(0, 100)}...`);
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
        const apiKey = process.env.FLICKR_API_KEY;
        if (!apiKey) {
            console.error('❌ Please set your Flickr API key:');
            console.log('export FLICKR_API_KEY="your-api-key"');
            console.log('\nGet a free API key at: https://www.flickr.com/services/apps/create/');
            process.exit(1);
        }
        
        // Load spots data
        const spotsDataPath = path.join(__dirname, '../src/data/spots-shaolinsi.json');
        const spotsData = JSON.parse(fs.readFileSync(spotsDataPath, 'utf8'));
        
        console.log(`📖 Loaded ${spotsData.length} spots`);
        console.log('🌐 Using Flickr for image search');
        
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
            const images = await searchFlickrImages(searchQuery, apiKey);
            
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