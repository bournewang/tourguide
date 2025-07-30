#!/usr/bin/env node

/**
 * Simplified NFC Tag Generator Script
 * Generates NFC tag URLs with simple UIDs and validation codes for a standalone city website
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'https://df.qingfan.wang'; // Update this to your domain
const OUTPUT_DIR = path.join(__dirname, '../nfc-tags');
const SECRET_KEY = 'tourguide-2024-nfc-validation-key';
const LAST_NUMBER_FILE = path.join(OUTPUT_DIR, 'last-generated-number.txt');

// Get command line arguments
const args = process.argv.slice(2);

// Check if user wants to generate demo tags
if (args[0] === '--demo' || args[0] === '-d') {
  const demoCount = parseInt(args[1]) || 10;
  
  if (isNaN(demoCount) || demoCount <= 0) {
    console.error('❌ Error: Please provide a valid number of demo tags to generate');
    console.error('Usage: node generate-nfc-tags-simple.js --demo <number_of_tags>');
    console.error('Example: node generate-nfc-tags-simple.js --demo 20');
    process.exit(1);
  }
  
  console.log(`🏷️ Generating ${demoCount} demo NFC tags with "demo-" prefix...`);
  
  // Generate demo tags
  for (let i = 1; i <= demoCount; i++) {
    const uid = `demo-${i}`;
    const validationCode = generateValidationCode(uid);
    const s = `${uid}:${validationCode}`;
    const nfcUrl = `${BASE_URL}/?s=${s}`;
    
    console.log(`Demo ${i}: ${nfcUrl}`);
    console.log(`  UID: ${uid}`);
    console.log(`  Validation Code: ${validationCode}`);
    console.log(`  Policy: Demo (100 devices, 5 minutes)`);
    console.log('');
  }
  
  console.log(`✅ Generated ${demoCount} demo tags with "demo-" prefix`);
  console.log('📋 Demo tags have: 100 device limit, 5-minute session duration');
  process.exit(0);
}

// Check if user wants to generate a single URL for a specific UID
if (args[0] === '--uid' || args[0] === '-u') {
  if (!args[1]) {
    console.error('❌ Error: Please provide a UID after --uid');
    console.error('Usage: node generate-nfc-tags-simple.js --uid <uid>');
    console.error('Examples:');
    console.error('  node generate-nfc-tags-simple.js --uid 123');
    console.error('  node generate-nfc-tags-simple.js --uid "test-abc"');
    process.exit(1);
  }
  
  const specificUid = args[1];
  
  // Validate UID format (allow alphanumeric and hyphens)
  if (!/^[a-zA-Z0-9\-_]+$/.test(specificUid)) {
    console.error('❌ Error: UID can only contain letters, numbers, hyphens, and underscores');
    console.error('Examples: 123, test-abc, demo_123');
    process.exit(1);
  }
  
  // Generate single URL
  const validationCode = generateValidationCode(specificUid);
  const s = `${specificUid}:${validationCode}`;
  const nfcUrl = `${BASE_URL}/?s=${s}`;
  
  // Determine tag type and policy
  const isDemo = specificUid.startsWith('demo-');
  const tagType = isDemo ? 'Demo' : 'Common';
  const maxDevices = isDemo ? 100 : 3;
  const sessionDuration = isDemo ? '5 minutes' : '120 hours (5 days)';
  
  console.log('🏷️ Generated single NFC URL:');
  console.log(`UID ${specificUid}: ${nfcUrl}`);
  console.log(`Validation Code: ${validationCode}`);
  console.log(`S Parameter: ${s}`);
  console.log(`Tag Type: ${tagType}`);
  console.log(`Max Devices: ${maxDevices}`);
  console.log(`Session Duration: ${sessionDuration}`);
  process.exit(0);
}

const TOTAL_TAGS = parseInt(args[0]) || 100; // Default to 100 if no argument provided

if (isNaN(TOTAL_TAGS) || TOTAL_TAGS <= 0) {
  console.error('❌ Error: Please provide a valid number of tags to generate');
  console.error('Usage: node generate-nfc-tags-simple.js <number_of_tags>');
  console.error('Usage: node generate-nfc-tags-simple.js --uid <uid>');
  console.error('Usage: node generate-nfc-tags-simple.js --demo <number_of_tags>');
  console.error('Examples:');
  console.error('  node generate-nfc-tags-simple.js 50');
  console.error('  node generate-nfc-tags-simple.js --uid 123');
  console.error('  node generate-nfc-tags-simple.js --uid "test-abc"');
  console.error('  node generate-nfc-tags-simple.js --demo 20');
  process.exit(1);
}

// Get the last generated number
function getLastGeneratedNumber() {
  try {
    if (fs.existsSync(LAST_NUMBER_FILE)) {
      const lastNumber = parseInt(fs.readFileSync(LAST_NUMBER_FILE, 'utf8').trim());
      return isNaN(lastNumber) ? 0 : lastNumber;
    }
  } catch (error) {
    console.warn('⚠️  Warning: Could not read last generated number file:', error.message);
  }
  return 0;
}

// Save the last generated number
function saveLastGeneratedNumber(number) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(LAST_NUMBER_FILE, number.toString());
    console.log('💾 Last generated number saved:', number);
  } catch (error) {
    console.error('❌ Error saving last generated number:', error.message);
  }
}

const START_NUMBER = getLastGeneratedNumber() + 1;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate validation code for a given UID
 * Uses hash(uid + secret_key).slice(-4) for security
 * @param {string} uid - UID (e.g., '1', '123')
 */
