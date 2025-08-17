import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTargetArea } from './hooks/useTargetArea';
import { ttsService } from './utils/ttsService';
import { isPointInBounds } from './utils/boundaryUtils';
import { useCity } from './components/CityLayout';

const AMapView = () => {
  const navigate = useNavigate();
  const { cityId } = useCity();
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
  const userLocationRef = useRef(null);

  const AMAP_API_KEY = import.meta.env.VITE_AMAP_API_KEY;

  // Load spots for current target area only
  const loadSpots = async () => {
    if (!currentTargetArea || !cityId) {
      console.log('No target area or cityId selected, redirecting to area selector');
      navigate(`/city/${cityId}/select-area`);
      return;
    }

    try {
      console.log('🗺️ AMapView: Loading spots for current target area:', currentTargetArea.name);
      setLoading(true);
      
      const areaSpots = await ttsService.getScenicArea(cityId, currentTargetArea.name);
      
      // Check if we have spots data
      if (!areaSpots || areaSpots.length === 0) {
        console.warn(`No spots found for ${currentTargetArea.name}`);
        setSpots([]);
        spotsRef.current = [];
        setLoading(false);
        return;
      }
      
      console.log('Spots data:', areaSpots);
      
      // Process spots data - ensure all spots have proper location format
      const processedSpots = areaSpots.map(spot => {
        // Handle AMap API format where location might be a string "lng,lat"
        if (spot.location && typeof spot.location === 'string' && spot.location.includes(',')) {
          const [lng, lat] = spot.location.split(',').map(coord => parseFloat(coord.trim()));
          return {
            ...spot,
            location: { lng, lat }
          };
        }
        
        // Handle case where location might be missing or incomplete
        if (!spot.location || typeof spot.location !== 'object' || !spot.location.lng || !spot.location.lat) {
          console.warn(`Spot ${spot.name} has invalid location:`, spot.location);
          // Use scenic area center as fallback
          return {
            ...spot,
            location: currentTargetArea.center || { lng: 0, lat: 0 }
          };
        }
        
        return spot;
      });
      
      // Filter spots by display field
      const visibleSpots = processedSpots.filter(spot => spot.display !== "hide");
      
      console.log(`📍 Loaded ${visibleSpots.length}/${areaSpots.length} visible spots for ${currentTargetArea.name}`);
      console.log('Processed spots with valid locations:', visibleSpots);
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

    console.log('✅ AMapView: Going to user location:', userLocation);
    try {
      // Convert Baidu coordinates to AMap coordinates if needed
      // For now, we'll use the coordinates directly
      map.setCenter([userLocation.lng, userLocation.lat]);
      map.setZoom(16);
      console.log('✅ Map centered on user location');
    } catch (error) {
      console.error('❌ Error centering map on user location:', error);
    }
  };

  const handleSpotClick = (spot) => {
    console.log('Spot clicked:', spot.name);
    navigate(`../spot/${encodeURIComponent(spot.name)}`, {
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
    navigate('select-area');
  };

  // Load AMap API and initialize map
  useEffect(() => {
    const loadMapAPI = () => {
      if (!window.AMap) {
        const script = document.createElement('script');
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_API_KEY}&callback=initAMapView`;
        script.async = true;
        
        window.initAMapView = () => {
          console.log('AMapView: AMap API loaded');
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
      if (!window.AMap) {
        console.error('AMap API not loaded');
        setError('AMap API not loaded');
        return;
      }

      if (!currentTargetArea) {
        return;
      }

      console.log('🗺️ Initializing AMap for area:', currentTargetArea.name);
      console.log('🗺️ Raw currentTargetArea:', currentTargetArea);
      console.log('🗺️ Raw center data:', currentTargetArea.center);

      // Use current target area center and zoom, or defaults
      let centerLng = currentTargetArea.center?.lng || 113.05;
      let centerLat = currentTargetArea.center?.lat || 34.49;
      const zoomLevel = 15; // Fixed zoom level - don't use currentTargetArea.level which is "5A"

      console.log('🗺️ Before validation - centerLng:', centerLng, 'type:', typeof centerLng);
      console.log('🗺️ Before validation - centerLat:', centerLat, 'type:', typeof centerLat);

      // Ensure coordinates are numbers
      centerLng = Number(centerLng);
      centerLat = Number(centerLat);

      console.log('🗺️ After Number() - centerLng:', centerLng, 'type:', typeof centerLng);
      console.log('🗺️ After Number() - centerLat:', centerLat, 'type:', typeof centerLat);

      // Validate coordinates - ensure they are valid numbers
      if (isNaN(centerLng) || isNaN(centerLat) || centerLng === null || centerLat === null) {
        console.warn('❌ Invalid coordinates detected, using defaults');
        console.warn('❌ centerLng:', centerLng, 'centerLat:', centerLat);
        centerLng = 113.05; // Default to somewhere in China
        centerLat = 34.49;
      }

      // Additional validation for reasonable coordinate ranges
      if (centerLng < -180 || centerLng > 180 || centerLat < -90 || centerLat > 90) {
        console.warn('❌ Coordinates out of valid range, using defaults');
        console.warn('❌ centerLng:', centerLng, 'centerLat:', centerLat);
        centerLng = 113.05;
        centerLat = 34.49;
      }

      console.log('✅ Final coordinates - lng:', centerLng, 'lat:', centerLat, 'zoom:', zoomLevel);

      const amapInstance = new window.AMap.Map('amap-container', {
        center: [centerLng, centerLat],
        zoom: zoomLevel,
        resizeEnable: true,
        viewMode: '2D'
      });
      
      // Skip controls for now to avoid errors
      console.log('Map created without controls');
      
      setMap(amapInstance);

      // Add spots to map
      amapInstance.on('complete', () => {
        console.log('AMap initialization complete');
        addSpotsToMap(amapInstance);
      });

      // Add click event listener for spots
      amapInstance.on('click', (e) => {
        const pixel = e.pixel;
        const spotFound = findSpotAtPixel(amapInstance, pixel);
        if (spotFound) {
          handleSpotClick(spotFound);
        }
      });
    };

    // eslint-disable-next-line no-unused-vars
    const addSpotsToMap = (mapInstance) => {
      if (!spotsRef.current || spotsRef.current.length === 0) {
        console.log('No spots to add to map');
        return;
      }

      console.log(`Adding ${spotsRef.current.length} spots to map`);
      
      // Clear existing markers
      mapInstance.clearMap();
      
      // Add user location marker if available
      if (userLocationRef.current) {
        const userMarker = new window.AMap.Marker({
          position: [userLocationRef.current.lng, userLocationRef.current.lat],
          icon: new window.AMap.Icon({
            size: new window.AMap.Size(24, 24),
            image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
            imageSize: new window.AMap.Size(24, 24)
          }),
          offset: new window.AMap.Pixel(-12, -12),
          zIndex: 101,
          title: '我的位置'
        });
        
        mapInstance.add(userMarker);
      }
      
      // Add spot markers
      const markers = spotsRef.current.map(spot => {
        if (!spot.location || !spot.location.lng || !spot.location.lat) {
          console.warn(`Spot ${spot.name} has invalid location:`, spot.location);
          return null;
        }
        
        const marker = new window.AMap.Marker({
          position: [spot.location.lng, spot.location.lat],
          title: spot.name,
          icon: new window.AMap.Icon({
            size: new window.AMap.Size(24, 24),
            image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png',
            imageSize: new window.AMap.Size(24, 24)
          }),
          offset: new window.AMap.Pixel(-12, -12),
          extData: spot
        });
        
        // Add click event to marker
        marker.on('click', () => {
          handleSpotClick(spot);
        });
        
        return marker;
      }).filter(Boolean);
      
      mapInstance.add(markers);
      console.log(`Added ${markers.length} spot markers to map`);
    };

    const findSpotAtPixel = (mapInstance, pixel) => {
      for (const spot of spotsRef.current) {
        if (!spot.location || !spot.location.lng || !spot.location.lat) continue;
        
        const spotPixel = mapInstance.lngLatToContainer([spot.location.lng, spot.location.lat]);
        const distance = Math.sqrt(
          Math.pow(pixel.x - spotPixel.x, 2) + Math.pow(pixel.y - spotPixel.y, 2)
        );
        
        // Consider a click within 15 pixels of a spot as a click on that spot
        if (distance <= 15) {
          return spot;
        }
      }
      return null;
    };

    loadMapAPI();

    // Cleanup function
    return () => {
      console.log('AMapView: Cleaning up map instance');
      if (map) {
        map.destroy();
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

  // Update userLocationRef and trigger map update when user location changes
  useEffect(() => {
    userLocationRef.current = userLocation;
    
    if (map && userLocation) {
      console.log('User location changed, updating map');
      console.log('Current user location:', userLocation);
      
      // Update user location marker
      map.clearMap();
      
      // Re-add all spots and user location
      if (spotsRef.current && spotsRef.current.length > 0) {
        const markers = spotsRef.current.map(spot => {
          if (!spot.location || !spot.location.lng || !spot.location.lat) return null;
          
          const marker = new window.AMap.Marker({
            position: [spot.location.lng, spot.location.lat],
            title: spot.name,
            icon: new window.AMap.Icon({
              size: new window.AMap.Size(24, 24),
              image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png',
              imageSize: new window.AMap.Size(24, 24)
            }),
            offset: new window.AMap.Pixel(-12, -12),
            extData: spot
          });
          
          marker.on('click', () => {
            handleSpotClick(spot);
          });
          
          return marker;
        }).filter(Boolean);
        
        map.add(markers);
      }
      
      // Add user location marker
      const userMarker = new window.AMap.Marker({
        position: [userLocation.lng, userLocation.lat],
        icon: new window.AMap.Icon({
          size: new window.AMap.Size(24, 24),
          image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
          imageSize: new window.AMap.Size(24, 24)
        }),
        offset: new window.AMap.Pixel(-12, -12),
        zIndex: 101,
        title: '我的位置'
      });
      
      map.add(userMarker);
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
    if (!currentTargetArea && cityId) {
      console.log('No target area selected, redirecting to area selector');
      navigate(`/city/${cityId}/select-area`);
    }
  }, [currentTargetArea, navigate, cityId]);

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
      <div id="amap-container" className="w-full h-full"></div>

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
      </div>

      {/* Boundary Status Indicator */}
      {currentTargetArea && currentTargetArea.polygon && userLocation && (
        <div className="absolute top-4 left-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-3 shadow-lg z-40">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-1 flex items-center justify-center">
              <div 
                className={`w-4 h-4 rounded-full ${
                  isPointInBounds(userLocation, currentTargetArea) 
                    ? 'bg-green-500' 
                    : 'bg-blue-500'
                }`}
              ></div>
            </div>
            <span className="text-xs text-gray-600">
              {isPointInBounds(userLocation, currentTargetArea) ? '在景区内' : '在景区外'}
            </span>
          </div>
        </div>
      )}

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

export default AMapView;
