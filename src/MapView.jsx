import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTargetArea } from './hooks/useTargetArea';
import { ttsService } from './utils/ttsService';

const MapView = () => {
  const navigate = useNavigate();
  const { currentTargetArea, userLocation } = useTargetArea();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [map, setMap] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [spots, setSpots] = useState([]);
  const [userHeading, setUserHeading] = useState(0);
  const [orientationAvailable, setOrientationAvailable] = useState(false);
  const hasAutoCentered = useRef(false);
  const spotsRef = useRef([]);
  const canvasLayerRef = useRef(null);
  const userLocationRef = useRef(null);

  const BAIDU_API_KEY = 'nxCgqEZCeYebMtEi2YspKyYElw9GuCiv';

  // Load spots for current target area only
  const loadSpots = async () => {
    if (!currentTargetArea) {
      console.log('No target area selected, redirecting to area selector');
      navigate('/select-area');
      return;
    }

    try {
      console.log('🗺️ MapView: Loading spots for current target area:', currentTargetArea.name);
      setLoading(true);
      
      const areaSpots = await ttsService.getSpotData(currentTargetArea.name);
      
      // Filter spots by display field
      const visibleSpots = areaSpots.filter(spot => spot.display !== "hide");
      
      console.log(`📍 Loaded ${visibleSpots.length}/${areaSpots.length} visible spots for ${currentTargetArea.name}`);
      setSpots(visibleSpots);
      spotsRef.current = visibleSpots;
      setLoading(false);
      
    } catch (error) {
      console.error('Failed to load spots:', error);
      setError(`Failed to load spots: ${error.message}`);
      setLoading(false);
    }
  };

  const handleGoToUserLocation = () => {
    console.log('📍 handleGoToUserLocation called');
    console.log('📍 map available:', !!map);
    console.log('📍 userLocation available:', !!userLocation);
    console.log('📍 userLocation data:', userLocation);
    
    if (!map) {
      console.log('❌ Map not available');
      return;
    }
    
    if (!userLocation) {
      console.log('❌ User location not available');
      return;
    }

    console.log('✅ MapView: Going to user location:', userLocation);
    try {
      const point = new window.BMap.Point(userLocation.lng, userLocation.lat);
      map.centerAndZoom(point, 16);
      console.log('✅ Map centered on user location');
    } catch (error) {
      console.error('❌ Error centering map on user location:', error);
    }
  };

  const handleSpotClick = (spot) => {
    console.log('Spot clicked:', spot.name);
    navigate(`/spot/${encodeURIComponent(spot.name)}`, {
      state: { spot, areaName: currentTargetArea.name }
    });
  };

  // eslint-disable-next-line no-unused-vars
  const handleRefreshMap = () => {
    if (map) {
      console.log('🔄 Refreshing map');
      loadSpots();
    }
  };

  const handleSelectArea = () => {
    navigate('/select-area');
  };

  // Load Baidu Map API and initialize map
  useEffect(() => {
    const loadMapAPI = () => {
      if (!window.BMap) {
        const script = document.createElement('script');
        // Always use mobile optimizations for Baidu Maps
        script.src = `https://api.map.baidu.com/api?v=3.0&ak=${BAIDU_API_KEY}&callback=initBaiduMapView&s=1`;
        script.async = true;
        
        window.initBaiduMapView = () => {
          console.log('MapView: Baidu Map API loaded');
          initializeMap();
        };
        
        document.head.appendChild(script);
        
        return () => {
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
        };
      } else {
        initializeMap();
      }
    };

    const initializeMap = () => {
      if (!window.BMap) {
        console.error('Baidu Map API not loaded');
        setError('Baidu Map API not loaded');
        return;
      }

      if (!currentTargetArea) {
        return;
      }

      console.log('🗺️ Initializing Baidu Map for area:', currentTargetArea.name);

      // Use current target area center and zoom, or defaults
      const centerLng = currentTargetArea.center?.lng || 113.05;
      const centerLat = currentTargetArea.center?.lat || 34.49;
      const zoomLevel = currentTargetArea.level || 15;

      console.log('MapView: Initializing with center:', { lng: centerLng, lat: centerLat }, 'zoom level:', zoomLevel);

      const baiduMap = new window.BMap.Map('baidu-map-container');
      const centerPoint = new window.BMap.Point(centerLng, centerLat);
      
      baiduMap.centerAndZoom(centerPoint, zoomLevel);
      
      // Always use mobile-optimized controls for Baidu Maps
      baiduMap.enableScrollWheelZoom();
      baiduMap.enableDragging();
      baiduMap.enablePinchToZoom();
      
      // Set mobile-appropriate zoom limits
      baiduMap.setMaxZoom(18);
      baiduMap.setMinZoom(10);
      
      // Mobile-optimized controls
      baiduMap.addControl(new window.BMap.NavigationControl({
        type: window.BMAP_NAVIGATION_CONTROL_SMALL
      }));
      baiduMap.addControl(new window.BMap.ScaleControl());
      
      console.log('Mobile map controls enabled');

      setMap(baiduMap);

      // Create canvas layer for drawing spots
      const canvasLayer = new window.BMap.CanvasLayer({
        update: function() {
          const canvas = this.canvas;
          const ctx = canvas.getContext('2d');
          
          if (!ctx || !spotsRef.current || spotsRef.current.length === 0) {
            return;
          }

          try {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            console.log('🔍 Canvas update - drawing spots:', spotsRef.current.length);

            // Get current user location from the ref
            const currentUserLocation = userLocationRef.current;
            
            // Draw user location marker
            if (currentUserLocation && currentUserLocation.lat && currentUserLocation.lng) {
              try {
                const userPoint = new window.BMap.Point(currentUserLocation.lng, currentUserLocation.lat);
                const userPixel = baiduMap.pointToPixel(userPoint);
                
                if (userPixel && userPixel.x !== undefined && userPixel.y !== undefined) {
                  // Draw user location marker (blue circle)
                  ctx.beginPath();
                  ctx.arc(userPixel.x, userPixel.y, 8, 0, 2 * Math.PI);
                  ctx.fillStyle = '#3b82f6';
                  ctx.fill();
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 3;
                  ctx.stroke();
                  
                  // Add pulsing ring effect
                  ctx.beginPath();
                  ctx.arc(userPixel.x, userPixel.y, 12, 0, 2 * Math.PI);
                  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                  
                  // Draw user location label
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                  ctx.font = '12px Arial';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'bottom';
                  
                  const text = '我的位置';
                  const textMetrics = ctx.measureText(text);
                  const textWidth = textMetrics.width;
                  const textHeight = 16;
                  const padding = 4;
                  
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                  ctx.fillRect(
                    userPixel.x - textWidth/2 - padding,
                    userPixel.y - 25 - textHeight - padding,
                    textWidth + padding * 2,
                    textHeight + padding * 2
                  );
                  
                  ctx.fillStyle = '#ffffff';
                  ctx.fillText(text, userPixel.x, userPixel.y - 25);
                  
                  console.log('📍 Drew user location at:', userPixel.x, userPixel.y);
                }
              } catch (error) {
                console.error('Error drawing user location:', error);
              }
            }

            // Draw spots
            spotsRef.current.forEach((spot, index) => {
              try {
                if (spot && spot.location && spot.location.lat && spot.location.lng) {
                  const spotPoint = new window.BMap.Point(spot.location.lng, spot.location.lat);
                  const spotPixel = baiduMap.pointToPixel(spotPoint);
                  
                  if (spotPixel && spotPixel.x !== undefined && spotPixel.y !== undefined) {
                    // Draw spot marker
                    ctx.beginPath();
                    ctx.arc(spotPixel.x, spotPixel.y, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = '#f97316';
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    
                    // Add outer ring for clickability
                    ctx.beginPath();
                    ctx.arc(spotPixel.x, spotPixel.y, 8, 0, 2 * Math.PI);
                    ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    // Draw spot name
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    
                    const text = spot.name;
                    const textMetrics = ctx.measureText(text);
                    const textWidth = textMetrics.width;
                    const textHeight = 16;
                    const padding = 4;
                    
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(
                      spotPixel.x - textWidth/2 - padding,
                      spotPixel.y - 15 - textHeight - padding,
                      textWidth + padding * 2,
                      textHeight + padding * 2
                    );
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(text, spotPixel.x, spotPixel.y - 15);
                    
                    // Debug first few spots
                    if (index < 3) {
                      console.log(`✅ Drew spot ${index}: ${spot.name} at (${spotPixel.x}, ${spotPixel.y})`);
                    }
                  }
                }
              } catch (error) {
                console.error('Error drawing spot:', spot?.name, error);
              }
            });
            
            console.log(`Canvas drawing complete: ${spotsRef.current.length} spots drawn`);
          } catch (error) {
            console.error('Error in canvas update function:', error);
          }
        }
      });

      baiduMap.addOverlay(canvasLayer);
      canvasLayerRef.current = canvasLayer;
      console.log('Canvas layer added to map');

      // Add touch/click event listeners to canvas for mobile and desktop support
      setTimeout(() => {
        if (canvasLayer.canvas) {
          const handleSpotInteraction = (event) => {
            event.preventDefault(); // Prevent default touch behavior
            
            const rect = canvasLayer.canvas.getBoundingClientRect();
            let x, y;
            
            // Handle different event types
            if (event.touches && event.touches.length > 0) {
              // touchstart or touchmove event
              x = event.touches[0].clientX - rect.left;
              y = event.touches[0].clientY - rect.top;
            } else if (event.changedTouches && event.changedTouches.length > 0) {
              // touchend event
              x = event.changedTouches[0].clientX - rect.left;
              y = event.changedTouches[0].clientY - rect.top;
            } else {
              // click event
              x = event.clientX - rect.left;
              y = event.clientY - rect.top;
            }
            
            console.log('🔍 Spot interaction detected at:', x, y);
            
            // Find clicked/touched spot
            for (const spot of spotsRef.current) {
              if (spot && spot.location) {
                const spotPoint = new window.BMap.Point(spot.location.lng, spot.location.lat);
                const spotPixel = baiduMap.pointToPixel(spotPoint);
                
                if (spotPixel) {
                  const distance = Math.sqrt(
                    Math.pow(x - spotPixel.x, 2) + Math.pow(y - spotPixel.y, 2)
                  );
                  
                  // Larger touch area for mobile
                  const touchRadius = (event.touches || event.changedTouches) ? 15 : 10;
                  
                  if (distance <= touchRadius) {
                    console.log('🎯 Spot clicked/touched:', spot.name, 'distance:', distance);
                    handleSpotClick(spot);
                    break;
                  }
                }
              }
            }
          };
          
          // Add both click and touch events for better mobile support
          canvasLayer.canvas.addEventListener('click', handleSpotInteraction);
          canvasLayer.canvas.addEventListener('touchend', handleSpotInteraction);
          
          // Prevent default touch behaviors that might interfere
          canvasLayer.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
          canvasLayer.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
          
          console.log('Touch/click event listeners added successfully');
        }
      }, 100);
    };

    loadMapAPI();

    // Cleanup function
    return () => {
      console.log('MapView: Cleaning up map instance');
      if (map) {
        map.clearOverlays();
      }
    };
  }, [currentTargetArea]);

  // Load spots when current target area changes
  useEffect(() => {
    if (currentTargetArea) {
      console.log('Current target area changed, loading spots for:', currentTargetArea.name);
      loadSpots();
    }
  }, [currentTargetArea]);

  // Auto-center on user location if available and not already centered
  useEffect(() => {
    if (map && userLocation && !hasAutoCentered.current && !currentTargetArea) {
      console.log('Auto-centering on user location');
      handleGoToUserLocation();
      hasAutoCentered.current = true;
    }
  }, [map, userLocation, currentTargetArea]);

  // Update userLocationRef and trigger canvas update when user location changes
  useEffect(() => {
    userLocationRef.current = userLocation;
    
    if (map && userLocation && canvasLayerRef.current) {
      console.log('User location changed, triggering canvas update');
      console.log('Current user location:', userLocation);
      
      // Trigger a small map movement to force canvas update
      const currentCenter = map.getCenter();
      const offsetPoint = new window.BMap.Point(
        currentCenter.lng + 0.000001, 
        currentCenter.lat + 0.000001
      );
      map.setCenter(offsetPoint);
      setTimeout(() => {
        map.setCenter(currentCenter);
      }, 10);
    }
  }, [map, userLocation]);

  // Handle device orientation
  useEffect(() => {
    if (window.DeviceOrientationEvent) {
      const handleOrientation = (event) => {
        if (event.alpha !== null) {
          setUserHeading(event.alpha);
          setOrientationAvailable(true);
        }
      };

      window.addEventListener('deviceorientation', handleOrientation);
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, []);

  // Redirect if no target area selected
  useEffect(() => {
    if (!currentTargetArea) {
      console.log('No target area selected, redirecting to area selector');
      navigate('/select-area');
    }
  }, [currentTargetArea, navigate]);

  if (!currentTargetArea) {
    return (
      <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在跳转到景区选择页面...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleSelectArea}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            选择景区
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-100">
      {/* Map Container */}
      <div id="baidu-map-container" className="w-full h-full"></div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">加载景点数据中...</p>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-40">        
        {/* Select Area Button */}
        {/* <button
          onClick={handleSelectArea}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg border border-blue-200 transition-colors duration-200 flex items-center justify-center"
          title="选择景区"
        >
          🗺️
        </button> */}

        {/* User Location Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📍 User location button clicked, userLocation:', userLocation);
            handleGoToUserLocation();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📍 User location button touched, userLocation:', userLocation);
            handleGoToUserLocation();
          }}
          disabled={!userLocation}
          className={`p-3 rounded-full shadow-lg border transition-colors duration-200 flex items-center justify-center touch-manipulation ${
            userLocation 
              ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white border-red-200 cursor-pointer' 
              : 'bg-gray-300 text-gray-500 border-gray-200 cursor-not-allowed'
          }`}
          title={userLocation ? "我的位置" : "位置不可用"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L12 22M12 2L8 6M12 2L16 6" stroke={userLocation ? "#3b82f6" : "#9ca3af"}/>
          </svg>
        </button>

        {/* Refresh Button */}
        {/* <button
          onClick={handleRefreshMap}
          className="bg-purple-500 hover:bg-purple-600 text-white p-3 rounded-full shadow-lg border border-purple-200 transition-colors duration-200 flex items-center justify-center"
          title="刷新地图"
        >
          🔄
        </button> */}
      </div>

      {/* Area Info Panel - Hidden as requested */}
      {/* <div className="absolute top-4 left-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-4 shadow-lg z-40 max-w-sm">
        <div className="flex items-center mb-2">
          <div 
            className="w-4 h-4 rounded-full mr-3"
            style={{ backgroundColor: currentTargetArea.color || '#3b82f6' }}
          ></div>
          <h2 className="text-lg font-semibold text-gray-800">{currentTargetArea.name}</h2>
        </div>
        
        {currentTargetArea.description && (
          <p className="text-gray-600 text-sm mb-2">{currentTargetArea.description}</p>
        )}
        
        <div className="text-sm text-gray-500">
          <span>景点数量: {spots.length}</span>
          <br />
          <span>最大缩放: 18级</span>
          <><br /><span>移动端优化</span></>
        </div>
      </div> */}

      {/* User Heading Indicator */}
      {orientationAvailable && userLocation && (
        <div className="absolute top-4 right-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-3 shadow-lg z-40">
          <div className="text-center">
            <div 
              className="w-8 h-8 mx-auto mb-1"
              style={{
                transform: `rotate(${userHeading}deg)`,
                transition: 'transform 0.1s ease-out'
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 22M12 2L8 6M12 2L16 6" stroke="#3b82f6"/>
              </svg>
            </div>
            <span className="text-xs text-gray-600">方向</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView; 