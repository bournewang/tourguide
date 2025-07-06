import { useState, useEffect } from 'react';
import { useTargetArea } from './hooks/useTargetArea';
import { baiduToWgs84, calculateDistance, formatDistance } from './utils/coordinateUtils';

function SpotList({ onSpotClick, onShowBoundaries, isDebugMode = false }) {
  const { currentTargetArea, userLocation } = useTargetArea();
  const [spots, setSpots] = useState([]);
  const [spotsWithDistance, setSpotsWithDistance] = useState([]);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load spots based on current target area
  useEffect(() => {
    const loadSpots = async () => {
      if (!currentTargetArea) {
        setLoading(true);
        return;
      }

      try {
        setLoading(true);
        console.log('Loading spots for target area:', currentTargetArea);
        
        // Use spotsFile directly from currentTargetArea
        if (!currentTargetArea.spotsFile) {
          console.error('No spotsFile found for area:', currentTargetArea.name);
          setSpots([]);
          setLoading(false);
          return;
        }

        const response = await fetch(`/src/data/${currentTargetArea.spotsFile}`);
        const spotsData = await response.json();
        
        // Filter spots to only include those with tour guide content
        const tourGuideSpots = spotsData.filter(spot => spot.name);
        
        console.log(`Loaded ${tourGuideSpots.length} spots for ${currentTargetArea.name}`);
        setSpots(tourGuideSpots);
        
        // Initialize spots with distance
        setSpotsWithDistance(tourGuideSpots.map(spot => ({ ...spot, distance: null })));
        
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
      
      const spotsWithDist = spots.map(spot => {
        // Convert Baidu coordinates to WGS84 for distance calculation
        const wgs84Coords = baiduToWgs84(spot.location.lat, spot.location.lng);
        return {
          ...spot,
          distance: calculateDistance(userLocation.lat, userLocation.lng, wgs84Coords.lat, wgs84Coords.lng)
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
          <div className="bg-green-50 rounded-xl p-3 mb-4 text-center shadow-sm">
            <p className="text-sm text-green-600 font-medium">
              ✅ 已获取您的位置，按距离远近排序
            </p>
          </div>
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
                  src={spot.image_thumb}
                  alt={spot.name}
                  className="w-16 h-16 object-cover rounded-lg"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/64x64/f3f4f6/9ca3af?text=' + encodeURIComponent(spot.name);
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
        </div>
      </div>
    </div>
  );
}

export default SpotList;
