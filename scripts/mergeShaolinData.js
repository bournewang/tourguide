import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to normalize spot names for better matching
function normalizeName(name) {
  return name
    .replace(/[-\s]/g, '') // Remove hyphens and spaces
    .replace(/[讲解|剧本]/g, '') // Remove Chinese suffixes
    .toLowerCase();
}

// Function to find the best match for a spot name
function findBestMatch(sourceName, targetSpots) {
  const normalizedSourceName = normalizeName(sourceName);
  
  // First try exact match
  let exactMatch = targetSpots.find(spot => 
    normalizeName(spot.name) === normalizedSourceName
  );
  if (exactMatch) return exactMatch;
  
  // Try partial matches
  let partialMatches = targetSpots.filter(spot => {
    const normalizedTargetName = normalizeName(spot.name);
    return normalizedSourceName.includes(normalizedTargetName) || 
           normalizedTargetName.includes(normalizedSourceName);
  });
  
  if (partialMatches.length === 1) {
    return partialMatches[0];
  }
  
  // Try fuzzy matching for common variations
  const nameMappings = {
    '立雪亭': '立雪亭',
    '立雪亭-讲解': '立雪亭',
    '立雪亭-剧本': '立雪亭',
    '少林寺碑林': '少林寺碑林',
    '碑林': '少林寺碑林',
    '方丈室': '方丈',
    '锤谱堂': '锤谱堂',
    '藏经阁': '藏经阁',
    '大雄宝殿': '大雄宝殿',
    '塔林': '塔林',
    '天王殿': '天王殿',
    '千佛殿': '千佛殿',
    '初祖庵': '初祖庵',
    '二祖庵': '二祖庵',
    '达摩洞': '达摩洞',
    '十方禅院': '十方禅院'
  };
  
  const mappedName = nameMappings[sourceName];
  if (mappedName) {
    return targetSpots.find(spot => spot.name === mappedName);
  }
  
  return null;
}

// Main merge function
function mergeShaolinData() {
  try {
    // Read source data (shaolin.json)
    const sourcePath = path.join(__dirname, '..', 'src', 'shaolin.json');
    const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    
    // Read target data (spots-shaolinsi.json)
    const targetPath = path.join(__dirname, '..', 'src', 'data', 'spots-shaolinsi.json');
    const targetData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    
    console.log(`Source spots: ${sourceData.length}`);
    console.log(`Target spots: ${targetData.length}`);
    
    let mergedCount = 0;
    let notFoundCount = 0;
    const notFoundSpots = [];
    
    // Process each source spot
    sourceData.forEach(sourceSpot => {
      const targetSpot = findBestMatch(sourceSpot.name, targetData);
      
      if (targetSpot) {
        // Merge the specified fields
        if (sourceSpot.image_thumb) {
          targetSpot.image_thumb = sourceSpot.image_thumb;
        }
        if (sourceSpot.extended_description) {
          targetSpot.extended_description = sourceSpot.extended_description;
        }
        if (sourceSpot.audioFile) {
          targetSpot.audioFile = sourceSpot.audioFile;
        }
        
        mergedCount++;
        console.log(`✓ Merged: ${sourceSpot.name} -> ${targetSpot.name}`);
      } else {
        notFoundCount++;
        notFoundSpots.push(sourceSpot.name);
        console.log(`✗ Not found: ${sourceSpot.name}`);
      }
    });
    
    // Write updated target data
    fs.writeFileSync(targetPath, JSON.stringify(targetData, null, 2), 'utf8');
    
    console.log('\n=== Merge Summary ===');
    console.log(`Successfully merged: ${mergedCount} spots`);
    console.log(`Not found: ${notFoundCount} spots`);
    
    if (notFoundSpots.length > 0) {
      console.log('\nSpots not found in target file:');
      notFoundSpots.forEach(spot => console.log(`  - ${spot}`));
    }
    
    console.log(`\nUpdated file saved to: ${targetPath}`);
    
  } catch (error) {
    console.error('Error during merge:', error.message);
    return;
  }
}

// Run the merge
mergeShaolinData(); 