import { useState, useEffect } from 'react';
import { useTargetArea } from './hooks/useTargetArea';
import { wgs84ToBaidu, calculateDistance, formatDistance } from './utils/coordinateUtils';
import { ttsService } from './utils/ttsService';

function SpotList({ onSpotClick, onShowBoundaries, isDebugMode = false }) {
  const { currentTargetArea, userLocation, scenicAreas, setTargetArea } = useTargetArea();
  const [spots, setSpots] = useState([]);
  const [spotsWithDistance, setSpotsWithDistance] = useState([]);
  const [userLocationBD, setUserLocationBD] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cacheStatus, setCacheStatus] = useState(null);
  
  // Fallback: if no currentTargetArea after 3 seconds, show error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!currentTargetArea && scenicAreas.length > 0) {
        console.log('SpotList: Timeout - no currentTargetArea set, but scenic areas loaded. This might be a bug.');
        setLoading(false);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [currentTargetArea, scenicAreas]);

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

  // Calculate distances when user location or spots change
  useEffect(() => {
    if (userLocation && spots.length > 0) {
      console.log('Calculating distances for spots');
      
      // Convert user location from WGS-84 to Baidu for consistent coordinate system
      const userLocationBaidu = wgs84ToBaidu(userLocation.lat, userLocation.lng);
      setUserLocationBD(userLocationBaidu);
      console.log('User location converted to Baidu:', userLocationBaidu.lng, userLocationBaidu.lat);
      
      const spotsWithDist = spots.map(spot => {
        // Both user location and spot coordinates are now in Baidu format
        return {
          ...spot,
          distance: calculateDistance(userLocationBaidu.lat, userLocationBaidu.lng, spot.location.lat, spot.location.lng)
        };
      }).sort((a, b) => a.distance - b.distance);

      setSpotsWithDistance(spotsWithDist);
    } else if (spots.length > 0) {
      // Keep original sequence if no location
      setSpotsWithDistance(spots.map(spot => ({ ...spot, distance: null })));
    }
  }, [userLocation, spots]);

  // Handle location errors
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('浏览器不支持定位功能');
    }
  }, []);

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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">
          🏯 {currentTargetArea?.name || '景点导览'}
        </h1>
        
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
        
        {/* Map View Buttons */}
        <div className="text-center mb-4 space-y-2">
          {isDebugMode && (
            <button
              onClick={onShowBoundaries}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-xl text-sm font-semibold shadow-md transition-colors duration-200 flex items-center mx-auto"
            >
              🗺️ 景区边界查看
            </button>
          )}
        </div>
        
        {/* Location status */}
        {locationError ? (
          <div className="bg-red-50 rounded-xl p-3 mb-4 text-center shadow-sm">
            <p className="text-sm text-red-600">
              📍 无法获取位置: {locationError}
            </p>
          </div>
        ) : userLocation ? (
          <></>
          // <div className="bg-green-50 rounded-xl p-3 mb-4 text-center shadow-sm">
          //   <p className="text-sm text-green-600 font-medium">
          //     ✅ 已获取您的位置，按距离远近排序 
          //   </p>
          // </div>
        ) : (
          <div className="bg-yellow-50 rounded-xl p-3 mb-4 text-center shadow-sm">
            <p className="text-sm text-yellow-600">
              ⏳ 正在获取您的位置，请稍候...
            </p>
          </div>
        )}
        
        {/* Spots List */}
        <div className="space-y-3">
          {spotsWithDistance.length > 0 ? (
            spotsWithDistance.map((spot, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-4 flex items-center space-x-4 hover:shadow-lg cursor-pointer shadow-sm transition-all duration-200 hover:-translate-y-1"
                onClick={() => onSpotClick && onSpotClick(spot)}
              >
                <img
                  src={spot.image_thumb || '/spot-default.jpg'}
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
        
        <div className="mt-6 text-center">
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


          {userLocationBD && <p className="text-xs text-gray-500">
              {userLocationBD.lng.toFixed(6)}°, {userLocationBD.lat.toFixed(6)}°
            </p>}
        </div>
      </div>
    </div>
  );
}

export default SpotList;
