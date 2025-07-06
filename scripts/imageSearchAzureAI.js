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
const AZURE_SEARCH_URL = 'https://your-search-service.search.windows.net/indexes/images/docs/search';
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

// Search images using Azure AI Search
async function searchImages(query, apiKey, searchServiceName) {
    try {
        const searchUrl = `https://${searchServiceName}.search.windows.net/indexes/images/docs/search?api-version=2023-11-01`;
        
        const searchBody = {
            search: query,
            select: "url,title,description,width,height,fileSize,source",
            top: IMAGES_PER_SPOT,
            filter: "fileType eq 'image'",
            orderby: "relevance desc"
        };
        
        const response = await makeRequest(searchUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify(searchBody)
        });
        
        const result = JSON.parse(response.data);
        
        if (!result.value || result.value.length === 0) {
            throw new Error('No images found');
        }
        
        // Transform Azure AI Search results to match our format
        const images = result.value.map(img => ({
            name: img.title || img.description || 'Untitled',
            contentUrl: img.url,
            thumbnailUrl: img.url, // Azure AI Search might not have separate thumbnails
            width: img.width || 0,
            height: img.height || 0,
            contentSize: img.fileSize || 0,
            source: img.source || 'Unknown'
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
        // Check for API credentials
        const apiKey = process.env.AZURE_SEARCH_API_KEY;
        const searchServiceName = process.env.AZURE_SEARCH_SERVICE_NAME;
        
        if (!apiKey || !searchServiceName) {
            console.error('❌ Please set your Azure AI Search credentials:');
            console.log('export AZURE_SEARCH_API_KEY="your-api-key"');
            console.log('export AZURE_SEARCH_SERVICE_NAME="your-service-name"');
            console.log('\n📝 To set up Azure AI Search:');
            console.log('1. Create an Azure AI Search service in Azure Portal');
            console.log('2. Create an index with image data');
            console.log('3. Get your API key and service name');
            console.log('4. Set the environment variables above');
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
            
            // Search for images
            const searchQuery = `${spot.name} 少林寺`;
            const images = await searchImages(searchQuery, apiKey, searchServiceName);
            
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
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the script
main(); 