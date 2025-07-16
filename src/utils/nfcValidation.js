import CryptoJS from 'crypto-js';

// Secret key for generating validation codes (keep this secure)
const SECRET_KEY = 'tourguide-2024-nfc-validation-key';

// Area prefix mapping to scenic area files
const AREA_PREFIX_MAPPING = {
  'KF': {
    name: 'Kaifeng',
    scenicAreaFile: 'scenic-area-kaifeng.json',
    description: '开封市景区'
  },
  'DF': {
    name: 'Dengfeng', 
    scenicAreaFile: 'scenic-area.json',
    description: '登封市景区'
  }
};

/**
 * Generate validation code for a given UID
 * Uses hash(uid + secret_key).slice(-4) for security
 * @param {string} uid - Complete UID (e.g., 'KF-1', 'DF-145')
 */
export function generateValidationCode(uid) {
  const combined = uid + SECRET_KEY;
  const hash = CryptoJS.SHA256(combined).toString();
  return hash.slice(-4).toUpperCase();
}

/**
 * Extract area prefix from UID
 * @param {string} uid - Complete UID (e.g., 'KF-1', 'DF-145')
 * @returns {string} - Area prefix (e.g., 'KF', 'DF')
 */
function getAreaPrefix(uid) {
  const parts = uid.split('-');
  return parts.length > 1 ? parts[0] : uid;
}

/**
 * Validate NFC parameters from URL
 * @param {string} uid - Complete UID (e.g., 'KF-1', 'DF-145') 
 * @param {string} vc - Validation code to check
 * @returns {Object} Validation result with area info
 */
export function validateNFCAccess(uid, vc) {
  console.log('🔐 Validating NFC access:', { uid, vc });
  
  // Extract area prefix to determine scenic area
  const areaPrefix = getAreaPrefix(uid);
  console.log('🏞️ Extracted area prefix:', areaPrefix);
  
  // Check if area prefix exists
  if (!AREA_PREFIX_MAPPING[areaPrefix]) {
    console.log('❌ Invalid area prefix:', areaPrefix);
    return {
      isValid: false,
      error: 'INVALID_AREA_PREFIX',
      message: '无效的地区代码'
    };
  }
  
  // Generate expected validation code for the complete UID
  const expectedVC = generateValidationCode(uid);
  console.log('🔍 Expected validation code:', expectedVC);
  
  // Check validation code
  if (vc !== expectedVC) {
    console.log('❌ Invalid validation code. Expected:', expectedVC, 'Got:', vc);
    return {
      isValid: false,
      error: 'INVALID_VALIDATION_CODE', 
      message: '验证码错误'
    };
  }
  
  const areaInfo = AREA_PREFIX_MAPPING[areaPrefix];
  console.log('✅ NFC validation successful for UID:', uid, 'Area:', areaInfo.name);
  
  return {
    isValid: true,
    uid: uid,
    areaPrefix: areaPrefix,
    areaName: areaInfo.name,
    scenicAreaFile: areaInfo.scenicAreaFile,
    description: areaInfo.description
  };
}

/**
 * Generate NFC tags for a specific area with incremental numbers
 * @param {string} areaPrefix - Area prefix (e.g., 'KF', 'DF')
 * @param {number} startNumber - Starting number (default: 1)
 * @param {number} count - Number of tags to generate (default: 10)
 */
export function generateAreaTags(areaPrefix, startNumber = 1, count = 10) {
  if (!AREA_PREFIX_MAPPING[areaPrefix]) {
    throw new Error(`Invalid area prefix: ${areaPrefix}`);
  }
  
  const areaInfo = AREA_PREFIX_MAPPING[areaPrefix];
  const tags = [];
  
  for (let i = 0; i < count; i++) {
    const number = startNumber + i;
    const uid = `${areaPrefix}-${number}`;
    const validationCode = generateValidationCode(uid);
    
    tags.push({
      uid,
      areaPrefix,
      number,
      validationCode,
      areaName: areaInfo.name,
      scenicAreaFile: areaInfo.scenicAreaFile,
      description: areaInfo.description
    });
  }
  
  return tags;
}

/**
 * Get all available area prefixes (for tag generation)
 */
export function getAvailableAreaPrefixes() {
  return Object.keys(AREA_PREFIX_MAPPING).map(prefix => ({
    prefix,
    ...AREA_PREFIX_MAPPING[prefix]
  }));
} 