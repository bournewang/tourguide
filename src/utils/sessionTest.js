// Session testing utilities
// For development and testing purposes only

import sessionMonitor from './sessionMonitor';

/**
 * Test session expiry by setting a short expiry time
 * @param {number} minutesFromNow - Minutes from now to set expiry
 */
export function testSessionExpiry(minutesFromNow = 1) {
  try {
    const sessionData = localStorage.getItem('nfc_session');
    if (!sessionData) {
      console.error('❌ No session found to test');
      return false;
    }

    const session = JSON.parse(sessionData);
    const newExpiryTime = Date.now() + (minutesFromNow * 60 * 1000);
    
    // Update session with new expiry time
    session.expiresAt = newExpiryTime;
    localStorage.setItem('nfc_session', JSON.stringify(session));
    
    console.log(`🧪 Test: Session will expire in ${minutesFromNow} minutes`);
    console.log(`⏰ New expiry time: ${new Date(newExpiryTime).toLocaleString()}`);
    
    // Trigger session check immediately
    sessionMonitor.checkSession();
    
    return true;
  } catch (error) {
    console.error('❌ Error testing session expiry:', error);
    return false;
  }
}

/**
 * Test session warning by setting expiry to warning threshold (DISABLED)
 * @param {number} minutesFromNow - Minutes from now to set expiry (should be <= 5)
 */
export function testSessionWarning(minutesFromNow = 3) {
  if (minutesFromNow > 5) {
    console.warn('⚠️ Warning threshold is 5 minutes, setting to 5 minutes');
    minutesFromNow = 5;
  }
  
  console.log('⚠️ Session warnings are disabled for better UX');
  return testSessionExpiry(minutesFromNow);
}

/**
 * Restore session to normal expiry time (120 hours)
 */
export function restoreSessionExpiry() {
  try {
    const sessionData = localStorage.getItem('nfc_session');
    if (!sessionData) {
      console.error('❌ No session found to restore');
      return false;
    }

    const session = JSON.parse(sessionData);
    const normalExpiryTime = Date.now() + (120 * 60 * 60 * 1000); // 120 hours
    
    // Update session with normal expiry time
    session.expiresAt = normalExpiryTime;
    localStorage.setItem('nfc_session', JSON.stringify(session));
    
    console.log('✅ Session expiry restored to normal (120 hours)');
    console.log(`⏰ New expiry time: ${new Date(normalExpiryTime).toLocaleString()}`);
    
    // Trigger session check immediately
    sessionMonitor.checkSession();
    
    return true;
  } catch (error) {
    console.error('❌ Error restoring session expiry:', error);
    return false;
  }
}

/**
 * Clear session warnings manually
 */
export function clearSessionWarnings() {
  try {
    // Dispatch event to clear warnings
    window.dispatchEvent(new CustomEvent('nfc-session-updated'));
    console.log('🧹 Session warnings cleared manually');
    return true;
  } catch (error) {
    console.error('❌ Error clearing session warnings:', error);
    return false;
  }
}

/**
 * Get current session info for debugging
 */
export function getSessionInfo() {
  try {
    const sessionData = localStorage.getItem('nfc_session');
    if (!sessionData) {
      console.log('📭 No session found');
      return null;
    }

    const session = JSON.parse(sessionData);
    const now = Date.now();
    const timeUntilExpiry = session.expiresAt - now;
    const hoursLeft = Math.round(timeUntilExpiry / (1000 * 60 * 60));
    const minutesLeft = Math.round(timeUntilExpiry / (1000 * 60));
    
    const info = {
      uid: session.uid,
      areaName: session.areaName,
      expiresAt: new Date(session.expiresAt).toLocaleString(),
      timeUntilExpiry: timeUntilExpiry,
      hoursLeft: hoursLeft,
      minutesLeft: minutesLeft,
      isExpired: timeUntilExpiry <= 0,
      isWarning: timeUntilExpiry <= (5 * 60 * 1000) && timeUntilExpiry > 0
    };
    
    console.log('📋 Session Info:', info);
    return info;
  } catch (error) {
    console.error('❌ Error getting session info:', error);
    return null;
  }
}

// Make functions available globally for testing
if (typeof window !== 'undefined') {
  window.testSessionExpiry = testSessionExpiry;
  window.testSessionWarning = testSessionWarning;
  window.restoreSessionExpiry = restoreSessionExpiry;
  window.getSessionInfo = getSessionInfo;
  window.clearSessionWarnings = clearSessionWarnings;
  
  console.log('🧪 Session testing utilities available:');
  console.log('  - window.testSessionExpiry(minutes)');
  console.log('  - window.testSessionWarning(minutes)');
  console.log('  - window.restoreSessionExpiry()');
  console.log('  - window.getSessionInfo()');
  console.log('  - window.clearSessionWarnings()');
} 