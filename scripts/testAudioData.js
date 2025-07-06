import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    // Load spots data from the new source
    const spotsDataPath = path.join(__dirname, '../src/data/spots-shaolinsi.json');
    const spotsData = JSON.parse(fs.readFileSync(spotsDataPath, 'utf8'));
    
    console.log(`📖 Loaded ${spotsData.length} spots from spots-shaolinsi.json`);
    
    // Filter spots that have descriptions
    const spotsWithDescriptions = spotsData.filter(spot => 
        spot.description || spot.extended_description
    );
    
    console.log(`📝 Found ${spotsWithDescriptions.length} spots with descriptions`);
    
    // Show some sample data
    console.log('\n📋 Sample spots with descriptions:');
    spotsWithDescriptions.slice(0, 5).forEach((spot, index) => {
        console.log(`\n${index + 1}. ${spot.name}`);
        console.log(`   描述长度: ${(spot.description || spot.extended_description || '').length} 字符`);
        console.log(`   描述预览: ${(spot.description || spot.extended_description || '').substring(0, 50)}...`);
    });
    
    // Show spots without descriptions
    const spotsWithoutDescriptions = spotsData.filter(spot => 
        !spot.description && !spot.extended_description
    );
    
    if (spotsWithoutDescriptions.length > 0) {
        console.log(`\n❌ ${spotsWithoutDescriptions.length} spots without descriptions:`);
        spotsWithoutDescriptions.forEach(spot => {
            console.log(`   - ${spot.name}`);
        });
    }
    
    console.log('\n✅ Data loading test completed successfully!');
    
} catch (error) {
    console.error('❌ Error during data loading test:', error.message);
    process.exit(1);
} 