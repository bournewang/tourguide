import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DATA_DIR = path.join(__dirname, '../src/data');
const OUTPUT_FILE = path.join(DATA_DIR, 'spots-complete.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// File patterns to include (spots files)
const SPOTS_FILE_PATTERNS = [
    'spots-*.json',
    'spots-*2.json'  // Include files like spots-taishishan2.json
];

// Files to exclude
const EXCLUDE_FILES = [
    'spots-complete.json',
    'spots-shaolinsi-backup.json',
    'spots-shaolinsi-bk.json',
    'description-shaolinsi.json'
];

// Priority order for conflict resolution (higher index = higher priority)
const PRIORITY_FILES = [
    'spots-shaolinsi.json',      // Highest priority
    'spots-taishishan.json',
    'spots-taishishan2.json',
    'spots-zhongyuemiao.json',
    'spots-songyangshuyuan.json',
    'spots-shaoshishan.json',
    'spots-guanxingtai.json'
];

// Fields to merge (in order of preference)
const MERGE_FIELDS = [
    'image_thumb',
    'audioFile', 
    'description',
    'name',
    'address',
    'location',
    'telephone',
    'tag',
    'type',
    'rating'
];

// Validation functions
function validateSpot(spot, filename) {
    const errors = [];
    
    // Required fields
    if (!spot.uid) {
        errors.push('Missing uid');
    }
    if (!spot.name) {
        errors.push('Missing name');
    }
    
    // Location validation
    if (spot.location) {
        if (typeof spot.location.lat !== 'number' || typeof spot.location.lng !== 'number') {
            errors.push('Invalid location coordinates');
        }
        if (spot.location.lat < -90 || spot.location.lat > 90) {
            errors.push('Invalid latitude');
        }
        if (spot.location.lng < -180 || spot.location.lng > 180) {
            errors.push('Invalid longitude');
        }
    }
    
    if (errors.length > 0) {
        console.log(`⚠️  Validation errors in ${filename} for spot "${spot.name}": ${errors.join(', ')}`);
        return false;
    }
    
    return true;
}

// Merge two spots with conflict resolution
function mergeSpots(existingSpot, newSpot, existingFile, newFile) {
    const merged = { ...existingSpot };
    
    for (const field of MERGE_FIELDS) {
        if (newSpot[field] !== undefined && newSpot[field] !== null && newSpot[field] !== '') {
            // If existing spot has this field, check if we should update it
            if (merged[field] !== undefined && merged[field] !== null && merged[field] !== '') {
                // Conflict resolution based on file priority
                const existingPriority = PRIORITY_FILES.indexOf(existingFile);
                const newPriority = PRIORITY_FILES.indexOf(newFile);
                
                if (newPriority > existingPriority) {
                    merged[field] = newSpot[field];
                    console.log(`  🔄 Updated ${field} from ${newFile} (higher priority)`);
                } else if (newPriority === existingPriority) {
                    // Same priority, keep existing unless new is more complete
                    if (typeof newSpot[field] === 'string' && newSpot[field].length > merged[field].length) {
                        merged[field] = newSpot[field];
                        console.log(`  🔄 Updated ${field} from ${newFile} (more complete)`);
                    }
                }
            } else {
                // Field doesn't exist in existing spot, add it
                merged[field] = newSpot[field];
                console.log(`  ➕ Added ${field} from ${newFile}`);
            }
        }
    }
    
    return merged;
}

// Load and validate spots from a file
function loadSpotsFile(filepath) {
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        const spots = JSON.parse(content);
        
        if (!Array.isArray(spots)) {
            console.log(`❌ ${path.basename(filepath)}: Not a valid spots array`);
            return [];
        }
        
        const validSpots = [];
        const filename = path.basename(filepath);
        
        for (const spot of spots) {
            if (validateSpot(spot, filename)) {
                validSpots.push(spot);
            }
        }
        
        console.log(`✅ Loaded ${validSpots.length} valid spots from ${filename}`);
        return validSpots;
        
    } catch (error) {
        console.log(`❌ Error loading ${path.basename(filepath)}: ${error.message}`);
        return [];
    }
}

