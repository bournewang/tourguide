import React, { useEffect, useState } from 'react';

function handleOrientation(event, setHeading, setRaw) {
  let h = null;
  let log = {
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
    webkitCompassHeading: event.webkitCompassHeading,
    webkitCompassAccuracy: event.webkitCompassAccuracy
  };
  setRaw(log);
  console.log('DirectionDebug: Orientation event received:', log);
  
  if (typeof event.webkitCompassHeading === 'number') {
    h = event.webkitCompassHeading;
    console.log('DirectionDebug: Using webkitCompassHeading:', h);
  } else if (typeof event.alpha === 'number') {
    h = 360 - event.alpha;
    console.log('DirectionDebug: Using alpha:', h);
  }
  if (typeof h === 'number' && !isNaN(h)) {
    setHeading((h + 360) % 360);
    console.log('DirectionDebug: Setting heading to:', (h + 360) % 360);
  }
}

function DirectionDebug() {
  const [heading, setHeading] = useState(0);
  const [raw, setRaw] = useState({});
  const [permission, setPermission] = useState('unknown');
  const [manualHeading, setManualHeading] = useState(0);

  useEffect(() => {
    console.log('DirectionDebug: Component mounted');
    console.log('DirectionDebug: User agent:', navigator.userAgent);
    console.log('DirectionDebug: DeviceOrientationEvent available:', !!window.DeviceOrientationEvent);
    
    function orientationListener(event) {
      handleOrientation(event, setHeading, setRaw);
    }
    
    // Clear any existing listeners first
    window.removeEventListener('deviceorientationabsolute', orientationListener, true);
    window.removeEventListener('deviceorientation', orientationListener, true);
    
    // Check if we're on a desktop device
    const isDesktop = !navigator.userAgent.match(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i);
    console.log('DirectionDebug: Is desktop device:', isDesktop);
    
    if (isDesktop) {
      console.log('DirectionDebug: Desktop device detected - orientation APIs may not work');
      setPermission('desktop');
      setRaw({
        message: 'Desktop device detected',
        userAgent: navigator.userAgent,
        note: 'Device orientation APIs typically only work on mobile devices with compass sensors'
      });
    } else if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      console.log('DirectionDebug: iOS permission required');
      setPermission('required');
    } else {
      console.log('DirectionDebug: No permission required, adding listeners');
      setPermission('not-required');
      window.addEventListener('deviceorientationabsolute', orientationListener, true);
      window.addEventListener('deviceorientation', orientationListener, true);
    }
    return () => {
      console.log('DirectionDebug: Component unmounting, removing listeners');
      window.removeEventListener('deviceorientationabsolute', orientationListener, true);
      window.removeEventListener('deviceorientation', orientationListener, true);
    };
  }, []);

  function requestPermission() {
    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      window.DeviceOrientationEvent.requestPermission().then(result => {
        setPermission(result);
        if (result === 'granted') {
          // Clear any existing listeners first
          window.removeEventListener('deviceorientationabsolute', (event) => handleOrientation(event, setHeading, setRaw), true);
          window.removeEventListener('deviceorientation', (event) => handleOrientation(event, setHeading, setRaw), true);
          
          window.addEventListener('deviceorientationabsolute', (event) => handleOrientation(event, setHeading, setRaw), true);
          window.addEventListener('deviceorientation', (event) => handleOrientation(event, setHeading, setRaw), true);
        }
      });
    }
  }

  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <h1>Device Direction Debug</h1>
      <div style={{ margin: '32px 0' }}>
        <div style={{ fontSize: 24, marginBottom: 16 }}>Heading: <b>{heading.toFixed(1)}°</b></div>
        <div style={{ display: 'inline-block', transform: `rotate(${heading}deg)`, transition: 'transform 0.2s' }}>
          <svg width="100" height="100" viewBox="0 0 32 32">
            <g>
              <polygon points="16,4 28,28 16,22 4,28" fill="#ef4444" stroke="#fff" strokeWidth="2" />
            </g>
          </svg>
        </div>
      </div>
      {permission === 'required' && (
        <button onClick={requestPermission} style={{ fontSize: 18, padding: '8px 24px', marginBottom: 16 }}>
          请求方向权限 (iOS)
        </button>
      )}
      {permission === 'desktop' && (
        <div style={{ fontSize: 16, padding: '16px', marginBottom: 16, background: '#f0f0f0', borderRadius: 8 }}>
          <strong>桌面设备检测到</strong><br/>
          设备方向API通常在具有指南针传感器的移动设备上工作。<br/>
          请在iPhone或Android设备上测试此功能。
          <div style={{ marginTop: 12 }}>
            <label>手动测试方向 (度): </label>
            <input 
              type="range" 
              min="0" 
              max="360" 
              value={manualHeading} 
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setManualHeading(value);
                setHeading(value);
              }}
              style={{ width: 200, marginLeft: 8 }}
            />
            <span style={{ marginLeft: 8 }}>{manualHeading}°</span>
          </div>
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: 'left', maxWidth: 400, margin: '32px auto' }}>
        <h3>Raw Event Data:</h3>
        <pre style={{ background: '#f3f4f6', padding: 16, borderRadius: 8 }}>{JSON.stringify(raw, null, 2)}</pre>
      </div>
      <div style={{ color: '#888', marginTop: 24 }}>
        <div>Try rotating your device and see if the arrow and heading update.</div>
        <div>If nothing happens on iOS, tap the permission button above.</div>
      </div>
    </div>
  );
}

export default DirectionDebug; 