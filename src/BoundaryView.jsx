import React, { useState, useEffect, useRef } from 'react';
import { useTargetArea } from './hooks/useTargetArea';
import { wgs84ToBaidu } from './utils/coordinateUtils';

const BoundaryView = ({ onBack }) => {
  const { currentTargetArea: globalCurrentTargetArea, setTargetArea } = useTargetArea();
  const [scenicAreas, setScenicAreas] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [currentTargetArea, setCurrentTargetArea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [map, setMap] = useState(null);
  const [spots, setSpots] = useState({});
  const [showSpots, setShowSpots] = useState(true);
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const [clickedLocation, setClickedLocation] = useState(null);
  const clickHandlerRef = useRef(null);
  const spotsRef = useRef({});
  const showSpotsRef = useRef(true);

  const BAIDU_API_KEY = 'nxCgqEZCeYebMtEi2YspKyYElw9GuCiv';

  const loadScenicAreas = async () => {
    try {
      const response = await fetch('/src/data/scenic-area.json');
      const data = await response.json();
      setScenicAreas(data);
      setLoading(false);
    } catch (error) {
      setError(`Failed to load scenic areas data: ${error.message}`);
      setLoading(false);
    }
  };

  const loadSpots = async () => {
    try {
    //   console.log('Loading spots for scenic areas:', scenicAreas);
      const spotsData = {};
      
      for (const area of scenicAreas) {
        try {
        //   console.log(`Loading spots for area: ${area.name}, file: ${area.spotsFile}`);
          const response = await fetch(`/src/data/${area.spotsFile}`);
          const areaSpots = await response.json();
        //   console.log(`Loaded ${areaSpots.length} spots for ${area.name}:`, areaSpots);
          spotsData[area.name] = areaSpots;
        } catch (error) {
          console.warn(`Failed to load spots for ${area.name}:`, error);
          spotsData[area.name] = [];
        }
      }
      
    //   console.log('Final spots data:', spotsData);
      
      // Log a sample spot to check structure
      const sampleArea = Object.keys(spotsData)[0];
      if (sampleArea && spotsData[sampleArea].length > 0) {
        // console.log('Sample spot structure:', spotsData[sampleArea][0]);
        // console.log('Sample spot keys:', Object.keys(spotsData[sampleArea][0]));
        // console.log('Sample spot location:', spotsData[sampleArea][0].location);
        // console.log('Sample spot coordinates:', spotsData[sampleArea][0].coordinates);
      }
      
      setSpots(spotsData);
      setAllDataLoaded(true); // Mark all data as loaded
    //   console.log('All data loaded successfully!');
    } catch (error) {
      console.error('Failed to load spots:', error);
      setAllDataLoaded(true); // Still mark as loaded even if there's an error
    }
  };

  const getUserLocation = () => {
    // console.log('getUserLocation called');
    if (navigator.geolocation) {
    //   console.log('Geolocation available, requesting position...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Convert WGS-84 coordinates to BD-09 for Baidu Maps
          const wgsLat = position.coords.latitude;
          const wgsLng = position.coords.longitude;
          const baiduCoords = wgs84ToBaidu(wgsLat, wgsLng);
          
          console.log('User location - WGS-84:', { lat: wgsLat, lng: wgsLng });
          console.log('User location - BD-09:', baiduCoords);
          
          setUserLocation(baiduCoords);
        },
        (error) => {
          console.log('Geolocation error:', error);
          // Set a default location (Shaolin Temple area) in BD-09 coordinates
          const defaultCoords = wgs84ToBaidu(34.5083, 113.0362);
          console.log('Using default location:', defaultCoords);
          setUserLocation(defaultCoords);
        }
      );
    } else {
      console.log('Geolocation not available, using default location');
      // Fallback to default location in BD-09 coordinates
      const defaultCoords = wgs84ToBaidu(34.5083, 113.0362);
      console.log('Using default location:', defaultCoords);
      setUserLocation(defaultCoords);
    }
  };

  const isPointInBounds = (point, bounds) => {
    return point.lat >= bounds.sw.lat && 
           point.lat <= bounds.ne.lat && 
           point.lng >= bounds.sw.lng && 
           point.lng <= bounds.ne.lng;
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  };

  // Calculate map bounds to fit all areas
  const getMapBounds = () => {
    if (scenicAreas.length === 0) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    scenicAreas.forEach(area => {
      minLat = Math.min(minLat, area.bounds.sw.lat);
      maxLat = Math.max(maxLat, area.bounds.ne.lat);
      minLng = Math.min(minLng, area.bounds.sw.lng);
      maxLng = Math.max(maxLng, area.bounds.ne.lng);
    });
    
    // Add padding
    const latPadding = (maxLat - minLat) * 0.1;
    const lngPadding = (maxLng - minLng) * 0.1;
    
    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding
    };
  };

  // Initialize Baidu Map with scenic areas
  useEffect(() => {
    if (mapLoaded && !map && scenicAreas.length > 0 && allDataLoaded) {
      console.log('Initializing map with all data loaded');
      // Initialize map
      const baiduMap = new window.BMap.Map('baidu-map-boundary');
      
      // Calculate map bounds from scenic areas
      const bounds = getMapBounds();
      if (bounds) {
        const swPoint = new window.BMap.Point(bounds.minLng, bounds.minLat);
        const nePoint = new window.BMap.Point(bounds.maxLng, bounds.maxLat);
        const mapBounds = new window.BMap.Bounds(swPoint, nePoint);
        
        // Center and zoom map to fit all areas with some padding
        baiduMap.setViewport(mapBounds, { margins: [50, 50, 50, 50] });
      } else {
        // Fallback to Shaolin Temple center
        const point = new window.BMap.Point(112.947812, 34.513201);
        baiduMap.centerAndZoom(point, 10); // Zoom out more to see all areas
      }
      
      // Enable map controls
      baiduMap.addControl(new window.BMap.NavigationControl());
      baiduMap.addControl(new window.BMap.ScaleControl());
      baiduMap.enableScrollWheelZoom(true);
      baiduMap.enableDragging();
      
      // Create canvas layer for drawing boundaries and spots
      const canvasLayer = new window.BMap.CanvasLayer({
        update: function() {
          const ctx = this.canvas.getContext("2d");
          
          if (!ctx) {
            return;
          }
          
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          
          
          // Draw each scenic area boundary
          scenicAreas.forEach((area) => {
            const points = [
              new window.BMap.Point(area.bounds.sw.lng, area.bounds.sw.lat),
              new window.BMap.Point(area.bounds.ne.lng, area.bounds.sw.lat),
              new window.BMap.Point(area.bounds.ne.lng, area.bounds.ne.lat),
              new window.BMap.Point(area.bounds.sw.lng, area.bounds.ne.lat)
            ];
            
            // Convert points to pixels
            const pixelPoints = points.map(point => baiduMap.pointToPixel(point));
            
            // Draw boundary
            ctx.beginPath();
            ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
            pixelPoints.forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.closePath();
            
            // Style based on selection
            const isSelected = selectedArea?.name === area.name;
            ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(156, 163, 175, 0.2)';
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#3b82f6' : '#6b7280';
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.stroke();
            
            // Add area name label
            const centerPoint = new window.BMap.Point(
              (area.bounds.sw.lng + area.bounds.ne.lng) / 2,
              (area.bounds.sw.lat + area.bounds.ne.lat) / 2
            );
            const centerPixel = baiduMap.pointToPixel(centerPoint);
            
            ctx.fillStyle = isSelected ? '#3b82f6' : '#333';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(area.name, centerPixel.x, centerPixel.y);
          });

          // Draw spots if enabled
          if (showSpotsRef.current && Object.keys(spotsRef.current).length > 0) {
            // console.log('Drawing spots, showSpots:', showSpotsRef.current, 'spots data:', spotsRef.current);
            let totalSpotsProcessed = 0;
            let totalSpotsDrawn = 0;
            
            Object.entries(spotsRef.current).forEach(([areaName, areaSpots]) => {
            //   console.log(`Processing ${areaSpots.length} spots for area: ${areaName}`);
              areaSpots.forEach((spot) => {
                totalSpotsProcessed++;
                // console.log(`Processing spot ${totalSpotsProcessed}:`, spot.name, 'location:', spot.location);
                
                // Use spot.location for coordinates (actual structure)
                if (spot.location && spot.location.lat && spot.location.lng) {
                //   console.log('Spot has valid coordinates:', spot.location);
                  const spotPoint = new window.BMap.Point(spot.location.lng, spot.location.lat);
                  const spotPixel = baiduMap.pointToPixel(spotPoint);
                //   console.log('Spot pixel coordinates:', spotPixel, 'for spot:', spot.name);
                  
                  // Check if pixel coordinates are valid
                  if (spotPixel && spotPixel.x !== undefined && spotPixel.y !== undefined) {
                    // Draw spot marker
                    ctx.beginPath();
                    ctx.arc(spotPixel.x, spotPixel.y, 4, 0, 2 * Math.PI);
                    ctx.fillStyle = '#ef4444';
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    totalSpotsDrawn++;
                    // console.log(`✅ Successfully drew spot: ${spot.name} at (${spotPixel.x}, ${spotPixel.y})`);
                    
                    // Draw spot name if zoomed in enough
                    // const zoom = baiduMap.getZoom();
                    // if (zoom >= 12) {
                    //   ctx.fillStyle = '#333';
                    //   ctx.font = '10px Arial';
                    //   ctx.textAlign = 'center';
                    //   ctx.textBaseline = 'top';
                    //   ctx.fillText(spot.name, spotPixel.x, spotPixel.y + 8);
                    // }
                  } else {
                    console.log('❌ Invalid pixel coordinates for spot:', spot.name, spotPixel);
                  }
                } else {
                  console.log('❌ Spot missing location:', spot.name, spot.location);
                }
              });
            });
            
            console.log(`Canvas drawing complete: ${totalSpotsProcessed} spots processed, ${totalSpotsDrawn} spots drawn`);
          } else {
            console.log('Spots drawing disabled, showSpots:', showSpotsRef.current, 'spots data keys:', Object.keys(spotsRef.current));
          }
        }
      });
      
      baiduMap.addOverlay(canvasLayer);
      
      // Add click event handling for area selection and location info
      const handleMapClick = (e) => {
        const clickPoint = e.point;
        console.log('Map clicked at:', clickPoint);
        
        // Set clicked location for display in right panel (ALWAYS do this first)
        const clickedLocationData = {
          lat: clickPoint.lat,
          lng: clickPoint.lng,
          distance: userLocation ? calculateDistance(
            userLocation.lat, userLocation.lng,
            clickPoint.lat, clickPoint.lng
          ) : null
        };
        console.log('Setting clicked location:', clickedLocationData);
        setClickedLocation(clickedLocationData);
        
        // Disable automatic area selection on click - let user manually select areas
        // Check for area selection (commented out to allow clicked location to work inside areas)
        /*
        let areaSelected = false;
        scenicAreas.forEach((area) => {
          if (isPointInBounds(clickPoint, area.bounds)) {
            console.log('Area clicked:', area.name);
            setSelectedArea(selectedArea?.name === area.name ? null : area);
            areaSelected = true;
          }
        });
        
        if (!areaSelected) {
          console.log('No area selected, clearing selected area');
          setSelectedArea(null);
        }
        */
        
        // Show location info if user location is available
        if (userLocation) {
          const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            clickPoint.lat, clickPoint.lng
          );
          
          // Create info window with location details
        //   const infoWindow = new window.BMap.InfoWindow(`
        //     <div style="width: 250px; padding: 10px;">
        //       <h3 style="margin: 0 0 8px 0; color: #333;">📍 Clicked Location</h3>
        //       <div style="margin: 0 0 8px 0; font-size: 12px; color: #666;">
        //         <strong>Coordinates:</strong><br>
        //         Lat: ${clickPoint.lat.toFixed(6)}<br>
        //         Lng: ${clickPoint.lng.toFixed(6)}
        //       </div>
        //       <div style="margin: 0 0 8px 0; font-size: 12px; color: #666;">
        //         <strong>Distance from you:</strong><br>
        //         ${formatDistance(distance)}
        //       </div>
        //       <div style="margin: 0; font-size: 11px; color: #999;">
        //         <strong>Your location:</strong><br>
        //         ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}
        //       </div>
        //     </div>
        //   `);
          
        //   // Open info window at clicked point
        //   baiduMap.openInfoWindow(infoWindow, clickPoint);
          
        //   // Add a temporary marker at clicked point
        //   const tempMarker = new window.BMap.Marker(clickPoint, {
        //     icon: new window.BMap.Icon('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyQzIgMTcuNTIgNi40OCAyMiAxMiAyMkMxNy41MiAyMiAyMiAxNy41MiAyMiAxMkMyMiA2LjQ4IDE3LjUyIDIgMTIgMloiIGZpbGw9IiM2NjYiLz4KPC9zdmc+', new window.BMap.Size(16, 16))
        //   });
        //   tempMarker._isTempMarker = true;
        //   baiduMap.addOverlay(tempMarker);
          
        //   // Remove temporary marker after 3 seconds
        //   setTimeout(() => {
        //     baiduMap.removeOverlay(tempMarker);
        //   }, 3000);
        } else {
          // If no user location, just show coordinates
        //   const infoWindow = new window.BMap.InfoWindow(`
        //     <div style="width: 200px; padding: 10px;">
        //       <h3 style="margin: 0 0 8px 0; color: #333;">📍 Clicked Location</h3>
        //       <div style="margin: 0; font-size: 12px; color: #666;">
        //         <strong>Coordinates:</strong><br>
        //         Lat: ${clickPoint.lat.toFixed(6)}<br>
        //         Lng: ${clickPoint.lng.toFixed(6)}
        //       </div>
        //     </div>
        //   `);
          
        //   baiduMap.openInfoWindow(infoWindow, clickPoint);
        }
      };
      
      // Remove any existing click listener and add the new one
      if (clickHandlerRef.current) {
        baiduMap.removeEventListener('click', clickHandlerRef.current);
      }
      clickHandlerRef.current = handleMapClick;
      baiduMap.addEventListener('click', handleMapClick);
      
      setMap(baiduMap);
    }
  }, [mapLoaded, map, scenicAreas, selectedArea, allDataLoaded]);

  // Handle user location updates separately
  useEffect(() => {
    if (map && userLocation) {
      console.log('Adding user location to existing map:', userLocation);
      
      // Remove any existing user markers first
      const overlays = map.getOverlays();
      overlays.forEach(overlay => {
        if (overlay._isUserMarker || overlay._isUserLabel || overlay._isTempMarker) {
          map.removeOverlay(overlay);
        }
      });
      
      // Add user location marker
      const userPoint = new window.BMap.Point(userLocation.lng, userLocation.lat);
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

  useEffect(() => {
    loadScenicAreas();
    getUserLocation();
    // Load Baidu Maps API
    if (!window.BMap) {
      const script = document.createElement('script');
      script.src = `https://api.map.baidu.com/api?v=3.0&ak=${BAIDU_API_KEY}&callback=initBaiduMapBoundary`;
      script.async = true;
      
      window.initBaiduMapBoundary = () => {
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

  // Load spots when scenic areas are loaded
  useEffect(() => {
    if (scenicAreas.length > 0) {
      console.log('Scenic areas loaded, triggering spots load');
      loadSpots();
    }
  }, [scenicAreas]);

  // Debug spots state changes
  useEffect(() => {
    console.log('Spots state changed:', spots);
    spotsRef.current = spots; // Update ref with current spots data
    // Force map redraw when spots data changes
    if (map && Object.keys(spots).length > 0) {
      console.log('Forcing map redraw due to spots data change');
      const currentViewport = map.getViewport();
      map.setViewport(currentViewport);
    }
  }, [spots, map]);

  // Debug showSpots state changes
  useEffect(() => {
    console.log('showSpots state changed:', showSpots);
    showSpotsRef.current = showSpots; // Update ref with current showSpots state
  }, [showSpots]);

  // Debug userLocation state changes
  useEffect(() => {
    console.log('userLocation state changed:', userLocation);
  }, [userLocation]);

  // Debug clickedLocation state changes
  useEffect(() => {
    console.log('clickedLocation state changed:', clickedLocation);
  }, [clickedLocation]);

  // Auto-select scenic area based on user location
  useEffect(() => {
    if (userLocation && scenicAreas.length > 0) {
      console.log('User location changed, auto-selecting scenic area');
      autoSelectScenicArea();
    }
  }, [userLocation, scenicAreas]);

  const getNearestArea = () => {
    if (!userLocation) return null;
    
    let nearest = null;
    let minDistance = Infinity;
    
    scenicAreas.forEach(area => {
      const centerLat = (area.bounds.sw.lat + area.bounds.ne.lat) / 2;
      const centerLng = (area.bounds.sw.lng + area.bounds.ne.lng) / 2;
      const distance = calculateDistance(userLocation.lat, userLocation.lng, centerLat, centerLng);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { ...area, distance };
      }
    });
    
    return nearest;
  };

  const autoSelectScenicArea = () => {
    if (!userLocation || scenicAreas.length === 0) return;
    
    console.log('Auto-selecting scenic area based on user location:', userLocation);
    
    // First, check if user is inside any scenic area boundary
    const currentArea = scenicAreas.find(area => isPointInBounds(userLocation, area.bounds));
    
    if (currentArea) {
      console.log('User is inside scenic area:', currentArea);
      setCurrentTargetArea(currentArea);
      return;
    }
    
    // If not inside any area, find the nearest one
    const nearestArea = getNearestArea();
    if (nearestArea) {
      console.log('User is not in any area, selecting nearest:', nearestArea.name, 'distance:', formatDistance(nearestArea.distance));
      setCurrentTargetArea(nearestArea);
    }
  };

  // Set default target area when scenic areas are loaded
  useEffect(() => {
    if (scenicAreas.length > 0 && !currentTargetArea) {
      // Set Shaolin Temple as default target area
      const shaolinArea = scenicAreas.find(area => area.name === '少林寺');
      if (shaolinArea) {
        console.log('Setting default target area:', shaolinArea.name);
        setCurrentTargetArea(shaolinArea);
      } else {
        // Fallback to first area if Shaolin not found
        console.log('Setting default target area:', scenicAreas[0].name);
        setCurrentTargetArea(scenicAreas[0]);
      }
    }
  }, [scenicAreas, currentTargetArea]);

  // Update global target area when current target area changes
  useEffect(() => {
    if (currentTargetArea) {
      console.log('BoundaryView: Updating global target area to:', currentTargetArea.name);
      setTargetArea(currentTargetArea);
    }
  }, [currentTargetArea, setTargetArea]);

  // Sync local currentTargetArea with global context value
  useEffect(() => {
    if (globalCurrentTargetArea && (!currentTargetArea || globalCurrentTargetArea.name !== currentTargetArea.name)) {
      setCurrentTargetArea(globalCurrentTargetArea);
    }
  }, [globalCurrentTargetArea]);

  if (loading || !allDataLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-blue-600 font-semibold">
          {loading ? 'Loading scenic areas...' : 'Loading spots data...'}
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

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="text-center p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <h1 className="text-2xl font-bold mb-1">🗺️ Scenic Area Boundaries</h1>
        <p className="text-sm opacity-90">View and explore the boundaries of all scenic areas</p>
      </div>

      {/* Back Button */}
      {onBack && (
        <div className="p-2 bg-white border-b">
          <button
            onClick={onBack}
            className="bg-gray-600 hover:bg-gray-700 text-white py-1 px-3 rounded text-sm font-semibold transition-colors duration-200"
          >
            ← Back to List
          </button>
        </div>
      )}

      {/* Main Content - Left/Right Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Map */}
        <div className="flex-1 bg-white border-r border-gray-200">
          <div className="h-full flex flex-col">
            {/* Map Header */}
            {/* <div className="flex justify-between items-center p-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">🗺️ Interactive Map</h3>
              <button
                onClick={() => setShowSpots(!showSpots)}
                className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                  showSpots 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {showSpots ? 'Hide Spots' : 'Show Spots'}
              </button>
            </div> */}
            
            {/* Map Container */}
            <div className="flex-1 relative">
              <div 
                id="baidu-map-boundary" 
                className="w-full h-full rounded-none border-0"
                style={{ cursor: 'pointer' }}
              ></div>
              
              {/* Legend */}
              <div className="absolute top-4 right-4 bg-white bg-opacity-90 p-3 rounded-lg shadow-md text-sm">
                <div className="font-semibold mb-2">Legend</div>
                <div className="flex items-center mb-1">
                  <div className="w-4 h-4 bg-blue-500 bg-opacity-30 border-2 border-blue-500 mr-2"></div>
                  <span>Selected Area</span>
                </div>
                <div className="flex items-center mb-1">
                  <div className="w-4 h-4 bg-gray-500 bg-opacity-20 border-2 border-gray-500 mr-2"></div>
                  <span>Other Areas</span>
                </div>
                {showSpots && (
                  <div className="flex items-center mb-1">
                    <div className="w-4 h-4 bg-red-500 mr-2">●</div>
                    <span>Spots</span>
                  </div>
                )}
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-500 mr-2">📍</div>
                  <span>Your Location</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Info Panel */}
        <div className="w-96 bg-white overflow-y-auto">
          <div className="p-4">
            {/* Selected Area Details */}
            {selectedArea ? (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">📍 {selectedArea.name}</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Boundary Coordinates</h4>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm font-mono">
                      <div>SW: {selectedArea.bounds.sw.lat.toFixed(6)}, {selectedArea.bounds.sw.lng.toFixed(6)}</div>
                      <div>NE: {selectedArea.bounds.ne.lat.toFixed(6)}, {selectedArea.bounds.ne.lng.toFixed(6)}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Area Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Spots File:</span> {selectedArea.spotsFile}</div>
                      <div><span className="font-medium">Spots Count:</span> {spots[selectedArea.name]?.length || 0} spots</div>
                      <div><span className="font-medium">Center:</span> 
                        {((selectedArea.bounds.sw.lat + selectedArea.bounds.ne.lat) / 2).toFixed(6)}, 
                        {((selectedArea.bounds.sw.lng + selectedArea.bounds.ne.lng) / 2).toFixed(6)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">🗺️ Map Info</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Click on any area to select it and view details. Red dots show individual spots when enabled.
                </p>
                
                {/* Current Location Info */}
                {userLocation && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">📍 Your Current Location</h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <div><strong>Coordinates:</strong></div>
                      <div className="font-mono text-xs">
                        {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                      </div>
                      <div className="flex space-x-2 mt-2">
                        <button
                          onClick={() => {
                            if (map) {
                              const userPoint = new window.BMap.Point(userLocation.lng, userLocation.lat);
                              map.panTo(userPoint);
                              map.setZoom(15);
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Center on My Location
                        </button>
                        <button
                          onClick={autoSelectScenicArea}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Auto-Select Area
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Clicked Location Info */}
                {clickedLocation && (
                  <div className="mt-4 bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2">🎯 Clicked Location</h4>
                    <div className="text-sm text-green-700 space-y-2">
                      <div>
                        <strong>Coordinates:</strong>
                        <div className="font-mono text-xs mt-1">
                          {clickedLocation.lat.toFixed(6)}, {clickedLocation.lng.toFixed(6)}
                        </div>
                      </div>
                      
                      {clickedLocation.distance && (
                        <div>
                          <strong>Distance from you:</strong>
                          <div className="text-blue-600 font-medium">
                            {formatDistance(clickedLocation.distance)}
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={() => {
                          if (map) {
                            const clickedPoint = new window.BMap.Point(clickedLocation.lng, clickedLocation.lat);
                            map.panTo(clickedPoint);
                            map.setZoom(16);
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                      >
                        Center on Clicked Location
                      </button>
                      
                      <button
                        onClick={() => {
                          // Set user location to clicked location for testing
                          const testUserLocation = {
                            lat: clickedLocation.lat,
                            lng: clickedLocation.lng
                          };
                          console.log('Setting test user location:', testUserLocation);
                          setUserLocation(testUserLocation);
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                      >
                        Set User Location
                      </button>
                      
                      <button
                        onClick={() => setClickedLocation(null)}
                        className="ml-2 bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Current Target Area Info */}
                {currentTargetArea && (
                  <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">🎯 Current Target Area: {currentTargetArea.name}</h4>
                    <div className="text-sm text-blue-700 space-y-2">
                      <div>
                        <strong>Spots:</strong> {spots[currentTargetArea.name]?.length || 0} locations
                      </div>
                      
                      {userLocation && (
                        <div>
                          <strong>Distance from you:</strong>
                          <div className="text-blue-600 font-medium">
                            {formatDistance(calculateDistance(
                              userLocation.lat, userLocation.lng,
                              (currentTargetArea.bounds.sw.lat + currentTargetArea.bounds.ne.lat) / 2,
                              (currentTargetArea.bounds.sw.lng + currentTargetArea.bounds.ne.lng) / 2
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-600">
                        This area's spots will be shown in the SpotList page
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Spots List for Selected Area */}
            {/* {selectedArea && spots[selectedArea.name] && spots[selectedArea.name].length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🏛️ Spots in {selectedArea.name}</h3>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {spots[selectedArea.name].map((spot, index) => {
                    const distance = userLocation && spot.location ? calculateDistance(
                      userLocation.lat, userLocation.lng,
                      spot.location.lat, spot.location.lng
                    ) : null;
                    
                    return (
                      <div key={index} className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                        <div className="font-semibold text-gray-800 mb-1">{spot.name}</div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          {spot.location && (
                            <div className="font-mono text-xs">
                              {spot.location.lat.toFixed(6)}, {spot.location.lng.toFixed(6)}
                            </div>
                          )}
                          {distance && (
                            <div className="text-blue-600 font-medium">
                              {formatDistance(distance)} away
                            </div>
                          )}
                          {spot.description && (
                            <div className="text-gray-500 text-xs line-clamp-2">
                              {spot.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )} */}

          </div>
        </div>
      </div>
    </div>
  );
};

export default BoundaryView; 