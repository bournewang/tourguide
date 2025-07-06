#!/usr/bin/env node

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

// Function to normalize spot names for better matching
function normalizeName(name) {
    return name
        .replace(/[-\s]/g, '') // Remove hyphens and spaces
        .toLowerCase();
}

// Function to find the best match for a spot name
function findBestMatch(sourceName, targetSpots, matchField = 'name') {
    const normalizedSourceName = normalizeName(sourceName);
    
    // First try exact match (most common case)
    let exactMatch = targetSpots.find(spot => 
        normalizeName(spot[matchField]) === normalizedSourceName
    );
    if (exactMatch) return exactMatch;
    
    // Try case-insensitive exact match
    exactMatch = targetSpots.find(spot => 
        spot[matchField].toLowerCase() === sourceName.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    
    // Try partial matches (for cases like "少林寺" vs "少林寺-讲解")
    let partialMatches = targetSpots.filter(spot => {
        const normalizedTargetName = normalizeName(spot[matchField]);
        return normalizedSourceName.includes(normalizedTargetName) || 
               normalizedTargetName.includes(normalizedSourceName);
    });
    
    if (partialMatches.length === 1) {
        return partialMatches[0];
    }
    
    return null;
}

// Load JSON file
function loadJsonFile(filepath) {
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        const data = JSON.parse(content);
        
        if (!Array.isArray(data) && typeof data !== 'object') {
            throw new Error('File must contain an array or object');
        }
        
        return data;
    } catch (error) {
        throw new Error(`Error loading file: ${error.message}`);
    }
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

// Save JSON file
function saveJsonFile(filepath, data) {
    try {
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✅ Saved to ${path.basename(filepath)}`);
    } catch (error) {
        throw new Error(`Error saving file: ${error.message}`);
    }
}

// Display merge preview
function showMergePreview(spots, descriptions, matchField, descriptionFields) {
    console.log('\n🔍 Merge Preview:');
    console.log(`Match field: "${matchField}"`);
    console.log(`Description fields: ${descriptionFields.join(', ')}`);
    
    let matchedCount = 0;
    let unmatchedCount = 0;
    const unmatchedDescriptions = [];
    
    for (const desc of descriptions) {
        const spot = findBestMatch(desc[matchField], spots, matchField);
        if (spot) {
            matchedCount++;
        } else {
            unmatchedCount++;
            unmatchedDescriptions.push(desc[matchField]);
        }
    }
    
    console.log(`\n📊 Results:`);
    console.log(`  Total descriptions: ${descriptions.length}`);
    console.log(`  Matched: ${matchedCount}`);
    console.log(`  Unmatched: ${unmatchedCount}`);
    
    if (unmatchedDescriptions.length > 0) {
        console.log(`\n❌ Unmatched descriptions:`);
        unmatchedDescriptions.slice(0, 10).forEach((name, index) => {
            console.log(`  ${index + 1}. "${name}"`);
        });
        
        if (unmatchedDescriptions.length > 10) {
            console.log(`  ... and ${unmatchedDescriptions.length - 10} more`);
        }
    }
    
    return { matchedCount, unmatchedCount, unmatchedDescriptions };
}

// Merge descriptions into spots
function mergeDescriptions(spots, descriptions, matchField, descriptionFields) {
    let mergedCount = 0;
    const unmatchedDescriptions = [];
    
    for (const desc of descriptions) {
        const spot = findBestMatch(desc[matchField], spots, matchField);
        
        if (spot) {
            // Merge description fields
            for (const field of descriptionFields) {
                if (desc[field] !== undefined && desc[field] !== null && desc[field] !== '') {
                    spot[field] = desc[field];
                }
            }
            mergedCount++;
            console.log(`✓ Merged: ${desc[matchField]} -> ${spot[matchField]}`);
        } else {
            unmatchedDescriptions.push(desc[matchField]);
            console.log(`✗ Not found: ${desc[matchField]}`);
        }
    }
    
    return { mergedCount, unmatchedDescriptions };
}

// Interactive mode
async function interactiveMode() {
    console.log('📝 Interactive Description Merge Tool\n');
    
    // Get spots file
    const spotsFile = await new Promise((resolve) => {
        rl.question('📁 Enter spots file path (e.g., spots-shaolinsi.json): ', (answer) => {
            resolve(answer.trim());
        });
    });
    
    const spotsPath = path.join(DATA_DIR, spotsFile);
    
    if (!fs.existsSync(spotsPath)) {
        console.log(`❌ File not found: ${spotsPath}`);
        rl.close();
        process.exit(1);
    }
    
    // Load spots
    let spots;
    try {
        spots = loadJsonFile(spotsPath);
        console.log(`✅ Loaded ${spots.length} spots from ${spotsFile}`);
    } catch (error) {
        console.log(`❌ ${error.message}`);
        rl.close();
        process.exit(1);
    }
    
    // Get description file
    const descFile = await new Promise((resolve) => {
        rl.question('📄 Enter description file path (e.g., description-shaolinsi.json): ', (answer) => {
            resolve(answer.trim());
        });
    });
    
    const descPath = path.join(DATA_DIR, descFile);
    
    if (!fs.existsSync(descPath)) {
        console.log(`❌ File not found: ${descPath}`);
        rl.close();
        process.exit(1);
    }
    
    // Load descriptions
    let descriptions;
    try {
        descriptions = loadJsonFile(descPath);
        console.log(`✅ Loaded ${descriptions.length} descriptions from ${descFile}`);
    } catch (error) {
        console.log(`❌ ${error.message}`);
        rl.close();
        process.exit(1);
    }
    
    // Get match field
    const matchField = await new Promise((resolve) => {
        rl.question('🔗 Enter field to match on (default: "name"): ', (answer) => {
            resolve(answer.trim() || 'name');
        });
    });
    
    // Get description fields
    const descFieldsInput = await new Promise((resolve) => {
        rl.question('📝 Enter description fields to merge (comma-separated, e.g., "description,extended_description"): ', (answer) => {
            resolve(answer.trim());
        });
    });
    
    const descriptionFields = descFieldsInput.split(',').map(field => field.trim()).filter(field => field);
    
    if (descriptionFields.length === 0) {
        console.log('❌ No description fields specified');
        rl.close();
        process.exit(1);
    }
    
    // Show preview
    const { matchedCount } = showMergePreview(spots, descriptions, matchField, descriptionFields);
    
    if (matchedCount === 0) {
        console.log('\n❌ No matches found. Check your match field and data.');
        rl.close();
        process.exit(1);
    }
    
    // Confirm action
    const confirm = await new Promise((resolve) => {
        rl.question(`\n❓ Merge ${matchedCount} descriptions into spots? (y/N): `, (answer) => {
            resolve(answer.toLowerCase() === 'y');
        });
    });
    
    if (!confirm) {
        console.log('❌ Operation cancelled.');
        rl.close();
        process.exit(0);
    }
    
    // Create backup
    createBackup(spotsPath);
    
    // Apply merge
    try {
        const { mergedCount } = mergeDescriptions(spots, descriptions, matchField, descriptionFields);
        saveJsonFile(spotsPath, spots);
        
        console.log(`\n🎉 Successfully merged ${mergedCount} descriptions!`);
        console.log(`📊 Updated ${spotsFile}`);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    rl.close();
    process.exit(0);
}

// Command line mode
function commandLineMode() {
    const args = process.argv.slice(2);
    
    if (args.length < 4) {
        console.log('Usage: node scripts/mergeDescriptions.js <spotsFile> <descFile> <matchField> <descFields...>');
        console.log('');
        console.log('Examples:');
        console.log('  node scripts/mergeDescriptions.js spots-shaolinsi.json description-shaolinsi.json name description');
        console.log('  node scripts/mergeDescriptions.js spots-shaolinsi.json description-shaolinsi.json name description extended_description');
        console.log('');
        console.log('Or run without arguments for interactive mode.');
        process.exit(1);
    }
    
    const [spotsFile, descFile, matchField, ...descriptionFields] = args;
    
    if (descriptionFields.length === 0) {
        console.log('❌ No description fields specified');
        process.exit(1);
    }
    
    const spotsPath = path.join(DATA_DIR, spotsFile);
    const descPath = path.join(DATA_DIR, descFile);
    
    if (!fs.existsSync(spotsPath)) {
        console.log(`❌ Spots file not found: ${spotsPath}`);
        process.exit(1);
    }
    
    if (!fs.existsSync(descPath)) {
        console.log(`❌ Description file not found: ${descPath}`);
        process.exit(1);
    }
    
    // Load files
    let spots, descriptions;
    try {
        spots = loadJsonFile(spotsPath);
        console.log(`✅ Loaded ${spots.length} spots from ${spotsFile}`);
    } catch (error) {
        console.log(`❌ ${error.message}`);
        process.exit(1);
    }
    
    try {
        descriptions = loadJsonFile(descPath);
        console.log(`✅ Loaded ${descriptions.length} descriptions from ${descFile}`);
    } catch (error) {
        console.log(`❌ ${error.message}`);
        process.exit(1);
    }
    
    // Show preview
    const { matchedCount } = showMergePreview(spots, descriptions, matchField, descriptionFields);
    
    if (matchedCount === 0) {
        console.log('\n❌ No matches found. Check your match field and data.');
        process.exit(1);
    }
    
    // Create backup
    createBackup(spotsPath);
    
    // Apply merge
    try {
        const { mergedCount } = mergeDescriptions(spots, descriptions, matchField, descriptionFields);
        saveJsonFile(spotsPath, spots);
        
        console.log(`\n🎉 Successfully merged ${mergedCount} descriptions!`);
        console.log(`📊 Updated ${spotsFile}`);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        process.exit(1);
    }
    
    process.exit(0);
}

// Show usage
function showUsage() {
    console.log(`
📝 Description Merge Tool

This tool merges descriptions from a description file into a spots file.

用法:
  # 交互模式 (推荐)
  node scripts/mergeDescriptions.js

  # 命令行模式
  node scripts/mergeDescriptions.js <spotsFile> <descFile> <matchField> <descFields...>

参数:
  spotsFile      景点文件路径 (e.g., spots-shaolinsi.json)
  descFile       描述文件路径 (e.g., description-shaolinsi.json)
  matchField     匹配字段 (e.g., name, uid)
  descFields     要合并的描述字段 (可多个，用空格分隔)

示例:
  # 交互模式
  node scripts/mergeDescriptions.js

  # 合并 description 字段
  node scripts/mergeDescriptions.js spots-shaolinsi.json description-shaolinsi.json name description

  # 合并多个描述字段
  node scripts/mergeDescriptions.js spots-shaolinsi.json description-shaolinsi.json name description extended_description

  # 使用 uid 匹配
  node scripts/mergeDescriptions.js spots-shaolinsi.json description-shaolinsi.json uid description

文件格式:
  # 景点文件 (spots-shaolinsi.json)
  [
    {
      "name": "少林寺",
      "uid": "abc123",
      "location": { "lat": 34.5, "lng": 113.0 }
    }
  ]

  # 描述文件 (description-shaolinsi.json)
  [
    {
      "name": "少林寺",
      "description": "少林寺是中国佛教禅宗祖庭...",
      "extended_description": "更详细的描述..."
    }
  ]

功能特性:
  ✅ 智能名称匹配 (支持部分匹配和模糊匹配)
  ✅ 支持多个描述字段合并
  ✅ 自动备份原文件
  ✅ 交互式和命令行两种模式
  ✅ 详细的预览和确认
  ✅ 错误处理和验证

安全特性:
  🔒 自动创建备份文件
  🔒 预览合并结果
  🔒 用户确认后才执行
  🔒 详细的错误报告
`);
}

// Main function
async function main() {
    // Check for help flag
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        showUsage();
        process.exit(0);
    }
    
    // Check if running in interactive mode
    if (process.argv.length === 2) {
        await interactiveMode();
    } else {
        commandLineMode();
    }
}

// Run the script
main().catch(error => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
}); 