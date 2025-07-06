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
const IMAGE_SOURCES_FILE = path.join(__dirname, '../image_sources.json');

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
        return [];
    }
    
    const files = fs.readdirSync(TEMP_IMAGE_DIR)
        .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
    
    return files;
}

// Show image collection recommendations
function showImageCollectionGuide() {
    console.log('\n📋 少林寺图片收集指南');
    console.log('=====================================');
    console.log('🎯 推荐图片收集方法:');
    console.log('');
    console.log('1. 🌐 网络搜索:');
    console.log('   - 百度图片搜索: "少林寺 [景点名]"');
    console.log('   - 谷歌图片搜索: "Shaolin Temple [spot name]"');
    console.log('   - 必应图片搜索: "少林寺 [景点名]"');
    console.log('');
    console.log('2. 📱 旅游网站:');
    console.log('   - 携程、马蜂窝等旅游网站');
    console.log('   - 官方少林寺网站');
    console.log('   - 旅游博客和攻略');
    console.log('');
    console.log('3. 📚 图片资源:');
    console.log('   - 免费图片网站: Unsplash, Pexels, Pixabay');
    console.log('   - 付费图片网站: Shutterstock, iStock');
    console.log('   - 中国图片网站: 视觉中国, 图虫');
    console.log('');
    console.log('4. 🎬 视频截图:');
    console.log('   - 少林寺相关纪录片');
    console.log('   - 旅游视频');
    console.log('   - 官方宣传片');
    console.log('');
    console.log('📝 图片要求:');
    console.log('- 分辨率: 至少 800x600');
    console.log('- 格式: JPG, PNG, GIF');
    console.log('- 大小: 10KB - 500KB');
    console.log('- 内容: 清晰展示景点特色');
    console.log('');
    console.log('📁 保存位置:');
    console.log(`📍 ${TEMP_IMAGE_DIR}`);
    console.log('');
}

// Create image sources mapping
function createImageSourcesMapping() {
    const sources = {
        "少林寺-山门": [
            "shanmen.jpg",
            "shanmen-1.jpg", 
            "shanmen-2.jpg"
        ],
        "塔林": [
            "talin.jpg",
            "pagoda-forest.jpg"
        ],
        "立雪亭": [
            "lixueting.jpg",
            "lixueting-1.jpg"
        ],
        "大雄宝殿": [
            "daxiongbaodian.jpg",
            "main-hall.jpg"
        ],
        "藏经阁": [
            "cangjingge.jpg",
            "scripture-hall.jpg"
        ],
        "方丈": [
            "fangzhang.jpg",
            "abbot.jpg"
        ],
        "达摩祖师": [
            "damodong.jpg",
            "bodhidharma.jpg"
        ],
        "初祖庵大殿": [
            "chuzuan.jpg",
            "first-patriarch.jpg"
        ],
        "锤谱堂": [
            "chuiputang.jpg",
            "martial-arts.jpg"
        ],
        "千佛阁": [
            "qianfodian.jpg",
            "thousand-buddha.jpg"
        ],
        "天王殿": [
            "tianwangdian.jpg",
            "heavenly-king.jpg"
        ],
        "十方禅院": [
            "shifangchanyuan.jpg",
            "meditation-hall.jpg"
        ]
    };
    
    fs.writeFileSync(IMAGE_SOURCES_FILE, JSON.stringify(sources, null, 2), 'utf8');
    console.log('✅ Created image sources mapping file');
    return sources;
}

// Main function
async function main() {
    try {
        // Load spots data
        const spotsDataPath = path.join(__dirname, '../src/data/spots-shaolinsi.json');
        const spotsData = JSON.parse(fs.readFileSync(spotsDataPath, 'utf8'));
        
        console.log(`📖 Loaded ${spotsData.length} spots`);
        
        // Show image collection guide
        showImageCollectionGuide();
        
        // Create images directory if it doesn't exist
        if (!fs.existsSync(IMAGE_DIR)) {
            fs.mkdirSync(IMAGE_DIR, { recursive: true });
        }
        
        // Check temp images
        const tempImages = listTempImages();
        
        if (tempImages.length === 0) {
            console.log('\n📋 No images found in temp_images directory');
            console.log('📝 Please follow the guide above to collect images');
            console.log(`📍 Expected path: ${TEMP_IMAGE_DIR}`);
            
            const createMapping = await askQuestion('\n🤔 Create image sources mapping file? (y/n): ');
            if (createMapping.toLowerCase() === 'y' || createMapping.toLowerCase() === 'yes') {
                createImageSourcesMapping();
                console.log('📄 Check image_sources.json for suggested image names');
            }
            
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
            console.log('  s. Show image collection guide again');
            
            // Get user selection
            const answer = await askQuestion('\n👉 Select image (1-' + tempImages.length + ', 0 to skip, s for guide): ');
            
            if (answer.toLowerCase() === 's') {
                showImageCollectionGuide();
                i--; // Repeat this spot
                continue;
            }
            
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