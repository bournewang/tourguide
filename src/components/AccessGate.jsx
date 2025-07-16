import React, { useEffect, useState } from 'react';
import { validateNFCAccess } from '../utils/nfcValidation';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { setScenicAreaFile } from '../utils/dataService';
import { ttsService } from '../utils/ttsService';

const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

const AccessGate = ({ children }) => {
  const [validationState, setValidationState] = useState('checking'); // checking, valid, invalid
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApp, setShowApp] = useState(false);
  const [backgroundValidating, setBackgroundValidating] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      setLoading(true);
      
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const uid = urlParams.get('uid');
      const vc = urlParams.get('vc');
      const adminParam = urlParams.get('admin');
      
      console.log('🔍 URL parameters:', { uid, vc, admin: adminParam });
      
      // Admin bypass for development
      if (adminParam === '1') {
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
        // Set scenic area file from session
        setScenicAreaFile(existingSession.scenicAreaFile);
        setValidationState('valid');
        setShowApp(true);
        setLoading(false);
        return;
      }
      
      // Check if we have NFC parameters
      if (uid && vc) {
        console.log('🏷️ NFC parameters found, showing app and validating in background...');
        
        // Show app immediately
        setShowApp(true);
        setLoading(false);
        setBackgroundValidating(true);
        
        // Start background validation
        validateNFCParametersBackground(uid, vc);
      } else {
        console.log('❌ No NFC parameters and no valid session');
        setError({
          type: 'NO_NFC_ACCESS',
          message: '请使用导游手环访问本应用',
          details: '本应用需要通过导游手环进行访问验证'
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

  const validateNFCParametersBackground = async (uid, vc) => {
    try {
      // Step 1: Validate NFC parameters using area-level validation
      console.log('🔐 Background Step 1: Validating NFC parameters...');
      const nfcValidation = validateNFCAccess(uid, vc);
      
      if (!nfcValidation.isValid) {
        console.log('❌ Background NFC validation failed:', nfcValidation.error);
        setError({
          type: nfcValidation.error,
          message: nfcValidation.message,
          details: `手环编号: ${uid}`
        });
        setValidationState('invalid');
        setBackgroundValidating(false);
        return;
      }
      
      console.log('✅ Background NFC validation successful for area:', nfcValidation.areaName);
      
      // Step 2: Set the scenic area file for this area
      console.log('🏞️ Background Step 2: Setting scenic area file:', nfcValidation.scenicAreaFile);
      setScenicAreaFile(nfcValidation.scenicAreaFile);
      
      // Step 3: Get device fingerprint
      console.log('📱 Background Step 3: Getting device fingerprint...');
      const deviceId = await getDeviceFingerprint();
      console.log('📱 Device fingerprint:', deviceId);
      
      // Step 4: Check device access with Cloudflare Worker
      console.log('☁️ Background Step 4: Checking device access...');
      const validationResult = await ttsService.validateDeviceAccess(uid, deviceId, 3);
      
      if (!validationResult.success) {
        console.log('❌ Background device access validation failed:', validationResult);
        
        if (validationResult.error === 'Device limit exceeded') {
          setError({
            type: 'DEVICE_LIMIT_EXCEEDED',
            message: '设备数量已达上限',
            details: `该UID已绑定${validationResult.deviceCount}台设备，最多允许${validationResult.maxDevices}台`
          });
        } else {
          setError({
            type: 'ACCESS_DENIED',
            message: '访问被拒绝',
            details: validationResult.error || '设备验证失败'
          });
        }
        setValidationState('invalid');
        setBackgroundValidating(false);
        return;
      }
      
      console.log('✅ Background device access granted:', validationResult.data);
      
      // Step 5: Store session and redirect
      console.log('💾 Background Step 5: Storing session...');
      const sessionData = {
        uid,
        areaPrefix: nfcValidation.areaPrefix,
        areaName: nfcValidation.areaName,
        scenicAreaFile: nfcValidation.scenicAreaFile,
        deviceId,
        timestamp: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION,
        // Store validation result for display
        validationResult: {
          deviceCount: validationResult.data?.deviceCount || 1,
          maxDevices: validationResult.data?.maxDevices || 3,
          isNewDevice: validationResult.data?.isNewDevice || false
        }
      };
      
      localStorage.setItem('nfc_session', JSON.stringify(sessionData));
      console.log('💾 Background session stored successfully');
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('nfc-session-updated', { 
        detail: sessionData 
      }));
      
      // Step 6: Clean URL (remove NFC parameters)
      console.log('🧹 Background Step 6: Cleaning URL...');
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
        areaName: session.areaName,
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