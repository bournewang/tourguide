import React, { useEffect, useState } from 'react';

import { getDeviceFingerprint } from '../utils/deviceFingerprint';

import sessionMonitor from '../utils/sessionMonitor';

// Default session duration (will be overridden by API response)
const DEFAULT_SESSION_DURATION = 120 * 60 * 60 * 1000; // 120 hours（5 days) in milliseconds

const AccessGate = ({ children }) => {
  const [validationState, setValidationState] = useState('checking'); // checking, valid, invalid
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApp, setShowApp] = useState(false);
  const [backgroundValidating, setBackgroundValidating] = useState(false);
  


  useEffect(() => {
    checkAccess();
  }, []);

  // Session monitoring effect
  useEffect(() => {
    if (import.meta.env.DEV) {
      return;
    }
    // Start session monitoring when validation is valid
    if (validationState === 'valid') {
      sessionMonitor.startMonitoring(
        // On session expired
        () => {
          console.log('Session expired, using existing error mechanism');
          const expiredMessage = getSessionExpiredMessage();
          localStorage.removeItem('nfc_session');
          setValidationState('invalid');
          setError({
            type: 'NO_NFC_ACCESS',
            message: expiredMessage,
            // details: '您的访问会话已过期，请重新扫描导游手环进行验证'
          });
        },
        // On session warning (disabled for better UX)
        (warningData) => {
          console.log('Session warning triggered (disabled):', warningData);
        }
      );
    }

    // Listen for new session creation (when NFC is re-scanned)
    const handleNewSession = () => {
      if (import.meta.env.DEV) {
        return;
      }
      console.log('New session created, restarting monitoring');
      
      // Restart monitoring with new session
      sessionMonitor.restartMonitoring(
        // On session expired
        () => {
          console.log('Session expired, using existing error mechanism');
          const expiredMessage = getSessionExpiredMessage();
          localStorage.removeItem('nfc_session');
          setValidationState('invalid');
          setError({
            type: 'NO_NFC_ACCESS',
            message: expiredMessage,
            // details: '您的访问会话已过期，请重新扫描导游手环进行验证'
          });
        },
        // On session warning (disabled for better UX)
        (warningData) => {
          console.log('Session warning triggered (disabled):', warningData);
        }
      );
    };

    window.addEventListener('nfc-session-updated', handleNewSession);

    return () => {
      sessionMonitor.stopMonitoring();
      window.removeEventListener('nfc-session-updated', handleNewSession);
    };
  }, [validationState]);

  const checkAccess = async () => {
    try {
      setLoading(true);
      
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const s = urlParams.get('s');
      const adminParam = urlParams.get('admin');
      
      console.log('🔍 URL parameters:', { s, admin: adminParam });
      
      // Admin bypass for development
      if (import.meta.env.DEV) {
        console.log('🔧 Admin bypass activated - skipping NFC validation');
        setValidationState('valid');
        setShowApp(true);
        setLoading(false);
        return;
      }
      
      // Check for existing valid session first
      const existingSession = checkExistingSession();
      if (existingSession) {
        console.log('✅ Valid existing session found');
        setValidationState('valid');
        setShowApp(true);
        setLoading(false);
        return;
      }
      
      // skip validate in dev mode
      if (import.meta.env.DEV) {
        setLoading(false);
        return;
      }
      // Check if we have NFC parameters
      if (s) {
        console.log('🏷️ NFC s parameter found, showing app and validating in background...');
        
        // Show app immediately
        setShowApp(true);
        setLoading(false);
        setBackgroundValidating(true);
        
        // Start background validation
        validateNFCParametersBackground(s);
      } else {
        console.log('❌ No NFC parameters and no valid session');
        setError({
          type: 'NO_NFC_ACCESS',
          message: '请使用导游手环访问本应用',
          // details: '本应用需要通过导游手环进行访问验证'
        });
        setValidationState('invalid');
        setShowApp(true); // Show app so error overlay can be displayed
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Access check failed:', error);
      setError({
        type: 'SYSTEM_ERROR',
        message: '系统错误',
        details: error.message
      });
      setValidationState('invalid');
      setShowApp(true); // Show app so error overlay can be displayed
      setLoading(false);
    }
  };

  const validateNFCParametersBackground = async (s) => {
    try {
      // Step 1: Get device fingerprint
      console.log('📱 Background Step 1: Getting device fingerprint...');
      const deviceId = await getDeviceFingerprint();
      console.log('📱 Device fingerprint:', deviceId);
      
      // Step 2: Validate NFC parameters and device access in single API call
      console.log('🔐 Background Step 2: Validating NFC parameters and device access via API...');
      const API_BASE = import.meta.env.VITE_WORKER_URL || 'https://df.qingfan.wang';
      const response = await fetch(`${API_BASE}/api/nfc/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          s,
          deviceFingerprint: deviceId,
          maxDevices: 3
        })
      });

      const nfcValidation = await response.json();
      
      if (!nfcValidation.success || !nfcValidation.isValid) {
        console.log('❌ Background NFC validation failed:', nfcValidation.error);
        setError({
          type: nfcValidation.error || 'VALIDATION_FAILED',
          message: nfcValidation.message || '验证失败',
          details: `验证参数: ${s}`
        });
        setValidationState('invalid');
        setBackgroundValidating(false);
        return;
      }
      
      // Check device access result
      if (nfcValidation.deviceAccess === false) {
        console.log('❌ Background device access denied:', nfcValidation);
        setError({
          type: nfcValidation.error || 'DEVICE_LIMIT_EXCEEDED',
          message: nfcValidation.message || '设备数量已达上限',
          details: `该UID已绑定${nfcValidation.deviceCount}台设备，最多允许${nfcValidation.maxDevices}台`
        });
        setValidationState('invalid');
        setBackgroundValidating(false);
        return;
      }
      
      console.log('✅ Background NFC validation and device access successful for UID:', nfcValidation.uid);
      
      // Step 3: Store session and redirect
      console.log('💾 Background Step 3: Storing session...');
      
      // Use session duration from API response, or fallback to default
      const sessionDuration = nfcValidation.sessionDuration || DEFAULT_SESSION_DURATION;
      console.log('⏰ Session duration:', sessionDuration, 'ms (', Math.round(sessionDuration / (1000 * 60)), 'minutes)');
      
      const sessionData = {
        uid: nfcValidation.uid,
        deviceId,
        timestamp: Date.now(),
        expiresAt: Date.now() + sessionDuration,
        // Store validation result for display
        validationResult: {
          deviceCount: nfcValidation.deviceCount || 1,
          maxDevices: nfcValidation.maxDevices || 3,
          isNewDevice: nfcValidation.reason === 'Under device limit',
          policy: nfcValidation.policy || 'Unknown'
        }
      };
      
      localStorage.setItem('nfc_session', JSON.stringify(sessionData));
      console.log('💾 Background session stored successfully');
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('nfc-session-updated', { 
        detail: sessionData 
      }));
      
      // Step 4: Clean URL (remove NFC parameters)
      console.log('🧹 Background Step 4: Cleaning URL...');
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      console.log('🧹 URL cleaned:', newUrl);
      
      setValidationState('valid');
      setBackgroundValidating(false);
      
    } catch (error) {
      console.error('❌ Background NFC validation error:', error);
      setError({
        type: 'VALIDATION_ERROR',
        message: '验证过程出错',
        details: error.message
      });
      setValidationState('invalid');
      setBackgroundValidating(false);
    }
  };



  const getSessionExpiredMessage = () => {
    try {
      const sessionData = localStorage.getItem('nfc_session');
      if (!sessionData) {
        return '会话已过期，请重新触碰导游手环打开使用';
      }
      
      const session = JSON.parse(sessionData);
      
      // Check if this was a demo tag based on UID or policy
      const isDemoTag = session?.uid?.startsWith('demo-') || 
                       session?.validationResult?.policy?.includes('Demo') ||
                       session?.validationResult?.policy?.includes('demo');
      
      if (isDemoTag) {
        return '试用已结束，请重新触碰导游手环打开使用';
      } else {
        return '会话已过期，请重新触碰导游手环打开使用';
      }
    } catch (error) {
      console.error('Error parsing session data for message:', error);
      return '会话已过期，请重新触碰导游手环打开使用';
    }
  };

  const checkExistingSession = () => {
    try {
      const sessionData = localStorage.getItem('nfc_session');
      if (!sessionData) {
        console.log('📭 No existing session found');
        return null;
      }
      
      const session = JSON.parse(sessionData);
      const now = Date.now();
      
      if (now > session.expiresAt) {
        console.log('⏰ Session expired');
        localStorage.removeItem('nfc_session');
        return null;
      }
      
      console.log('✅ Valid session found:', {
        timeLeft: Math.round((session.expiresAt - now) / (1000 * 60 * 60))
      });
      
      return session;
    } catch (error) {
      console.error('❌ Error checking session:', error);
      localStorage.removeItem('nfc_session');
      return null;
    }
  };

  const renderError = () => {
    const errorMessages = {
      'NO_NFC_ACCESS': {
        icon: '🏷️',
        title: '访问验证',
        subtitle: '需要通过导游手环访问'
      },
      'INVALID_AREA_PREFIX': {
        icon: '❌',
        title: '无效的景区代码',
        subtitle: '请检查导游手环'
      },
      'INVALID_VALIDATION_CODE': {
        icon: '🔐',
        title: '验证码错误',
        subtitle: '请使用有效的导游手环'
      },
      'DEVICE_LIMIT_EXCEEDED': {
        icon: '📱',
        title: '设备数量限制',
        subtitle: '已达最大设备数量'
      },
      'ACCESS_DENIED': {
        icon: '🚫',
        title: '访问被拒绝',
        subtitle: '设备验证失败'
      },
      'VALIDATION_ERROR': {
        icon: '⚠️',
        title: '验证错误',
        subtitle: '系统验证过程出错'
      },
      'SYSTEM_ERROR': {
        icon: '🔧',
        title: '系统错误',
        subtitle: '请稍后重试'
      }
    };

    const errorConfig = errorMessages[error?.type] || errorMessages['SYSTEM_ERROR'];

    return (
      <>
        <div className="text-6xl mb-4">{errorConfig.icon}</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{errorConfig.title}</h1>
        <p className="text-gray-600 mb-4">{errorConfig.subtitle}</p>
        {error?.message && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 font-medium">{error.message}</p>
            {error.details && (
              <p className="text-red-600 text-sm mt-1">{error.details}</p>
            )}
          </div>
        )}
        <button 
          onClick={() => window.location.reload()} 
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
        >
          重新尝试
        </button>
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-xl p-8 text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">验证访问权限</h2>
          <p className="text-gray-600">正在检查NFC访问权限...</p>
        </div>
      </div>
    );
  }

  if (!showApp) {
    return null;
  }

  // Show app with error overlay if validation failed
  if (validationState === 'invalid' && error) {
    // For NO_NFC_ACCESS (no parameters at all), show full-screen error
    if (error.type === 'NO_NFC_ACCESS') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
            {renderError()}
          </div>
        </div>
      );
    }
    
    // For other validation errors (device limits, etc.), show overlay over app
    return (
      <div className="relative">
        {/* Show app content in background */}
        <div className="filter blur-sm pointer-events-none">
          {children}
        </div>
        
        {/* Error overlay */}
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
            {renderError()}
          </div>
        </div>
      </div>
    );
  }

  // Show app with background validation indicator
  return (
    <div className="relative">
      {children}
      
      {/* Background validation indicator */}
      {backgroundValidating && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-40 border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin text-blue-500">🔄</div>
            <span>设备验证...</span>
          </div>
        </div>
      )}


    </div>
  );
};

export default AccessGate; 