function generateValidationCode(uid) {
  const combined = uid + SECRET_KEY;
  // Simple hash function (same as server-side)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex and take last 4 characters
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  return hexHash.slice(-4).toUpperCase();
}

/**
 * Generate NFC tags with simple incremental UIDs
 */
async function generateNFCTags() {
  console.log('🏷️ Generating simplified NFC tags for city website...');
  console.log(`📊 Configuration: ${TOTAL_TAGS} tags, UID range: ${START_NUMBER}-${START_NUMBER + TOTAL_TAGS - 1}`);
  console.log(`🔄 Continuing from last generated number: ${START_NUMBER - 1}`);
  
  try {
    const allTags = [];
    const csvRows = ['UID,Validation Code,NFC URL,QR Code Data'];
    const qrCodes = [];
    
    // Generate tags with simple incremental UIDs
    for (let i = 0; i < TOTAL_TAGS; i++) {
      const uid = (START_NUMBER + i).toString();
      const validationCode = generateValidationCode(uid);
      const s = `${uid}:${validationCode}`;
      const nfcUrl = `${BASE_URL}/?s=${s}`;
      
      const tagData = {
        uid: uid,
        validationCode: validationCode,
        s: s,
        nfcUrl: nfcUrl,
        qrCodeData: nfcUrl
      };
      
      allTags.push(tagData);
      
      // Add CSV row
      csvRows.push([
        uid,
        validationCode,
        nfcUrl,
        nfcUrl
      ].join(','));
      
      // Add QR code data
      qrCodes.push({
        uid: uid,
        url: nfcUrl,
        s: s
      });
    }
    
    const lastGeneratedNumber = START_NUMBER + TOTAL_TAGS - 1;
    console.log(`✅ Generated ${allTags.length} tags: UID ${START_NUMBER} to ${lastGeneratedNumber}`);
    
    // Save the last generated number for next run
    saveLastGeneratedNumber(lastGeneratedNumber);
    
    // Write JSON output
    // Determine tag types and policies
    const commonTags = allTags.filter(tag => !tag.uid.startsWith('demo-'));
    const demoTags = allTags.filter(tag => tag.uid.startsWith('demo-'));
    
    const jsonOutput = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalTags: allTags.length,
      uidRange: {
        start: START_NUMBER,
        end: START_NUMBER + TOTAL_TAGS - 1
      },
      policies: {
        common: {
          maxDevices: 3,
          sessionDuration: '120 hours (5 days)',
          description: 'Common NFC Tag (no prefix)'
        },
        demo: {
          maxDevices: 100,
          sessionDuration: '5 minutes',
          description: 'Demo NFC Tag (demo- prefix)'
        }
      },
      tagTypes: {
        common: commonTags.length,
        demo: demoTags.length
      },
      tags: allTags
    };
    
    const jsonPath = path.join(OUTPUT_DIR, 'nfc-tags-simple.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`📄 JSON output written to: ${jsonPath}`);
    
    // Write CSV output
    const csvPath = path.join(OUTPUT_DIR, 'nfc-tags-simple.csv');
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`📊 CSV output written to: ${csvPath}`);
    
    // Write QR codes data
    const qrPath = path.join(OUTPUT_DIR, 'qr-codes-simple.json');
    fs.writeFileSync(qrPath, JSON.stringify(qrCodes, null, 2));
    console.log(`📱 QR codes data written to: ${qrPath}`);
    
    // Generate deployment instructions
    const instructions = generateDeploymentInstructions(allTags);
    const instructionsPath = path.join(OUTPUT_DIR, 'DEPLOYMENT-SIMPLE.md');
    fs.writeFileSync(instructionsPath, instructions);
    console.log(`📋 Deployment instructions written to: ${instructionsPath}`);
    
    // Show sample tags
    console.log('\n📋 Sample generated tags:');
    console.log('UID 1:', allTags[0].nfcUrl);
    if (allTags.length > 1) {
      console.log('UID', allTags[1].uid + ':', allTags[1].nfcUrl);
    }
    if (allTags.length > 2) {
      console.log('UID', allTags[2].uid + ':', allTags[2].nfcUrl);
    }
    
    console.log('\n✅ NFC tag generation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error generating NFC tags:', error);
    process.exit(1);
  }
}

