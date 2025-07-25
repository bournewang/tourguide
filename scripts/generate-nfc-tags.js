#!/usr/bin/env node

/**
 * NFC Tag Generator Script
 * Generates NFC tag URLs with UID and validation codes for all Kaifeng scenic areas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAvailableAreaPrefixes, generateAreaTags } from '../src/utils/nfcValidation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'https://shuyuan.qingfan.wang' //'https://daoyou.com';
const OUTPUT_DIR = path.join(__dirname, '../nfc-tags');

// Number of tags to generate per area
const TAGS_PER_AREA = 50; // Generate 50 tags per area (can be adjusted)

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate NFC tags for all available scenic areas
 */
async function generateNFCTags() {
  console.log('🏷️ Generating incremental NFC tags for scenic areas...');
  
  try {
    // Get all available area prefixes
    const areaPrefixes = getAvailableAreaPrefixes();
    console.log(`📋 Found ${areaPrefixes.length} scenic areas:`, areaPrefixes.map(a => a.prefix));
    
    const allTags = [];
    const csvRows = ['UID,Area Prefix,Number,Area Name,Description,Scenic Area File,Validation Code,NFC URL,QR Code Data'];
    const qrCodes = [];
    
    // Generate tags for each area
    for (const areaInfo of areaPrefixes) {
      console.log(`\n🔄 Generating ${TAGS_PER_AREA} tags for ${areaInfo.prefix} (${areaInfo.name})...`);
      
      const areaTags = generateAreaTags(areaInfo.prefix, 1, TAGS_PER_AREA);
      
      for (const tag of areaTags) {
        const nfcUrl = `${BASE_URL}/?uid=${tag.uid}&vc=${tag.validationCode}`;
        
        const tagData = {
          uid: tag.uid,
          areaPrefix: tag.areaPrefix,
          number: tag.number,
          areaName: tag.areaName,
          description: tag.description,
          scenicAreaFile: tag.scenicAreaFile,
          validationCode: tag.validationCode,
          nfcUrl: nfcUrl,
          qrCodeData: nfcUrl
        };
        
        allTags.push(tagData);
        
        // Add CSV row
        csvRows.push([
          tag.uid,
          tag.areaPrefix,
          tag.number,
          tag.areaName,
          tag.description,
          tag.scenicAreaFile,
          tag.validationCode,
          nfcUrl,
          nfcUrl
        ].join(','));
        
        // Add QR code data
        qrCodes.push({
          uid: tag.uid,
          areaPrefix: tag.areaPrefix,
          number: tag.number,
          areaName: tag.areaName,
          url: nfcUrl,
          description: tag.description
        });
      }
      
      console.log(`✅ Generated ${areaTags.length} tags for ${areaInfo.prefix}: ${areaInfo.prefix}-1 to ${areaInfo.prefix}-${TAGS_PER_AREA}`);
    }
    
    // Write JSON output
    const jsonOutput = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      tagsPerArea: TAGS_PER_AREA,
      totalTags: allTags.length,
      areaCount: areaPrefixes.length,
      tags: allTags
    };
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'nfc-tags.json'),
      JSON.stringify(jsonOutput, null, 2),
      'utf8'
    );
    
    // Write CSV output
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'nfc-tags.csv'),
      csvRows.join('\n'),
      'utf8'
    );
    
    // Write QR codes data
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'qr-codes.json'),
      JSON.stringify(qrCodes, null, 2),
      'utf8'
    );
    
    // Generate area-specific files
    for (const areaInfo of areaPrefixes) {
      const areaTags = allTags.filter(tag => tag.areaPrefix === areaInfo.prefix);
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `nfc-tags-${areaInfo.prefix.toLowerCase()}.json`),
        JSON.stringify(areaTags, null, 2),
        'utf8'
      );
    }
    
    // Generate deployment instructions
    const instructions = generateDeploymentInstructions(allTags, areaPrefixes);
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'DEPLOYMENT_INSTRUCTIONS.md'),
      instructions,
      'utf8'
    );
    
    console.log('\n🎉 NFC tag generation completed successfully!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log(`🏷️ Total tags generated: ${allTags.length}`);
    console.log(`📊 Tags per area: ${TAGS_PER_AREA}`);
    console.log('\n📝 Generated files:');
    console.log('   - nfc-tags.json              (Complete tag data)');
    console.log('   - nfc-tags.csv               (For spreadsheet import)');
    console.log('   - qr-codes.json              (QR code data)');
    areaPrefixes.forEach(area => {
      console.log(`   - nfc-tags-${area.prefix.toLowerCase()}.json        (${area.prefix} area only)`);
    });
    console.log('   - DEPLOYMENT_INSTRUCTIONS.md (Setup guide)');
    
    // Display sample URLs
    console.log('\n🔗 Sample NFC URLs:');
    areaPrefixes.forEach(area => {
      const firstTag = allTags.find(tag => tag.areaPrefix === area.prefix);
      const lastTag = allTags.filter(tag => tag.areaPrefix === area.prefix).pop();
      console.log(`   ${area.prefix}: ${firstTag.nfcUrl} ... ${lastTag.nfcUrl}`);
    });
    
    return allTags;
    
  } catch (error) {
    console.error('❌ Failed to generate NFC tags:', error);
    throw error;
  }
}