// Get all spots files
function getSpotsFiles() {
    const files = fs.readdirSync(DATA_DIR);
    const spotsFiles = [];
    
    for (const file of files) {
        if (file.endsWith('.json') && 
            !EXCLUDE_FILES.includes(file) &&
            (file.startsWith('spots-') || file.match(/spots-.*\.json$/))) {
            spotsFiles.push(path.join(DATA_DIR, file));
        }
    }
    
    return spotsFiles.sort((a, b) => {
        const aPriority = PRIORITY_FILES.indexOf(path.basename(a));
        const bPriority = PRIORITY_FILES.indexOf(path.basename(b));
        return bPriority - aPriority; // Higher priority first
    });
}

// Create backup
function createBackup() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `spots-backup-${timestamp}.json`);
    
    if (fs.existsSync(OUTPUT_FILE)) {
        fs.copyFileSync(OUTPUT_FILE, backupFile);
        console.log(`💾 Created backup: ${path.basename(backupFile)}`);
    }
}

// Main merge function
async function mergeSpotsFiles() {
    console.log('🚀 Starting spots files merge...\n');
    
    // Create backup
    createBackup();
    
    // Get all spots files
    const spotsFiles = getSpotsFiles();
    console.log(`📁 Found ${spotsFiles.length} spots files:`);
    spotsFiles.forEach(file => console.log(`  - ${path.basename(file)}`));
    console.log('');
    
    if (spotsFiles.length === 0) {
        console.log('❌ No spots files found to merge');
        return;
    }
    
    // Load all spots
    const allSpots = [];
    const spotsByUid = new Map();
    const conflicts = [];
    
    for (const filepath of spotsFiles) {
        const filename = path.basename(filepath);
        const spots = loadSpotsFile(filepath);
        
        for (const spot of spots) {
            if (spotsByUid.has(spot.uid)) {
                // Conflict found
                const existingSpot = spotsByUid.get(spot.uid);
                const existingFile = existingSpot._sourceFile;
                
                console.log(`\n⚠️  Conflict found for UID ${spot.uid}:`);
                console.log(`  Existing: "${existingSpot.name}" from ${existingFile}`);
                console.log(`  New: "${spot.name}" from ${filename}`);
                
                // Merge the spots
                const mergedSpot = mergeSpots(existingSpot, spot, existingFile, filename);
                mergedSpot._sourceFile = filename; // Update source file
                
                spotsByUid.set(spot.uid, mergedSpot);
                conflicts.push({
                    uid: spot.uid,
                    existing: existingSpot,
                    new: spot,
                    merged: mergedSpot,
                    existingFile,
                    newFile: filename
                });
                
            } else {
                // New spot
                spot._sourceFile = filename;
                spotsByUid.set(spot.uid, spot);
                allSpots.push(spot);
            }
        }
    }
    
    // Convert map back to array and remove internal fields
    const mergedSpots = Array.from(spotsByUid.values()).map(spot => {
        const { _sourceFile, ...cleanSpot } = spot;
        return cleanSpot;
    });
    
    // Sort by name for better readability
    mergedSpots.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    
    // Save merged file
    try {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mergedSpots, null, 2), 'utf8');
        console.log(`\n✅ Successfully merged ${mergedSpots.length} unique spots`);
        console.log(`💾 Saved to: ${path.basename(OUTPUT_FILE)}`);
        
        // Summary
        console.log('\n📊 Merge Summary:');
        console.log(`  Total spots: ${mergedSpots.length}`);
        console.log(`  Conflicts resolved: ${conflicts.length}`);
        console.log(`  Files processed: ${spotsFiles.length}`);
        
        if (conflicts.length > 0) {
            console.log('\n🔍 Conflicts resolved:');
            conflicts.forEach(conflict => {
                console.log(`  - ${conflict.uid}: "${conflict.existing.name}" + "${conflict.new.name}" → "${conflict.merged.name}"`);
            });
        }
        
        // Validation
        console.log('\n🔍 Final validation:');
        let validCount = 0;
        for (const spot of mergedSpots) {
            if (validateSpot(spot, 'merged')) {
                validCount++;
            }
        }
        console.log(`  Valid spots: ${validCount}/${mergedSpots.length}`);
        
        if (validCount === mergedSpots.length) {
            console.log('✅ All spots are valid!');
        } else {
            console.log('⚠️  Some spots have validation issues');
        }
        
    } catch (error) {
        console.error('❌ Error saving merged file:', error.message);
    }
}

// Run the merge
mergeSpotsFiles(); 