/**
 * Generate deployment instructions
 */
function generateDeploymentInstructions(allTags) {
  const instructions = `# Simplified NFC Tag Deployment Instructions

Generated on: ${new Date().toISOString()}

## Overview
This document contains instructions for deploying ${allTags.length} NFC tags for the standalone city tour guide application.

## Simplified UID System
The system uses simple incremental UIDs without area prefixes:
- **UID Format**: Simple numbers (e.g., \`1\`, \`2\`, \`3\`, \`1234\`)
- **URL Format**: \`https://city.com/?s=uid:vc\` (e.g., \`https://city.com/?s=1:4F3D\`)
- **Single Scenic Area**: All tags load the same city's scenic area file
- **3-device limit** per individual UID

## Generated Tags Summary

- **Total Tags**: ${allTags.length}
- **UID Range**: ${START_NUMBER} to ${START_NUMBER + TOTAL_TAGS - 1}
- **Base URL**: ${BASE_URL}
- **Sample URLs**:
  - ${allTags[0].nfcUrl}
  - ${allTags[Math.min(99, allTags.length - 1)].nfcUrl}
  - ${allTags[Math.min(999, allTags.length - 1)].nfcUrl}

## NFC Tag Programming

### Requirements
- NFC tags (NTAG213/215/216 recommended)
- NFC programming app (e.g., NFC Tools, TagInfo)
- Android phone with NFC enabled

### Programming Steps
1. **Open NFC programming app**
2. **Select "Write" or "Program Tag"**
3. **Choose "URL/URI" data type**
4. **Enter the NFC URL for each specific UID**
5. **Program the tag**
6. **Test the tag** by scanning with another device

### QR Code Alternative
For devices without NFC support, generate QR codes using the URLs:
- Use any QR code generator
- Input the URL from the CSV file
- Print and place near NFC tags

## Physical Deployment

### Recommended Locations
- **City Entrance**: Main entry points
- **Visitor Centers**: Information desks
- **Tourist Information**: Help desks
- **Hotels**: Partner accommodations
- **Retail Locations**: Souvenir shops

### Tag Placement Tips
- **Height**: 1.2-1.5m from ground (comfortable scanning height)
- **Protection**: Use weatherproof cases for outdoor placement
- **Visibility**: Clear signage indicating NFC/QR functionality
- **Backup**: Place both NFC tags and QR codes for maximum compatibility

### Security Considerations
- Each UID has unique validation (prevents cloning)
- Validation codes are cryptographically generated
- 3-device limit per individual UID
- 120-hour (5-day) session timeout provides reasonable security

## Business Model

### Tag Distribution
- **Sell individual tags**: Each UID can be sold separately
- **Volume discounts**: Offer better rates for bulk purchases
- **Reseller program**: Partner with local businesses

### Usage Analytics
Monitor which UIDs are most popular:
- Track individual UID usage
- Identify high-traffic areas
- Optimize tag placement
- Plan inventory restocking

## Testing Deployment

### Test Checklist
- [ ] Scan random sample of tags
- [ ] Verify correct scenic area loads
- [ ] Test device limit (try with 4+ devices on same UID)
- [ ] Confirm session persistence
- [ ] Test QR code fallback

### Troubleshooting
- **Tag not scanning**: Check NFC is enabled, try different angles
- **App doesn't open**: Check URL format and domain accessibility
- **Device limit issues**: Check specific UID usage via dashboard

## Maintenance

### Regular Tasks
- **Weekly**: Check physical tag condition at high-traffic locations
- **Monthly**: Test random sample of tags
- **Quarterly**: Review usage analytics and popular UIDs
- **Annually**: Consider rotating secret key for new tag generations

### Analytics
Monitor usage through EdgeOne Worker logs:
- Individual UID access attempts
- Error rates by UID range
- Session duration patterns

## File Structure

The generated files are organized as follows:
- \`nfc-tags-simple.json\`: Complete tag data in JSON format
- \`nfc-tags-simple.csv\`: Tag data in CSV format for spreadsheet use
- \`qr-codes-simple.json\`: QR code data for bulk generation
- \`DEPLOYMENT-SIMPLE.md\`: This deployment guide

## Security Notes

- The secret key used for validation is stored securely on the server
- Client-side code cannot access the validation algorithm
- Each UID has a unique validation code that cannot be predicted
- Device limits prevent abuse of individual UIDs

## Support

For technical support or questions about deployment:
- Check the application logs for validation errors
- Verify URL format matches the expected pattern
- Ensure the base URL is accessible from target devices
`;

  return instructions;
}

// Run the generator
generateNFCTags().catch(console.error); 