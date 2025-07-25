import React, { useState, useEffect, useRef } from 'react';
import { useTargetArea } from './hooks/useTargetArea';

import { ttsService } from './utils/ttsService';

const MapView = () => {
  const { currentTargetArea, userLocation } = useTargetArea();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [map, setMap] = useState(null);
  const [spots, setSpots] = useState([]);
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const spotsRef = useRef([]);
  const [userHeading, setUserHeading] = useState(0); // degrees
  const [orientationAvailable, setOrientationAvailable] = useState(false); // track if orientation is available
  const hasAutoCentered = useRef(false); // NEW: track if we've auto-centered

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



  const handleGoToArea = () => {
    if (!map || !currentTargetArea) return;

    // Use scenic area center if available, otherwise calculate from bounds
    let centerLng, centerLat;
    if (currentTargetArea.center && currentTargetArea.center.lng && currentTargetArea.center.lat) {
      centerLng = currentTargetArea.center.lng;
      centerLat = currentTargetArea.center.lat;
      console.log('MapView: Using predefined center:', { lat: centerLat, lng: centerLng });
    }
    
    const zoomLevel = currentTargetArea.level || 15;
    const point = new window.BMap.Point(centerLng, centerLat);
    map.centerAndZoom(point, zoomLevel);
    console.log('MapView: Resetting to area center at:', { lat: centerLat, lng: centerLng });
  };

  const handleGoToUserLocation = () => {
    if (!map || !userLocation) return;

    const userBD = userLocation;
    if (!userBD) return;

    // Center the map on the user and set zoom to 17
    const userPoint = new window.BMap.Point(userBD.lng, userBD.lat);
    map.centerAndZoom(userPoint, 17);
    console.log('MapView: Centered on user location at level 17');
  };

  // Initialize Baidu Map with current target area
  useEffect(() => {
    if (mapLoaded && !map && currentTargetArea && allDataLoaded) {
      console.log('Initializing map for current target area:', currentTargetArea.name);
      
      // Initialize map
      const baiduMap = new window.BMap.Map('baidu-map-container');
      
      // Use scenic area center if available, otherwise calculate from bounds
      let centerLng, centerLat;
      if (currentTargetArea.center && currentTargetArea.center.lng && currentTargetArea.center.lat) {
        centerLng = currentTargetArea.center.lng;
        centerLat = currentTargetArea.center.lat;
        console.log('MapView: Initializing with predefined center:', { lat: centerLat, lng: centerLng });
      }
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
          
          // Draw current target area boundary (circle) and center cross
          if (currentTargetArea) {
            const centerPoint = new window.BMap.Point(
              currentTargetArea.center.lng,
              currentTargetArea.center.lat
            );
            const centerPixel = baiduMap.pointToPixel(centerPoint);
            const radiusInMeters = currentTargetArea.radius;
            // Convert radius from meters to pixels
            const radiusPoint = new window.BMap.Point(
              centerPoint.lng + (radiusInMeters / 111320 / Math.cos(centerPoint.lat * Math.PI / 180)),
              centerPoint.lat + (radiusInMeters / 111320)
            );
            const radiusPixel = baiduMap.pointToPixel(radiusPoint);
            const radiusInPixels = Math.sqrt(
              Math.pow(centerPixel.x - radiusPixel.x, 2) +
              Math.pow(centerPixel.y - radiusPixel.y, 2)
            );
            // Draw circle boundary
            ctx.beginPath();
            ctx.arc(centerPixel.x, centerPixel.y, radiusInPixels, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
            ctx.stroke();
            // Draw center marker as a cross
            const crossColor = '#2563eb';
            const crossSize = 6;
            ctx.save();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(centerPixel.x - crossSize, centerPixel.y);
            ctx.lineTo(centerPixel.x + crossSize, centerPixel.y);
            ctx.moveTo(centerPixel.x, centerPixel.y - crossSize);
            ctx.lineTo(centerPixel.x, centerPixel.y + crossSize);
            ctx.stroke();
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = crossColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerPixel.x - crossSize, centerPixel.y);
            ctx.lineTo(centerPixel.x + crossSize, centerPixel.y);
            ctx.moveTo(centerPixel.x, centerPixel.y - crossSize);
            ctx.lineTo(centerPixel.x, centerPixel.y + crossSize);
            ctx.stroke();
            ctx.restore();
            // Add area name label
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
                  ctx.fillStyle = '#f97316';
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

  // Listen for device orientation only
  useEffect(() => {
    console.log('MapView: Setting up device orientation listeners');
    
    function handleOrientation(event) {
      let heading = null;
      if (typeof event.webkitCompassHeading === 'number') {
        // iOS: webkitCompassHeading is absolute compass heading
        heading = event.webkitCompassHeading;
        console.log('MapView: Device orientation (iOS webkitCompassHeading):', heading);
      } else if (typeof event.alpha === 'number') {
        // Android: alpha is 0 at north, increases clockwise
        heading = 360 - event.alpha;
        console.log('MapView: Device orientation (alpha):', heading);
      }
      if (typeof heading === 'number' && !isNaN(heading)) {
        setUserHeading((heading + 360) % 360);
      }
    }

    // Clear any existing listeners first
    window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
    window.removeEventListener('deviceorientation', handleOrientation, true);

    // iOS 13+ requires permission for device orientation
    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      console.log('MapView: iOS detected, requesting device orientation permission...');
      window.DeviceOrientationEvent.requestPermission().then(result => {
        console.log('MapView: Device orientation permission result:', result);
        if (result === 'granted') {
          console.log('MapView: Permission granted, adding orientation listeners');
          window.addEventListener('deviceorientationabsolute', handleOrientation, true);
          window.addEventListener('deviceorientation', handleOrientation, true);
          setOrientationAvailable(true);
        } else {
          console.log('MapView: Permission denied, will use dot marker');
          setOrientationAvailable(false);
        }
      }).catch(error => {
        console.error('MapView: Failed to get device orientation permission:', error);
        setOrientationAvailable(false);
      });
    } else {
      // Android and older iOS versions don't need permission
      console.log('MapView: No permission required, adding orientation listeners');
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
      setOrientationAvailable(true);
    }

    return () => {
      console.log('MapView: Cleaning up orientation listeners');
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // Handle user location updates separately
  useEffect(() => {
    if (map && userLocation) {
      console.log('Adding user location to map');
      // Remove existing user markers
      map.getOverlays().forEach(overlay => {
        if (overlay._isUserMarker || overlay._isUserLabel) {
          map.removeOverlay(overlay);
        }
      });
      // Use BD-09 coordinates directly
      const userBD = userLocation;
      if (!userBD) return;
      // Use arrow if orientation available, otherwise use dot
      const headingToUse = userHeading;
      console.log('Orientation available:', orientationAvailable, 'Using device orientation heading:', headingToUse);
      
      let markerIcon;
      if (orientationAvailable) {
        // Arrow SVG marker
        const arrowSvg = (heading = 0) => {
          const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(${heading},16,16)"><polygon points="16,4 28,28 16,22 4,28" fill="#ef4444" stroke="#fff" stroke-width="2"/></g></svg>`;
          return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        };
        markerIcon = new window.BMap.Icon(arrowSvg(headingToUse), new window.BMap.Size(32, 32));
      } else {
        // Red dot SVG marker
        const dotSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#ef4444" stroke="#fff" stroke-width="2"/></svg>`;
        markerIcon = new window.BMap.Icon('data:image/svg+xml;utf8,' + encodeURIComponent(dotSvg), new window.BMap.Size(24, 24));
      }
      
      // Add user location marker (arrow or dot)
      const userPoint = new window.BMap.Point(userBD.lng, userBD.lat);
      const userMarker = new window.BMap.Marker(userPoint, {
        icon: markerIcon
      });
      userMarker._isUserMarker = true;
      map.addOverlay(userMarker);
      // Add "当前位置" label
      // const userLabel = new window.BMap.Label('当前位置', {
      //   offset: new window.BMap.Size(0, -36)
      // });
      // userLabel.setStyle({
      //   color: '#ef4444',
      //   fontSize: '12px',
      //   fontWeight: 'bold',
      //   backgroundColor: 'rgba(255, 255, 255, 0.9)',
      //   border: '1px solid #ef4444',
      //   padding: '2px 6px',
      //   borderRadius: '3px'
      // });
      // userLabel._isUserLabel = true;
      // map.addOverlay(userLabel);
      // userLabel.setPosition(userPoint);
      console.log('User location marker added to map successfully, orientation available:', orientationAvailable, 'heading:', headingToUse);
    }
  }, [map, userLocation, userHeading, orientationAvailable]);

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

  // Auto-center on user location ONCE when available
  useEffect(() => {
    if (map && userLocation && !hasAutoCentered.current) {
      const userPoint = new window.BMap.Point(userLocation.lng, userLocation.lat);
      map.centerAndZoom(userPoint, 17);
      hasAutoCentered.current = true;
      console.log('MapView: Auto-centered on user location at zoom 17');
    }
  }, [map, userLocation]);

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
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Map Container */}
      <div className="flex-1 relative">
        <div
          id="baidu-map-container"
          className="w-full h-full"
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

      {/* Map Control Buttons - Bottom Right */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={handleGoToArea}
          className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-full shadow-lg border border-gray-200 transition-colors duration-200 flex items-center justify-center"
          title="回到景区中心"
        >
          🏔️
        </button>
        {userLocation && (
          <button
            onClick={handleGoToUserLocation}
            className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-full shadow-lg border border-gray-200 transition-colors duration-200 flex items-center justify-center"
            title="定位到我的位置"
          >
            🔴
          </button>
        )}
      </div>
    </div>
  );
};

export default MapView; 