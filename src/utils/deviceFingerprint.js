// Device Fingerprinting Utility
// Creates unique fingerprint for mobile devices to limit access per UID

/**
 * Generate a unique device fingerprint
 * Combines multiple device characteristics for identification
 * @returns {Promise<string>} - Base64 encoded device fingerprint
 */
export async function generateDeviceFingerprint() {
  try {
    const fingerprint = {
      // Screen characteristics
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      
      // User agent (browser/device info)
      userAgent: navigator.userAgent,
      
      // Language and locale
      language: navigator.language,
      languages: navigator.languages?.join(',') || '',
      
      // Platform information
      platform: navigator.platform,
      
      // Timezone
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      
      // Hardware information (if available)
      memory: navigator.deviceMemory || 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown',
      
      // Touch capability
      touch: 'ontouchstart' in window ? 'yes' : 'no',
      
      // WebGL fingerprint (for additional uniqueness)
      webgl: await getWebGLFingerprint(),
      
      // Canvas fingerprint (lightweight version)
      canvas: getCanvasFingerprint()
    };

    // Create stable hash from all characteristics
    const fingerprintString = JSON.stringify(fingerprint);
    console.log('fingerprintString', fingerprintString);
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Return first 16 characters for reasonable uniqueness and storage efficiency
    return hashHex.substring(0, 16);

  } catch (error) {
    console.error('Error generating device fingerprint:', error);
    // Fallback to basic fingerprint
    return generateBasicFingerprint();
  }
}

/**
 * Get WebGL fingerprint for additional device uniqueness
 * @returns {string} - WebGL renderer information
 */
async function getWebGLFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return 'no-webgl';
    
    const renderer = gl.getParameter(gl.RENDERER);
    const vendor = gl.getParameter(gl.VENDOR);
    
    return `${vendor}-${renderer}`.substring(0, 50); // Limit length
    
  } catch (error) {
    console.warn('WebGL fingerprinting failed:', error);
    return 'webgl-error';
  }
}

/**
 * Generate canvas fingerprint
 * @returns {string} - Canvas rendering fingerprint
 */
function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Draw text with specific font and style
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillText('Device Fingerprint 🔍', 2, 2);
    
    // Draw some shapes
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillRect(100, 5, 80, 20);
    
    // Get data URL and extract meaningful part
    const dataURL = canvas.toDataURL();
    const encoder = new TextEncoder();
    const data = encoder.encode(dataURL);
    
    // Simple hash of canvas data
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16).substring(0, 8);
    
  } catch (error) {
    console.warn('Canvas fingerprinting failed:', error);
    return 'canvas-error';
  }
}

/**
 * Generate basic fallback fingerprint
 * @returns {string} - Basic device fingerprint
 */
function generateBasicFingerprint() {
  const basic = {
    screen: `${screen.width}x${screen.height}`,
    userAgent: navigator.userAgent.substring(0, 100), // Limit length
    language: navigator.language,
    platform: navigator.platform,
    timestamp: Date.now().toString().substring(0, 8) // Add some entropy
  };
  
  const basicString = JSON.stringify(basic);
  let hash = 0;
  for (let i = 0; i < basicString.length; i++) {
    const char = basicString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16).substring(0, 16);
}

/**
 * Store device fingerprint in localStorage
 * @param {string} fingerprint - The device fingerprint
 */
export function storeDeviceFingerprint(fingerprint) {
  try {
    localStorage.setItem('device_fingerprint', fingerprint);
    localStorage.setItem('fingerprint_generated', Date.now().toString());
  } catch (error) {
    console.error('Error storing device fingerprint:', error);
  }
}

/**
 * Retrieve stored device fingerprint
 * @returns {string|null} - Stored fingerprint or null if not found
 */
export function getStoredDeviceFingerprint() {
  try {
    return localStorage.getItem('device_fingerprint');
  } catch (error) {
    console.error('Error retrieving device fingerprint:', error);
    return null;
  }
}

/**
 * Get or generate device fingerprint
 * Uses stored fingerprint if available, otherwise generates new one
 * @returns {Promise<string>} - Device fingerprint
 */
export async function getDeviceFingerprint() {
  // Check if we have a stored fingerprint
  const stored = getStoredDeviceFingerprint();
  if (stored) {
    return stored;
  }
  
  // Generate new fingerprint
  const fingerprint = await generateDeviceFingerprint();
  storeDeviceFingerprint(fingerprint);
  
  return fingerprint;
}

/**
 * Check if current device matches stored fingerprint
 * @returns {Promise<boolean>} - Whether device matches stored fingerprint
 */
export async function isConsistentDevice() {
  const stored = getStoredDeviceFingerprint();
  if (!stored) return false;
  
  const current = await generateDeviceFingerprint();
  return stored === current;
} 