// Utility to get validation status from session data
export const getValidationStatus = () => {
  try {
    const sessionData = localStorage.getItem('nfc_session');
    if (!sessionData) {
      return null;
    }
    
    const session = JSON.parse(sessionData);
    const now = Date.now();
    
    // Check if session is expired
    if (now > session.expiresAt) {
      return null;
    }
    
    return {
      uid: session.uid,
      areaName: session.areaName,
      deviceId: session.deviceId,
      deviceCount: session.validationResult?.deviceCount || 1,
      maxDevices: session.validationResult?.maxDevices || 3,
      isNewDevice: session.validationResult?.isNewDevice || false,
      timestamp: session.timestamp,
      expiresAt: session.expiresAt,
      timeRemaining: Math.round((session.expiresAt - now) / (1000 * 60 * 60)) // hours
    };
  } catch (error) {
    console.error('Error getting validation status:', error);
    return null;
  }
};

// Format validation status for display
export const formatValidationStatus = (status) => {
  if (!status) {
    return '未验证';
  }
  
  const deviceText = status.deviceCount === 1 ? '1 台设备' : `${status.deviceCount} 台设备`;
  const maxText = `最多 ${status.maxDevices} 台`;
  const newDeviceText = status.isNewDevice ? ' (新设备)' : '';
  const timeText = status.timeRemaining > 0 ? `，${status.timeRemaining}小时后过期` : '';
  
  return `${deviceText} / ${maxText}${newDeviceText}${timeText}`;
}; 