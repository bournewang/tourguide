/**
 * Enhanced Spots Filter Tool
 * 
 * This tool helps filter spots based on their address field to remove spots
 * that don't belong to a specific scenic area.
 * 
 * PROBLEM SOLVED:
 * When searching for spots by center coordinates and radius, spots from other
 * scenic areas might be included. This tool helps filter them out based on
 * address patterns.
 * 
 * USAGE EXAMPLES:
 * 
 * 1. Remove spots from "少林景区" but keep those also in "三皇寨景区":
 *    node scripts/filterSpotsByAddress.js spots-shaoshishan.json "少林景区" "三皇寨景区"
 *    node scripts/filterSpotsByAddress.js assets/kaifeng/data/spots/tianboyangfu.json "翰园" "天波杨府"
 * 
 * 2. Keep only spots from "少林景区":
 *    node scripts/filterSpotsByAddress.js spots-shaoshishan.json "少林景区" "" false include
 * 
 * 3. Keep only spots from "少林景区" AND "三皇寨景区":
 *    node scripts/filterSpotsByAddress.js spots-shaoshishan.json "少林景区" "三皇寨景区" false strict
 *    node scripts/filterSpotsByAddress.js assets/kaifeng/data/spots/tianboyangfu.json "翰园" "天波杨府" false strict
 * 
 * 4. Interactive mode:
 *    node scripts/filterSpotsByAddress.js
 * 
 * FILTER MODES:
 * - exclude: Remove spots with includeString but NOT excludeString (default)
 * - include: Keep only spots with includeString
 * - strict: Keep only spots with BOTH includeString AND excludeString
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DATA_DIR = path.join(__dirname, '../src/data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Filter function - Enhanced for scenic area filtering
function filterSpotsByAddress(spots, includeString, excludeString, caseSensitive = false, mode = 'exclude') {
    const filteredSpots = [];
    const removedSpots = [];
    
    for (const spot of spots) {
        if (!spot.address) {
            // Keep spots without address
            filteredSpots.push(spot);
            continue;
        }
        
        const address = caseSensitive ? spot.address : spot.address.toLowerCase();
        const includeStr = caseSensitive ? includeString : includeString.toLowerCase();
        const excludeStr = caseSensitive ? excludeString : excludeString.toLowerCase();
        
        // Check if address contains includeString
        const hasIncludeString = address.includes(includeStr);
        
        // Check if address contains excludeString
        const hasExcludeString = address.includes(excludeStr);
        
        let shouldKeep = true;
        
        if (mode === 'exclude') {
            // EXCLUDE MODE: Remove spots that contain includeString but NOT excludeString
            // Keep spots if:
            // 1. Address doesn't contain includeString (keep all others)
            // 2. Address contains includeString AND excludeString (keep these)
            // Remove spots if:
            // - Address contains includeString but NOT excludeString
            shouldKeep = !hasIncludeString || hasExcludeString;
        } else if (mode === 'include') {
            // INCLUDE MODE: Keep only spots that contain includeString
            // Keep spots if address contains includeString
            shouldKeep = hasIncludeString;
        } else if (mode === 'strict') {
            // STRICT MODE: Keep only spots that contain includeString AND excludeString
            // Keep spots if address contains both includeString and excludeString
            shouldKeep = hasIncludeString && hasExcludeString;
        }
        
        if (shouldKeep) {
            filteredSpots.push(spot);
        } else {
            removedSpots.push(spot);
        }
    }
    
    return { filteredSpots, removedSpots };
}

// Create backup
function createBackup(filepath) {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    const filename = path.basename(filepath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `${filename.replace('.json', '')}-backup-${timestamp}.json`);
    
    fs.copyFileSync(filepath, backupFile);
    console.log(`💾 Created backup: ${path.basename(backupFile)}`);
    
    return backupFile;
}

// Load spots file
function loadSpotsFile(filepath) {
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        const data = JSON.parse(content);
        
        let spots;
        
        // Check if it's a direct spots array
        if (Array.isArray(data)) {
            spots = data;
        }
        // Check if it's a search result object with results array
        else if (data.results && Array.isArray(data.results)) {
            spots = data.results;
            console.log(`📋 Loaded ${spots.length} spots from search results`);
        }
        // Check if it's a scenic area object with spots array
        else if (data.spots && Array.isArray(data.spots)) {
            spots = data.spots;
            console.log(`📋 Loaded ${spots.length} spots from scenic area`);
        }
        else {
            throw new Error('File does not contain a valid spots array or search results');
        }
        
        return spots;
    } catch (error) {
        throw new Error(`Error loading file: ${error.message}`);
    }
}

// Save spots file
function saveSpotsFile(filepath, spots) {
    try {
        fs.writeFileSync(filepath, JSON.stringify(spots, null, 2), 'utf8');
        console.log(`✅ Saved ${spots.length} spots to ${path.basename(filepath)}`);
    } catch (error) {
        throw new Error(`Error saving file: ${error.message}`);
    }
}

// Display filter preview
function showFilterPreview(spots, includeString, excludeString, caseSensitive, mode = 'exclude') {
    console.log('\n🔍 Filter Preview:');
    console.log(`Include string: "${includeString}"`);
    console.log(`Exclude string: "${excludeString}"`);
    console.log(`Case sensitive: ${caseSensitive ? 'Yes' : 'No'}`);
    console.log(`Mode: ${mode.toUpperCase()}`);
    
    const { filteredSpots, removedSpots } = filterSpotsByAddress(spots, includeString, excludeString, caseSensitive, mode);
    
    console.log(`\n📊 Results:`);
    console.log(`  Total spots: ${spots.length}`);
    console.log(`  Kept spots: ${filteredSpots.length}`);
    console.log(`  Removed spots: ${removedSpots.length}`);
    
    if (removedSpots.length > 0) {
        console.log(`\n🗑️  Spots to be removed:`);
        removedSpots.slice(0, 10).forEach((spot, index) => {
            console.log(`  ${index + 1}. "${spot.name}" - ${spot.address}`);
        });
        
        if (removedSpots.length > 10) {
            console.log(`  ... and ${removedSpots.length - 10} more`);
        }
    }
    
    return { filteredSpots, removedSpots };
}

// Interactive mode
async function interactiveMode() {
    console.log('🎯 Interactive Spots Filter Tool\n');
    
    // Get input file
    const inputFile = await new Promise((resolve) => {
        rl.question('📁 Enter spots file path (e.g., spots-shaoshishan.json or full path): ', (answer) => {
            resolve(answer.trim());
        });
    });
    
    const filepath = path.resolve(inputFile); // Use exact path provided
    
    if (!fs.existsSync(filepath)) {
        console.log(`❌ File not found: ${filepath}`);
        rl.close();
        process.exit(1);
    }
    
    // Load spots
    let spots;
    try {
        spots = loadSpotsFile(filepath);
        console.log(`✅ Loaded ${spots.length} spots from ${inputFile}`);
    } catch (error) {
        console.log(`❌ ${error.message}`);
        rl.close();
        process.exit(1);
    }
    
    // Get filter strings
    const includeString = await new Promise((resolve) => {
        rl.question('\n🔍 Enter string to include (spots with this will be checked): ', (answer) => {
            resolve(answer.trim());
        });
    });
    
    const excludeString = await new Promise((resolve) => {
        rl.question('🚫 Enter string to exclude (spots with include string AND this will be kept): ', (answer) => {
            resolve(answer.trim());
        });
    });
    
    // Get case sensitivity
    const caseSensitive = await new Promise((resolve) => {
        rl.question('🔤 Case sensitive? (y/N): ', (answer) => {
            resolve(answer.toLowerCase() === 'y');
        });
    });
    
    // Get filter mode
    const mode = await new Promise((resolve) => {
        rl.question('🎯 Filter mode (exclude/include/strict) [exclude]: ', (answer) => {
            const mode = answer.trim().toLowerCase();
            if (['exclude', 'include', 'strict'].includes(mode)) {
                resolve(mode);
            } else {
                resolve('exclude');
            }
        });
    });
    
    // Show preview
    const { filteredSpots, removedSpots } = showFilterPreview(spots, includeString, excludeString, caseSensitive, mode);
    
    if (removedSpots.length === 0) {
        console.log('\n✅ No spots will be removed. No action needed.');
        rl.close();
        process.exit(0);
    }
    
    // Confirm action
    const confirm = await new Promise((resolve) => {
        rl.question(`\n❓ Apply filter and remove ${removedSpots.length} spots? (y/N): `, (answer) => {
            resolve(answer.toLowerCase() === 'y');
        });
    });
    
    if (!confirm) {
        console.log('❌ Operation cancelled.');
        rl.close();
        process.exit(0);
    }
    
    // Create backup
    createBackup(filepath);
    
    // Apply filter
    try {
        saveSpotsFile(filepath, filteredSpots);
        console.log(`\n🎉 Successfully filtered ${inputFile}!`);
        console.log(`📊 Removed ${removedSpots.length} spots`);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    rl.close();
    process.exit(0);
}

// Command line mode
function commandLineMode() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('🎯 Enhanced Spots Filter Tool');
        console.log('');
        console.log('Usage: node scripts/filterSpotsByAddress.js <filename> <includeString> <excludeString> [caseSensitive] [mode]');
        console.log('');
        console.log('Parameters:');
        console.log('  filename        - JSON file containing spots array');
        console.log('  includeString   - String to include in filtering');
        console.log('  excludeString   - String to exclude in filtering');
        console.log('  caseSensitive   - true/false (default: false)');
        console.log('  mode            - exclude/include/strict (default: exclude)');
        console.log('');
        console.log('Filter Modes:');
        console.log('  exclude  - Remove spots with includeString but NOT excludeString');
        console.log('  include  - Keep only spots with includeString');
        console.log('  strict   - Keep only spots with BOTH includeString AND excludeString');
        console.log('');
        console.log('Examples:');
        console.log('  # Remove spots from "少林景区" but keep those also in "三皇寨景区"');
        console.log('  node scripts/filterSpotsByAddress.js spots-shaoshishan.json "少林景区" "三皇寨景区"');
        console.log('  node scripts/filterSpotsByAddress.js assets/kaifeng/data/spots/tianboyangfu.json "翰园" "天波杨府"');
        console.log('');
        console.log('  # Keep only spots from "少林景区"');
        console.log('  node scripts/filterSpotsByAddress.js spots-shaoshishan.json "少林景区" "" false include');
        console.log('');
        console.log('  # Keep only spots from "少林景区" AND "三皇寨景区"');
        console.log('  node scripts/filterSpotsByAddress.js spots-shaoshishan.json "少林景区" "三皇寨景区" false strict');
        console.log('  node scripts/filterSpotsByAddress.js assets/kaifeng/data/spots/tianboyangfu.json "翰园" "天波杨府" false strict');
        console.log('');
        console.log('  # Case sensitive filtering');
        console.log('  node scripts/filterSpotsByAddress.js spots-shaoshishan.json "少林景区" "三皇寨景区" true');
        console.log('');
        console.log('Or run without arguments for interactive mode.');
        process.exit(1);
    }
    
    const [filename, includeString, excludeString, caseSensitiveStr, mode] = args;
    const caseSensitive = caseSensitiveStr === 'true';
    const filterMode = mode || 'exclude';
    const filepath = path.resolve(filename); // Use exact path provided
    
    if (!fs.existsSync(filepath)) {
        console.log(`❌ File not found: ${filepath}`);
        process.exit(1);
    }
    
    // Load spots
    let spots;
    try {
        spots = loadSpotsFile(filepath);
        console.log(`✅ Loaded ${spots.length} spots from ${filename}`);
    } catch (error) {
        console.log(`❌ ${error.message}`);
        process.exit(1);
    }
    
    // Show preview
    const { filteredSpots, removedSpots } = showFilterPreview(spots, includeString, excludeString, caseSensitive, filterMode);
    
    if (removedSpots.length === 0) {
        console.log('\n✅ No spots will be removed. No action needed.');
        process.exit(0);
    }
    
    // Create backup
    createBackup(filepath);
    
    // Apply filter
    try {
        saveSpotsFile(filepath, filteredSpots);
        console.log(`\n🎉 Successfully filtered ${filename}!`);
        console.log(`📊 Removed ${removedSpots.length} spots`);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        process.exit(1);
    }
    
    process.exit(0);
}

// Main function
async function main() {
    // Check if running in interactive mode
    if (process.argv.length === 2) {
        await interactiveMode();
    } else {
        commandLineMode();
    }
}

// Run the script
main(); 