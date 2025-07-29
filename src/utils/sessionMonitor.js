// Session monitoring utility
// Continuously monitors session expiry and forces logout when needed

import { getValidationStatus } from './validationStatus';

class SessionMonitor {
  constructor() {
    this.checkInterval = null;
    this.checkIntervalMs = 30 * 1000; // Check every 30 seconds
    this.warningThresholdMs = 2 * 60 * 1000; // Show warning 2 minutes before expiry
    this.isMonitoring = false;
    this.onSessionExpired = null;
    this.onSessionWarning = null;
  }

  /**
   * Start monitoring session expiry
   * @param {Function} onExpired - Callback when session expires
   * @param {Function} onWarning - Callback when session is about to expire
   */
  startMonitoring(onExpired, onWarning) {
    if (this.isMonitoring) {
      console.log('Session monitor already running');
      return;
    }

    this.onSessionExpired = onExpired;
    this.onSessionWarning = onWarning;
    this.isMonitoring = true;

    console.log('🔍 Starting session expiry monitoring (checking every 30s)');
    
    // Check immediately
    this.checkSession();
    
    // Set up periodic checking
    this.checkInterval = setInterval(() => {
      this.checkSession();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring session expiry
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isMonitoring = false;
    this.onSessionExpired = null;
    this.onSessionWarning = null;
    console.log('🔍 Stopped session expiry monitoring');
  }

  /**
   * Restart monitoring with new callbacks
   * Useful when a new session is created
   */
  restartMonitoring(onExpired, onWarning) {
    console.log('🔄 Restarting session monitoring');
    this.stopMonitoring();
    this.startMonitoring(onExpired, onWarning);
  }

  /**
   * Check current session status
   */
  checkSession() {
    const validationInfo = getValidationStatus();
    
    if (!validationInfo) {
      // No valid session found
      if (this.onSessionExpired) {
        console.log('⏰ Session expired or not found, triggering logout');
        this.onSessionExpired();
      }
      return;
    }

    const now = Date.now();
    const timeUntilExpiry = validationInfo.expiresAt - now;
    
    // Check if session has expired
    if (timeUntilExpiry <= 0) {
      console.log('⏰ Session has expired, triggering logout');
      if (this.onSessionExpired) {
        this.onSessionExpired();
      }
      return;
    }

    // Check if session is about to expire (within warning threshold) - DISABLED
    if (timeUntilExpiry <= this.warningThresholdMs && timeUntilExpiry > 0) {
      const minutesLeft = Math.round(timeUntilExpiry / (1000 * 60));
      console.log(`⚠️ Session expires in ${minutesLeft} minutes (warning disabled)`);
      
      // Warning functionality disabled for better UX
      // if (this.onSessionWarning) {
      //   this.onSessionWarning({
      //     minutesLeft,
      //     timeUntilExpiry,
      //     validationInfo
      //   });
      // }
    }
  }

  /**
   * Get current session status
   * @returns {Object|null} Session status or null if expired
   */
  getCurrentStatus() {
    return getValidationStatus();
  }

  /**
   * Force logout by clearing session
   */
  forceLogout() {
    console.log('🚪 Force logging out user');
    localStorage.removeItem('nfc_session');
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('session-expired'));
    
    // Reload page to reset app state
    window.location.reload();
  }
}

// Create singleton instance
const sessionMonitor = new SessionMonitor();

export default sessionMonitor; 