import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTargetArea } from './hooks/useTargetArea';
import { calculateDistance, formatDistance } from './utils/coordinateUtils';
import { ttsService } from './utils/ttsService';
import { useCity } from './components/CityLayout';
import { dataService } from './utils/dataService';

function SpotList() {
  const navigate = useNavigate();
  const { cityId } = useCity();
  const { currentTargetArea, userLocation, scenicAreas } = useTargetArea();
  const [spots, setSpots] = useState([]);
  const [spotsWithDistance, setSpotsWithDistance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cacheStatus, setCacheStatus] = useState(null);

  
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



  // Load spots based on current target area
  useEffect(() => {
    const loadSpots = async () => {
      console.log('SpotList: loadSpots called, currentTargetArea:', currentTargetArea);
      
      if (!currentTargetArea || !cityId) {
        console.log('SpotList: No currentTargetArea or cityId, staying in loading state');
        setLoading(true);
        return;
      }

      try {
        setLoading(true);
        console.log('Loading spots for target area:', currentTargetArea);
        
        // Load spots from Cloudflare API
        try {
          const spotsData = await ttsService.getScenicArea(cityId, currentTargetArea.name);
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
  }, [cityId, currentTargetArea]);



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
    navigate(`spot/${encodeURIComponent(spot.name)}`, { 
      state: { spot } // Pass spot data as state
    });
  };

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 py-4">
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
  // if (!currentTargetArea && scenicAreas.length > 0) {
  //   return (
  //     <div className="min-h-full bg-gray-50 py-4">
  //       <div className="max-w-3xl mx-auto px-4">
  //         <div className="text-center py-8">
  //           <div className="text-red-500 text-6xl mb-4">⚠️</div>
  //           <h2 className="text-xl font-bold text-gray-800 mb-2">无法确定当前景区，请手动选择景区</h2>
  //           <p className="text-gray-600 mb-4">系统已加载 {scenicAreas.length} 个景区，但未能自动选择当前景区，请手动选择景区</p>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
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
          {/* {locationError ? (
            <div className="bg-red-50 rounded-xl p-3 mb-4 text-center shadow-sm">
              <p className="text-sm text-red-600 mb-2">
                📍 无法获取位置，{locationError}，请手动选择景区
              </p>
            </div>
          ) : userLocation ? (
            <></>
            // Optional: Show success message when location is available
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
          )} */}
          
          {/* Spots List */}
          <div className="space-y-3">
            {spotsWithDistance.length > 0 ? (
              spotsWithDistance.map((spot, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl p-4 flex items-center space-x-4 hover:shadow-lg cursor-pointer shadow-sm transition-all duration-200 hover:-translate-y-1"
                  onClick={() => handleSpotClick(spot)}
                >
                  {(() => {
                    const thumbUrl = dataService.resolveThumbUrl(cityId, spot.thumbnail);
                    const sequenceThumb = spot.imageSequence && spot.imageSequence.length > 0
                      ? dataService.resolveImageUrl(cityId, spot.imageSequence[0].img)
                      : null;
                    const hasImage = thumbUrl || sequenceThumb;
                    if (hasImage) {
                      return (
                        <img
                          src={thumbUrl || sequenceThumb}
                          alt={spot.name}
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            e.target.src = '/spot-default.jpg';
                          }}
                        />
                      );
                    }
                    return (
                      <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-lg">
                        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    );
                  })()}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{spot.name}</h3>
                    <div className="space-y-1">
                      {spot.distance !== null && (
                        <p className="text-sm text-blue-600 font-semibold">
                          📍 {formatDistance(spot.distance)}
                          
                        </p>
                      )}
                      {/* {dataService.resolveThumbUrl(cityId, spot.thumbnail)} */}
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



          {userLocation && <p className="text-xs text-gray-500">
              {userLocation.lng.toFixed(6)}°, {userLocation.lat.toFixed(6)}°
            </p>}
        </div>
      </div>
    </div>
  );
}

export default SpotList;