/**
 * Generate deployment instructions
 */
function generateDeploymentInstructions(allTags, areaPrefixes) {
  const instructions = `# NFC Tag Deployment Instructions

Generated on: ${new Date().toISOString()}

## Overview
This document contains instructions for deploying ${allTags.length} NFC tags for the tour guide application.

## Incremental UID System
The system uses incremental UIDs for selling multiple tags per area:
- **UID Format**: \`{AreaPrefix}-{Number}\` (e.g., \`KF-1\`, \`DF-145\`)
- **Area-based validation**: Each UID loads the correct scenic area file
- **Scalable**: Generate as many tags as needed per area
- **3-device limit** per individual UID

## Generated Tags Summary

${areaPrefixes.map(area => {
  const areaTags = allTags.filter(tag => tag.areaPrefix === area.prefix);
  return `### ${area.prefix} - ${area.name}
- **Description**: ${area.description}
- **Scenic Area File**: ${area.scenicAreaFile}
- **Tag Range**: ${area.prefix}-1 to ${area.prefix}-${areaTags.length}
- **Total Tags**: ${areaTags.length}
- **Sample URLs**:
  - ${areaTags[0].nfcUrl}
  - ${areaTags[areaTags.length-1].nfcUrl}`;
}).join('\n\n')}

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
- **Scenic Area Entrance**: Main entry points
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
- 3-device limit per individual UID (not per area)
- 8-hour session timeout provides reasonable security

## Business Model

### Tag Distribution
- **Sell individual tags**: Each UID can be sold separately
- **Area-specific packages**: Bundle tags by scenic area
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
- [ ] Scan random sample of tags from each area
- [ ] Verify correct scenic area loads for each prefix
- [ ] Test device limit (try with 4+ devices on same UID)
- [ ] Confirm session persistence
- [ ] Test QR code fallback

### Troubleshooting
- **Tag not scanning**: Check NFC is enabled, try different angles
- **Wrong area loads**: Verify tag was programmed with correct URL
- **App doesn't open**: Check URL format and domain accessibility
- **Device limit issues**: Check specific UID usage via dashboard

## Maintenance

### Regular Tasks
- **Weekly**: Check physical tag condition at high-traffic locations
- **Monthly**: Test random sample of tags from each batch
- **Quarterly**: Review usage analytics and popular UIDs
- **Annually**: Consider rotating secret key for new tag generations

### Analytics
Monitor usage through Cloudflare Worker logs:
- Individual UID access attempts
- Area popularity comparison
- Error rates by UID range
- Session duration patterns

## File Structure

The generated files are organized as follows:
- \`nfc-tags.json\` - Complete database of all tags
- \`nfc-tags.csv\` - Spreadsheet format for easy import
- \`qr-codes.json\` - QR code data for backup access
${areaPrefixes.map(area => `- \`nfc-tags-${area.prefix.toLowerCase()}.json\` - ${area.prefix} area tags only`).join('\n')}

---

For technical support or questions, contact the development team.
Total tags generated: ${allTags.length} (${TAGS_PER_AREA} per area)
`;
  
  return instructions;
}

// Run the generator
if (import.meta.url === `file://${process.argv[1]}`) {
  generateNFCTags()
    .then(() => {
      console.log('\n✨ NFC tag generation process completed!');
    })
    .catch(error => {
      console.error('\n💥 NFC tag generation failed:', error.message);
    });
}

export { generateNFCTags }; 