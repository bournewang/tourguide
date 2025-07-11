import { useState } from 'react';

function LocationDiagnostic() {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (test, status, message) => {
    setTestResults(prev => [...prev, { test, status, message, timestamp: new Date().toLocaleTimeString() }]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setTestResults([]);

    // Test 1: HTTPS Check
    addResult('HTTPS Protocol', window.location.protocol === 'https:' ? 'success' : 'error', 
      `Current protocol: ${window.location.protocol} ${window.location.protocol === 'https:' ? '✅' : '❌ iPhone Safari requires HTTPS'}`);

    // Test 2: Geolocation API Support
    addResult('Geolocation API', navigator.geolocation ? 'success' : 'error',
      navigator.geolocation ? 'Geolocation API is supported ✅' : 'Geolocation API not supported ❌');

    // Test 3: User Agent Detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    addResult('Device Detection', 'info', `iOS: ${isIOS ? 'Yes' : 'No'}, Safari: ${isSafari ? 'Yes' : 'No'}`);

    // Test 4: Manual Location Request
    if (navigator.geolocation) {
      addResult('Location Request', 'pending', 'Testing location request...');
      
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000
            }
          );
        });

        addResult('Location Request', 'success', 
          `Location obtained! Lat: ${position.coords.latitude.toFixed(6)}, Lng: ${position.coords.longitude.toFixed(6)}`);
        
        // Test 5: Accuracy Check
        addResult('Location Accuracy', 'info', 
          `Accuracy: ${position.coords.accuracy}m, Altitude: ${position.coords.altitude || 'N/A'}`);

      } catch (error) {
        let errorType = 'Unknown error';
        let suggestion = '';

        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorType = 'Permission denied';
            suggestion = 'Go to Safari Settings → Privacy & Security → Location Services → Safari Websites → Allow';
            break;
          case error.POSITION_UNAVAILABLE:
            errorType = 'Position unavailable';
            suggestion = 'Check if GPS/Location Services are enabled on your device';
            break;
          case error.TIMEOUT:
            errorType = 'Request timeout';
            suggestion = 'Try again in an area with better GPS signal';
            break;
        }

        addResult('Location Request', 'error', `${errorType}: ${error.message}`);
        if (suggestion) {
          addResult('Suggestion', 'info', suggestion);
        }
      }
    }

         // Test 6: Permission API (if available)
     if (navigator.permissions) {
       try {
         const permission = await navigator.permissions.query({ name: 'geolocation' });
         addResult('Permission Status', 'info', `Current permission: ${permission.state}`);
       } catch {
         addResult('Permission Status', 'info', 'Permission API not available');
       }
     }

    setIsRunning(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          📍 iPhone Safari 位置诊断工具
        </h1>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            这个工具可以帮助诊断 iPhone Safari 中的位置权限问题。
          </p>
          
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isRunning 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRunning ? '🔄 正在检测...' : '🚀 开始诊断'}
          </button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">诊断结果:</h2>
            
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-lg">
                    {getStatusIcon(result.status)}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium">{result.test}</h3>
                      <span className="text-xs opacity-75">{result.timestamp}</span>
                    </div>
                    <p className="text-sm mt-1">{result.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">💡 故障排除提示:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>确保使用 HTTPS:</strong> iPhone Safari 要求 HTTPS 才能访问位置</li>
            <li>• <strong>检查系统设置:</strong> 设置 → 隐私与安全性 → 定位服务 → Safari 网站</li>
            <li>• <strong>清除浏览器数据:</strong> 如果权限被永久拒绝，需要清除Safari数据</li>
            <li>• <strong>用户交互:</strong> 位置请求必须由用户点击触发，不能自动执行</li>
            <li>• <strong>重新加载页面:</strong> 修改权限后需要重新加载页面</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default LocationDiagnostic; 