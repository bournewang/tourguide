import React, { useState, useEffect, useRef } from 'react';
import { useTargetArea } from './hooks/useTargetArea';
import { wgs84ToBaidu } from './utils/coordinateUtils';
import { ttsService } from './utils/ttsService';

const MapView = ({ onBack }) => {
  const { currentTargetArea, userLocation } = useTargetArea();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [map, setMap] = useState(null);
  const [spots, setSpots] = useState([]);
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const spotsRef = useRef([]);

  const BAIDU_API_KEY = 'nxCgqEZCeYebMtEi2YspKyYElw9GuCiv';

  const loadSpots = async () => {
    if (!currentTargetArea) {
      setAllDataLoaded(true);
      return;
    }

    try {
      console.log('🗺️ MapView: Loading spots for current target area:', currentTargetArea.name);
      
      const areaSpots = await ttsService.getSpotData(currentTargetArea.name);
      
      // Filter spots by display field for map display
      const visibleSpots = areaSpots.filter(spot => spot.display !== "hide");
      
      console.log(`📍 Loaded ${visibleSpots.length}/${areaSpots.length} visible spots for ${currentTargetArea.name}`);
      setSpots(visibleSpots);
      setAllDataLoaded(true);
      setLoading(false);
      
    } catch (error) {
      console.error('Failed to load spots:', error);
      setError(`Failed to load spots: ${error.message}`);
      setAllDataLoaded(true);
      setLoading(false);
    }
  };

  const getUserLocationBD = () => {
    if (!userLocation) return null;
    return wgs84ToBaidu(userLocation.lat, userLocation.lng);
  };



  // Initialize Baidu Map with current target area
  useEffect(() => {
    if (mapLoaded && !map && currentTargetArea && allDataLoaded) {
      console.log('Initializing map for current target area:', currentTargetArea.name);
      
      // Initialize map
      const baiduMap = new window.BMap.Map('baidu-map-container');
      
      // Use scenic area center and zoom level from data
      const centerLng = currentTargetArea.center?.lng || 113.2;
      const centerLat = currentTargetArea.center?.lat || 34.7;
      const zoomLevel = currentTargetArea.level || 15;
      
      console.log('MapView: Initializing with center:', { lat: centerLat, lng: centerLng }, 'zoom level:', zoomLevel);
      
      const point = new window.BMap.Point(centerLng, centerLat);
      baiduMap.centerAndZoom(point, zoomLevel);
      
      // Enable map controls
      baiduMap.addControl(new window.BMap.NavigationControl());
      baiduMap.addControl(new window.BMap.ScaleControl());
      baiduMap.enableScrollWheelZoom(true);
      baiduMap.enableDragging();
      
      // Create canvas layer for drawing current area boundary and spots
      const canvasLayer = new window.BMap.CanvasLayer({
        update: function() {
          const ctx = this.canvas.getContext("2d");
          
          if (!ctx) {
            return;
          }
          
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          
          // Draw current target area boundary
          if (currentTargetArea) {
            // (points variable removed as it was unused)
            
            // // Draw boundary
            // ctx.beginPath();
            // ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
            // pixelPoints.forEach((point) => {
            //   ctx.lineTo(point.x, point.y);
            // });
            // ctx.closePath();
            
            // // Style for current area (highlighted)
            // ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            // ctx.fill();
            // ctx.strokeStyle = '#3b82f6';
            // ctx.lineWidth = 3;
            // ctx.stroke();
            
            // Add area name label
            const centerPoint = new window.BMap.Point(
              (currentTargetArea.bounds.sw.lng + currentTargetArea.bounds.ne.lng) / 2,
              (currentTargetArea.bounds.sw.lat + currentTargetArea.bounds.ne.lat) / 2
            );
            const centerPixel = baiduMap.pointToPixel(centerPoint);
            
            ctx.fillStyle = '#3b82f6';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(currentTargetArea.name, centerPixel.x, centerPixel.y);
          }

          // Draw spots for current area
          if (spotsRef.current && spotsRef.current.length > 0) {
            let totalSpotsDrawn = 0;
            
            spotsRef.current.forEach((spot) => {
              // Use spot.location for coordinates
              if (spot.location && spot.location.lat && spot.location.lng) {
                const spotPoint = new window.BMap.Point(spot.location.lng, spot.location.lat);
                const spotPixel = baiduMap.pointToPixel(spotPoint);
                
                // Check if pixel coordinates are valid
                if (spotPixel && spotPixel.x !== undefined && spotPixel.y !== undefined) {
                  // Draw spot marker
                  ctx.beginPath();
                  ctx.arc(spotPixel.x, spotPixel.y, 5, 0, 2 * Math.PI);
                  ctx.fillStyle = '#ef4444';
                  ctx.fill();
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                  totalSpotsDrawn++;
                  
                  // Draw spot name
                //   ctx.fillStyle = '#333';
                //   ctx.font = '12px Arial';
                //   ctx.textAlign = 'center';
                //   ctx.textBaseline = 'top';
                //   ctx.fillText(spot.name, spotPixel.x, spotPixel.y + 8);
                }
              }
            });
            
            console.log(`Canvas drawing complete: ${totalSpotsDrawn} spots drawn for ${currentTargetArea?.name}`);
          }
        }
      });
      
      baiduMap.addOverlay(canvasLayer);
      setMap(baiduMap);
    }
  }, [mapLoaded, map, currentTargetArea, allDataLoaded]);

  // Handle user location updates separately
  useEffect(() => {
    if (map && userLocation) {
      console.log('Adding user location to map');
      
      // Remove any existing user markers first
      const overlays = map.getOverlays();
      overlays.forEach(overlay => {
        if (overlay._isUserMarker || overlay._isUserLabel) {
          map.removeOverlay(overlay);
        }
      });
      
      // Convert user location to Baidu coordinates
      const userBD = getUserLocationBD();
      if (!userBD) return;
      
      // Add user location marker
      const userPoint = new window.BMap.Point(userBD.lng, userBD.lat);
      const userMarker = new window.BMap.Marker(userPoint, {
        icon: new window.BMap.Icon('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyQzIgMTcuNTIgNi40OCAyMiAxMiAyMkMxNy41MiAyMiAyMiAxNy41MiAyMiAxMkMyMiA2LjQ4IDE3LjUyIDIgMTIgMloiIGZpbGw9IiNlZjQ0NDQiLz4KPHBhdGggZD0iTTEyIDZDNi40OCA2IDIgMTAuNDggMiAxNkMyIDIxLjUyIDYuNDggMjYgMTIgMjZDMjEuNTIgMjYgMjYgMjEuNTIgMjYgMTZDMjYgMTAuNDggMjEuNTIgNiAxMiA2WiIgZmlsbD0iI2VmNDQ0NCIgZmlsbC1vcGFjaXR5PSIwLjMiLz4KPC9zdmc+', new window.BMap.Size(24, 24))
      });
      userMarker._isUserMarker = true;
      map.addOverlay(userMarker);
      
      // Add "You" label
      const userLabel = new window.BMap.Label('You', {
        offset: new window.BMap.Size(0, -30)
      });
      userLabel.setStyle({
        color: '#ef4444',
        fontSize: '12px',
        fontWeight: 'bold',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        border: '1px solid #ef4444',
        padding: '2px 6px',
        borderRadius: '3px'
      });
      userLabel._isUserLabel = true;
      
      map.addOverlay(userLabel);
      userLabel.setPosition(userPoint);
      console.log('User location added to map successfully');
    }
  }, [map, userLocation]);

  // Load Baidu Map API
  useEffect(() => {
    if (!window.BMap) {
      const script = document.createElement('script');
      script.src = `https://api.map.baidu.com/api?v=3.0&ak=${BAIDU_API_KEY}&callback=initBaiduMapView`;
      script.async = true;
      
      window.initBaiduMapView = () => {
        console.log('MapView: Baidu Map API loaded');
        setMapLoaded(true);
      };
      
      document.head.appendChild(script);
      
      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    } else {
      setMapLoaded(true);
    }
  }, []);

  // Load spots when current target area changes
  useEffect(() => {
    if (currentTargetArea) {
      console.log('Current target area changed, loading spots for:', currentTargetArea.name);
      loadSpots();
    }
  }, [currentTargetArea]);

  // Update spots ref when spots change
  useEffect(() => {
    console.log('Spots state changed:', spots.length, 'spots for', currentTargetArea?.name);
    spotsRef.current = spots;
    // Force map redraw when spots data changes
    if (map && spots.length > 0) {
      console.log('Forcing map redraw due to spots data change');
      const currentViewport = map.getViewport();
      map.setViewport(currentViewport);
    }
  }, [spots, map]);

  if (loading || !allDataLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin text-4xl mb-4">🗺️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">加载地图中</h2>
          <p className="text-gray-600">正在准备景点地图...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-600 text-center">
          <div className="text-xl font-semibold mb-2">Error</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!currentTargetArea) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">无法加载地图</h2>
          <p className="text-gray-600 mb-4">未找到当前景区信息</p>
        </div>
        {/* Fixed Go Back Button */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-lg z-50 py-3">
          <div className="flex justify-center px-4">
            <button
              onClick={onBack}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              返回景点列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-md p-4 flex items-center justify-center">
        <h1 className="text-lg font-semibold text-gray-800 text-center w-full">
          {currentTargetArea.name} - 景点地图
        </h1>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative pb-20"> {/* Add pb-20 for bottom button */}
        <div
          id="baidu-map-container"
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
        
        {!mapLoaded && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">🔄</div>
              <p className="text-gray-600">初始化地图中...</p>
            </div>
          </div>
        )}
        
        {mapLoaded && spots.length === 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md text-center">
              <div className="text-4xl mb-4">📍</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">暂无可显示的景点</h3>
              <p className="text-gray-600 mb-4">
                当前景区暂时没有景点信息可以在地图上显示。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Go Back Button */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-lg z-50 py-1">
            <div className="flex items-center gap-2 justify-center px-4 py-2">
            <span>🔴 景点位置</span>
            {userLocation && <span>📍 我的位置</span>}
          </div> 
          <div className="flex flex-col sm:flex-row gap-2 justify-center px-4">
          <button
            onClick={onBack}
            className="w-100 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            返回景点列表
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapView; 