import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTargetArea } from './hooks/useTargetArea';
import { ttsService } from './utils/ttsService';
import { requestOrientationPermission, getCompassHeading } from './utils/orientation';
import { isPointInBounds } from './utils/boundaryUtils';

const MapView3D = () => {
  const navigate = useNavigate();
  const { currentTargetArea, userLocation, mapOrientation } = useTargetArea();
  
  console.log('🗺️ MapView3D: Component rendered');
  console.log('🗺️ MapView3D: mapOrientation from context:', mapOrientation);
  console.log('🗺️ MapView3D: userLocation from context:', userLocation);
  const BAIDU_API_KEY = 'nxCgqEZCeYebMtEi2YspKyYElw9GuCiv';
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const orientationCleanupRef = useRef(null);
  const [userHeading, setUserHeading] = useState(0);
  const [orientationAvailable, setOrientationAvailable] = useState(false);
  const [autoFollow, setAutoFollow] = useState(false);
  const [userHasPanned, setUserHasPanned] = useState(false);
  const panTimeoutRef = useRef(null);
  const [autoFollowZoomLevel, setAutoFollowZoomLevel] = useState(18);

  // handle device orientation
  const setupOrientation = () => {
    console.log('🧭 MapView3D: Setting up orientation');
    if (!window.DeviceOrientationEvent) {
      console.log('❌ MapView3D: DeviceOrientationEvent not available');
      return;
    }
    
    if (orientationCleanupRef.current) orientationCleanupRef.current();
    
    const handleOrientation = (event) => {
      const heading = getCompassHeading(event);
      console.log('🧭 MapView3D: Orientation event received, heading:', heading);
      if (typeof heading === 'number') {
        setUserHeading(heading);
        setOrientationAvailable(true);
        console.log('✅ MapView3D: Orientation updated, heading:', heading);
      }
    };
    
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    window.addEventListener('deviceorientation', handleOrientation);
    console.log('✅ MapView3D: Orientation event listeners added');
    
    orientationCleanupRef.current = () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
      console.log('🧭 MapView3D: Orientation event listeners removed');
    };
  };

  // load map script and initialize when target area is available
  useEffect(() => {
    if (!currentTargetArea) {
      navigate('/select-area');
      return;
    }

    const initOrientation = async () => {
      const granted = await requestOrientationPermission();
      if (granted) setupOrientation();
    };
    initOrientation();

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

    const initializeMap = async () => {
      console.log('🗺️ MapView3D: Initializing map for area:', currentTargetArea.name);
      const centerLng = currentTargetArea.center?.lng || 113.05;
      const centerLat = currentTargetArea.center?.lat || 34.49;
      const zoomLevel = currentTargetArea.level || 16;

      console.log('🗺️ MapView3D: Map center:', { lng: centerLng, lat: centerLat, zoom: zoomLevel });
      
      const mapInstance = new window.BMapGL.Map('baidu-3d-map', {
        enableTilt: true,
        enableRotate: true,
      });
      const centerPoint = new window.BMapGL.Point(centerLng, centerLat);
      mapInstance.centerAndZoom(centerPoint, zoomLevel);
      mapInstance.enableScrollWheelZoom(true);
      mapInstance.setTilt(60);
      mapInstance.setHeading(0);
      
      // Add event listeners to detect user panning
      const handleUserInteraction = () => {
        console.log('🗺️ MapView3D: User interacted with map');
        setUserHasPanned(true);
        
        // Store current zoom level before user interaction
        const currentZoom = mapInstance.getZoom();
        setAutoFollowZoomLevel(currentZoom);
        console.log('🗺️ MapView3D: Stored zoom level before user interaction:', currentZoom);
        
        // Clear existing timeout
        if (panTimeoutRef.current) {
          clearTimeout(panTimeoutRef.current);
        }
        
        // Set timeout to re-enable auto-centering after 10 seconds
        panTimeoutRef.current = setTimeout(() => {
          console.log('🔄 MapView3D: Re-enabling auto-centering after timeout');
          setUserHasPanned(false);
        }, 10000); // 10 seconds
      };
      
      mapInstance.addEventListener('dragend', handleUserInteraction);
      mapInstance.addEventListener('zoomend', handleUserInteraction);
      
      mapRef.current = mapInstance;
      console.log('✅ MapView3D: Map initialized and stored in ref');

      // draw boundary as 3D prism
      if (currentTargetArea?.polygon?.geometry) {
        const coords = currentTargetArea.polygon.geometry.coordinates[0];
        const path = coords.map((c) => new window.BMapGL.Point(c[0], c[1]));
        const prism = new window.BMapGL.Prism(path, 30, {
          topFillColor: '#3b82f6',
          topFillOpacity: 0.5,
          sideFillColor: '#3b82f6',
          sideFillOpacity: 0.3,
        });
        mapInstance.addOverlay(prism);
      }

      // load and draw spots
      try {
        const areaSpots = await ttsService.getSpotData(currentTargetArea.name);
        const visibleSpots = areaSpots.filter((s) => s.display !== 'hide');
        visibleSpots.forEach((spot) => {
          if (!spot.location) return;
          const point = new window.BMapGL.Point(spot.location.lng, spot.location.lat);
          const marker = new window.BMapGL.Marker(point);
          marker.addEventListener('click', () => {
            navigate(`/spot/${encodeURIComponent(spot.name)}`, {
              state: { spot, areaName: currentTargetArea.name },
            });
          });
          mapInstance.addOverlay(marker);
        });
      } catch (err) {
        console.error('Failed to load spots', err);
      }
    };

    const loadAndInit = async () => {
      try {
        if (!window.BMapGL) {
          await loadScript(`https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${BAIDU_API_KEY}&callback=initBMapGL`);
          await new Promise((resolve) => {
            window.initBMapGL = resolve;
          });
        }
        initializeMap();
      } catch (err) {
        console.error('Failed to load Baidu Map GL', err);
      }
    };

    loadAndInit();

    return () => {
      if (orientationCleanupRef.current) orientationCleanupRef.current();
      if (panTimeoutRef.current) {
        clearTimeout(panTimeoutRef.current);
      }
    };
  }, [currentTargetArea, navigate]);

  // update user location marker
  useEffect(() => {
    console.log('📍 MapView3D: User location effect triggered');
    console.log('📍 MapView3D: mapRef.current:', !!mapRef.current);
    console.log('📍 MapView3D: userLocation:', userLocation);
    
    if (!mapRef.current || !userLocation) {
      console.log('❌ MapView3D: Missing map or user location');
      return;
    }

    console.log('✅ MapView3D: Creating/updating user marker at:', userLocation);
    const point = new window.BMapGL.Point(userLocation.lng, userLocation.lat);
    
    if (!userMarkerRef.current) {
      console.log('📍 MapView3D: Creating new user marker');
      const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'>` +
        `<path d='M12 2L20 22L12 17L4 22Z' fill='#3b82f6' stroke='white' stroke-width='2' stroke-linejoin='round'/></svg>`;
      const icon = new window.BMapGL.Icon(
        `data:image/svg+xml;base64,${window.btoa(svg)}`,
        new window.BMapGL.Size(32, 32),
        { anchor: new window.BMapGL.Size(16, 16) }
      );
      const marker = new window.BMapGL.Marker(point, { icon });
      mapRef.current.addOverlay(marker);
      userMarkerRef.current = marker;
      console.log('✅ MapView3D: User marker created and added to map');
    } else {
      console.log('📍 MapView3D: Updating existing user marker position');
      userMarkerRef.current.setPosition(point);
    }
  }, [userLocation]);

  // Auto-enable auto-follow when user enters target scenic area
  useEffect(() => {
    if (!userLocation || !currentTargetArea) return;
    
    const isInsideTargetArea = isPointInBounds(userLocation, currentTargetArea);
    console.log('📍 MapView3D: Checking if user is inside target area:', currentTargetArea.name);
    console.log('📍 MapView3D: User location:', userLocation);
    console.log('📍 MapView3D: Is inside target area:', isInsideTargetArea);
    
    if (isInsideTargetArea && !autoFollow) {
      console.log('✅ MapView3D: User entered target area, enabling auto-follow');
      setAutoFollow(true);
      setUserHasPanned(false); // Reset panning state when entering new area
    } else if (!isInsideTargetArea && autoFollow) {
      console.log('❌ MapView3D: User left target area, disabling auto-follow');
      setAutoFollow(false);
      setUserHasPanned(false); // Reset panning state when leaving area
    }
  }, [userLocation, currentTargetArea, autoFollow]);

  // Auto-follow effect - update map heading, center, and user marker rotation when autoFollow is enabled
  useEffect(() => {
    console.log('🧭 MapView3D: Auto-follow effect triggered');
    console.log('🧭 MapView3D: autoFollow:', autoFollow);
    console.log('🧭 MapView3D: orientationAvailable:', orientationAvailable);
    console.log('🧭 MapView3D: mapOrientation:', mapOrientation);
    console.log('🧭 MapView3D: userHeading:', userHeading);
    console.log('🧭 MapView3D: userLocation:', userLocation);
    console.log('🧭 MapView3D: mapRef.current:', !!mapRef.current);
    
    if (!mapRef.current) {
      console.log('❌ MapView3D: Map not available');
      return;
    }
    
    if (!userLocation) {
      console.log('❌ MapView3D: No user location available');
      return;
    }
    
    // Center map on user location when auto-follow is enabled and user hasn't manually panned
    if (autoFollow && !userHasPanned) {
      console.log('🧭 MapView3D: Centering map on user location:', userLocation);
      try {
        const point = new window.BMapGL.Point(userLocation.lng, userLocation.lat);
        mapRef.current.setCenter(point);
        
        // Restore the zoom level that was set before user interaction
        mapRef.current.setZoom(autoFollowZoomLevel);
        console.log('✅ MapView3D: Map centered on user location and zoom restored to:', autoFollowZoomLevel);
      } catch (error) {
        console.error('❌ MapView3D: Error centering map on user location:', error);
      }
    } else if (autoFollow && userHasPanned) {
      console.log('🧭 MapView3D: Auto-follow enabled but user has panned - not re-centering');
    }
    
    // Handle map heading and user marker rotation based on auto-follow and orientation mode
    if (autoFollow && orientationAvailable) {
      if (mapOrientation === 'user-up') {
        // User-up mode: map rotates in opposite direction to keep user's direction pointing up
        const mapHeading = -userHeading;
        console.log('🧭 MapView3D: User-up mode - user heading:', userHeading, 'map heading:', mapHeading);
        
        try {
          // Set map heading first
          mapRef.current.setHeading(mapHeading);
          console.log('✅ MapView3D: Map heading set successfully to:', mapHeading);
          
          // Then set user marker to point up (since map is doing the rotation work)
          if (userMarkerRef.current) {
            userMarkerRef.current.setRotation(0);
            console.log('✅ MapView3D: User marker rotation set to 0° (pointing up)');
          }
        } catch (error) {
          console.error('❌ MapView3D: Error setting map heading or marker rotation:', error);
        }
      } else {
        // North-up mode: map stays north-up, only user marker rotates
        console.log('🧭 MapView3D: North-up mode - keeping map north-up (0°)');
        
        try {
          // Set map heading first
          mapRef.current.setHeading(0);
          console.log('✅ MapView3D: Map heading set successfully to 0');
          
          // Then set user marker to show actual user direction
          if (userMarkerRef.current) {
            userMarkerRef.current.setRotation(userHeading % 360);
            console.log('✅ MapView3D: User marker rotation set to:', userHeading % 360);
          }
        } catch (error) {
          console.error('❌ MapView3D: Error setting map heading or marker rotation:', error);
        }
      }
    } else if (!autoFollow) {
      // Auto-follow disabled: reset map heading to north and user marker to point north
      console.log('🧭 MapView3D: Auto-follow disabled - resetting to north-up');
      try {
        mapRef.current.setHeading(0);
        if (userMarkerRef.current) {
          userMarkerRef.current.setRotation(0);
        }
        console.log('✅ MapView3D: Reset to north-up mode');
      } catch (error) {
        console.error('❌ MapView3D: Error resetting to north-up:', error);
      }
    } else {
      console.log('🧭 MapView3D: Auto-follow enabled but orientation not available');
    }
  }, [userLocation, userHeading, autoFollow, orientationAvailable, mapOrientation, autoFollowZoomLevel]);

  const handleGoToUserLocation = async () => {
    console.log('📍 MapView3D: handleGoToUserLocation called');
    console.log('📍 MapView3D: mapRef.current:', !!mapRef.current);
    console.log('📍 MapView3D: userLocation:', userLocation);
    
    if (mapRef.current && userLocation) {
      console.log('✅ MapView3D: Centering map on user location:', userLocation);
      const point = new window.BMapGL.Point(userLocation.lng, userLocation.lat);
      mapRef.current.centerAndZoom(point, autoFollowZoomLevel);
      
      // Reset panning state to re-enable auto-centering
      setUserHasPanned(false);
      if (panTimeoutRef.current) {
        clearTimeout(panTimeoutRef.current);
        panTimeoutRef.current = null;
      }
      console.log('🔄 MapView3D: Reset panning state, auto-centering re-enabled with zoom level:', autoFollowZoomLevel);
    } else {
      console.log('❌ MapView3D: Cannot center - missing map or user location');
    }
    
    if (!orientationAvailable) {
      const granted = await requestOrientationPermission();
      if (granted) {
        setupOrientation();
      }
    }
  };

  return (
    <div className="w-full h-full relative">
      <div id="baidu-3d-map" className="w-full h-full" />
      <div className="absolute bottom-24 right-4 z-40 flex flex-col gap-2">
        {/* Location button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleGoToUserLocation();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleGoToUserLocation();
          }}
          disabled={!userLocation}
          className={`p-3 rounded-full shadow-lg border transition-colors duration-200 flex items-center justify-center touch-manipulation ${
            userLocation
              ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white border-red-200 cursor-pointer'
              : 'bg-gray-300 text-gray-500 border-gray-200 cursor-not-allowed'
          }`}
          title={userLocation ? '我的位置' : '位置不可用'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L20 22L12 17L4 22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MapView3D;

