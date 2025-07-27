import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTargetArea } from './hooks/useTargetArea';
import { calculateDistance, formatDistance } from './utils/coordinateUtils';
import { ttsService } from './utils/ttsService';
import { getValidationStatus, formatValidationStatus } from './utils/validationStatus';
import { dataService } from './utils/dataService';

function SpotList() {
  const navigate = useNavigate();
  const { currentTargetArea, userLocation, locationError, scenicAreas, setTargetArea } = useTargetArea();
  const [spots, setSpots] = useState([]);
  const [spotsWithDistance, setSpotsWithDistance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cacheStatus, setCacheStatus] = useState(null);
  const [showAreaSelector, setShowAreaSelector] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);
  
  // Fallback: if no currentTargetArea after 3 seconds, show error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!currentTargetArea && scenicAreas.length > 0) {
        console.log('SpotList: Timeout - no currentTargetArea set, but scenic areas loaded. This might be a bug.');
        setLoading(false);
      }
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [currentTargetArea, scenicAreas]);

  // Show area selector after 10 seconds if no location and no error
  useEffect(() => {
    if (!userLocation && !locationError) {
      const timeout = setTimeout(() => {
        console.log('Location fetch timeout - showing area selector');
        setShowAreaSelector(true);
      }, 10000);
      return () => clearTimeout(timeout);
    } else {
      setShowAreaSelector(false);
    }
  }, [userLocation, locationError]);

  // Load spots based on current target area
  useEffect(() => {
    const loadSpots = async () => {
      console.log('SpotList: loadSpots called, currentTargetArea:', currentTargetArea);
      
      if (!currentTargetArea) {
        console.log('SpotList: No currentTargetArea, staying in loading state');
        setLoading(true);
        return;
      }

      try {
        setLoading(true);
        console.log('Loading spots for target area:', currentTargetArea);
        
        // Load spots from Cloudflare API
        try {
          const spotsData = await ttsService.getSpotData(currentTargetArea.name);
          console.log(`🎯 NORMAL MODE: Loaded ${spotsData.length} spots from Cloudflare for ${currentTargetArea.name}`);
          
          // Filter spots to only include those with tour guide content and display: "show"
          // simplify this filter into one line to only include spots with display: "show"
          const tourGuideSpots = spotsData.filter(spot => spot.name && spot.display !== "hide");

          console.log(`🎯 NORMAL MODE: Loaded ${tourGuideSpots.length} visible spots for ${currentTargetArea.name} (${spotsData.length - tourGuideSpots.length} hidden)`);
          setSpots(tourGuideSpots);
          
          // Initialize spots with distance
          setSpotsWithDistance(tourGuideSpots.map(spot => ({ ...spot, distance: null })));
          
          // Update cache status
          const status = ttsService.getCacheStatus();
          setCacheStatus(status);
          
          // Load validation status
          const validationInfo = getValidationStatus();
          console.log('validationInfo', validationInfo);
          setValidationStatus(validationInfo);
          
        } catch (error) {
          console.error('Failed to load spots from Cloudflare:', error);
          setSpots([]);
          setSpotsWithDistance([]);
        }
        
      } catch (error) {
        console.error('Failed to load spots:', error);
        setSpots([]);
        setSpotsWithDistance([]);
      } finally {
        setLoading(false);
      }
    };

    loadSpots();
  }, [currentTargetArea]);

  // Update validation status periodically and when session changes
  useEffect(() => {
    const updateValidationStatus = () => {
      const validationInfo = getValidationStatus();
      console.log('validationInfo updated:', validationInfo);
      setValidationStatus(validationInfo);
    };
    
    // Update immediately
    updateValidationStatus();
    
    // Listen for localStorage changes (when AccessGate completes validation)
    const handleStorageChange = (e) => {
      if (e.key === 'nfc_session') {
        console.log('Session updated in localStorage, refreshing validation status');
        updateValidationStatus();
      }
    };
    
    // Add event listener for storage changes
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event (for same-page updates)
    const handleSessionUpdate = () => {
      console.log('Session updated via custom event, refreshing validation status');
      updateValidationStatus();
    };
    
    window.addEventListener('nfc-session-updated', handleSessionUpdate);
    
    // Update every 5 minutes
    const interval = setInterval(updateValidationStatus, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('nfc-session-updated', handleSessionUpdate);
    };
  }, []);

  // Calculate distances when user location or spots change
  useEffect(() => {
    if (userLocation && spots.length > 0) {
      console.log('Calculating distances for spots using BD-09 coordinates');
      
      const spotsWithDist = spots.map(spot => {
        // Both user location and spot coordinates are in Baidu format
        return {
          ...spot,
          distance: calculateDistance(userLocation.lat, userLocation.lng, spot.location.lat, spot.location.lng)
        };
      }).sort((a, b) => a.distance - b.distance);

      setSpotsWithDistance(spotsWithDist);
    } else if (spots.length > 0) {
      // Keep original sequence if no location
      setSpotsWithDistance(spots.map(spot => ({ ...spot, distance: null })));
    }
  }, [userLocation, spots]);

  const handleSpotClick = (spot) => {
    // Navigate to spot detail page with spot ID
    navigate(`/spot/${encodeURIComponent(spot.name)}`, { 
      state: { spot } // Pass spot data as state
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-4">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在加载景点数据...</p>
            {!currentTargetArea && (
              <p className="text-sm text-gray-500 mt-2">
                等待景区数据加载... {scenicAreas.length > 0 ? '(景区已加载，等待选择)' : '(正在加载景区)'}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show error if scenic areas loaded but no target area set
  if (!currentTargetArea && scenicAreas.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-4">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center py-8">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">无法确定当前景区</h2>
            <p className="text-gray-600 mb-4">系统已加载 {scenicAreas.length} 个景区，但未能自动选择当前景区</p>
            {scenicAreas.length > 1 ? (
              <div className="space-y-2">
                {scenicAreas.map((area, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      console.log('Manually selecting area:', area.name);
                      setTargetArea(area);
                    }}
                    className="block w-full max-w-sm mx-auto px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    选择 {area.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">
                正在选择默认景区...
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex-1 overflow-y-auto px-2 pb-4"> {/* Reduced bottom padding since nav is handled by Layout */}
        <div className="max-w-3xl mx-auto px-4">
          {/* Scenic Area Description */}
          {currentTargetArea && currentTargetArea.description && (
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">ℹ️</div>
                <div>
                  {/* <h2 className="text-lg font-semibold text-gray-800 mb-2">景区简介</h2> */}
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {currentTargetArea.description}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Current Target Area Info */}
          {/* {currentTargetArea && (
            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-center shadow-sm">
              <p className="text-sm text-blue-600 font-medium">
                🎯 当前景区: {currentTargetArea.name}
              </p>
              {userLocation && (
                <p className="text-xs text-blue-500 mt-1">
                  📍 您的位置已获取，景点按距离排序
                </p>
              )}
            </div>
          )} */}
          

          
          {/* Location status */}
          {locationError ? (
            <div className="bg-red-50 rounded-xl p-3 mb-4 text-center shadow-sm">
              <p className="text-sm text-red-600 mb-2">
                📍 无法获取位置，{locationError}
              </p>
              {scenicAreas.length > 1 ? (
                <button
                  onClick={() => setShowAreaModal(true)}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  选择景区
                </button>
              ) : (
                <p className="text-xs text-gray-500">
                  系统将使用默认景区
                </p>
              )}
            </div>
          ) : userLocation ? (
            <></>
            // Optional: Show success message when location is available
            // <div className="bg-green-50 rounded-xl p-3 mb-4 text-center shadow-sm">
            //   <p className="text-sm text-green-600 font-medium">
            //     ✅ 已获取您的位置，按距离远近排序 
            //   </p>
            // </div>
          ) : showAreaSelector ? (
            <div className="bg-yellow-50 rounded-xl p-3 mb-4 text-center shadow-sm">
              <p className="text-sm text-yellow-600 mb-2">
                ⏰ 位置获取时间较长
              </p>
              {scenicAreas.length > 1 && (
                <button
                  onClick={() => setShowAreaModal(true)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  📍 选择景区
                </button>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 rounded-xl p-3 mb-4 text-center shadow-sm">
              <p className="text-sm text-yellow-600">
                ⏳ 正在获取您的位置，请稍候...
              </p>
            </div>
          )}

          {/* Area Selection Modal */}
          {showAreaModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAreaModal(false)}>
              <div className="bg-white rounded-xl p-6 m-4 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">选择景区</h3>
                  <p className="text-sm text-gray-600">请选择您想要游览的景区</p>
                </div>
                
                <div className="grid grid-cols-1 gap-3 mb-4">
                  {scenicAreas.map((area, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        console.log('Selecting area from modal:', area.name);
                        setTargetArea(area);
                        setShowAreaModal(false);
                      }}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 text-left ${
                        currentTargetArea?.name === area.name
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div className="font-medium">{area.name}</div>
                      {area.description && (
                        <div className="text-xs mt-1 opacity-75 line-clamp-2">
                          {area.description.slice(0, 50)}...
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setShowAreaModal(false)}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  取消
                </button>
              </div>
            </div>
          )}
          
          {/* Spots List */}
          <div className="space-y-3">
            {spotsWithDistance.length > 0 ? (
              spotsWithDistance.map((spot, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl p-4 flex items-center space-x-4 hover:shadow-lg cursor-pointer shadow-sm transition-all duration-200 hover:-translate-y-1"
                  onClick={() => handleSpotClick(spot)}
                >
                  <img
                    src={dataService.resolveThumbUrl(spot.thumbnail) || '/spot-default.jpg'}
                    alt={spot.name}
                    className="w-16 h-16 object-cover rounded-lg"
                    onError={(e) => {
                      e.target.src = '/spot-default.jpg';
                    }}
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{spot.name}</h3>
                    <div className="space-y-1">
                      {spot.distance !== null && (
                        <p className="text-sm text-blue-600 font-semibold">
                          📍 {formatDistance(spot.distance)}
                          {/* {dataService.resolveThumbUrl(spot.thumbnail)} */}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-blue-500 text-xl font-bold">
                    ▶
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">暂无景点数据</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Status Information */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            👆 点击任意景点查看详情和听取讲解
          </p>
          
          {/* Cache Status Indicator */}
          {cacheStatus && (
            <div className="mt-2 text-xs text-gray-500">
              💾 缓存状态: {cacheStatus.validEntries}/{cacheStatus.totalEntries} 条有效
              {cacheStatus.totalSize > 0 && (
                <span className="ml-2">
                  ({Math.round(cacheStatus.totalSize / 1024)}KB)
                </span>
              )}
            </div>
          )}

          {validationStatus && (
            <div className="mt-2 text-xs text-green-600 font-medium">
              🏷️ NFC验证: {formatValidationStatus(validationStatus)}
            </div>
          )}

          {userLocation && <p className="text-xs text-gray-500">
              {userLocation.lng.toFixed(6)}°, {userLocation.lat.toFixed(6)}°
            </p>}
        </div>
      </div>
    </div>
  );
}

export default SpotList;
