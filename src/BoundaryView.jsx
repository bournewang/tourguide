import React, { useState, useEffect, useRef } from 'react';
import { useTargetArea } from './hooks/useTargetArea';
import { ttsService } from './utils/ttsService';
import { isPointInBounds, calculateDistance, formatDistance } from './utils/boundaryUtils';

const BoundaryView = () => {
  const { 
    currentTargetArea: globalCurrentTargetArea, 
    setTargetArea, 
    userLocation,
    isTestMode,
    toggleTestMode,
    isDebugMode,
    exitDebugMode,
    updateMockLocation
  } = useTargetArea();

  const [scenicAreas, setScenicAreas] = useState([]);
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
  const [cacheStatus, setCacheStatus] = useState(null);
  const [showTestControls] = useState(false);
  const [mockLat, setMockLat] = useState('');
  const [mockLng, setMockLng] = useState('');
  const [isRecordingPolygon, setIsRecordingPolygon] = useState(false);
  const [recordedPoints, setRecordedPoints] = useState([]);
  const [polygonName, setPolygonName] = useState('');
  const [generatedGeoJSON, setGeneratedGeoJSON] = useState('');
  const [showGeoJSONOutput, setShowGeoJSONOutput] = useState(false);
  
  // Use ref to track recording state for event handlers
  const isRecordingRef = useRef(false);
  const clickHandlerRef = useRef(null);
  const spotsRef = useRef({});
  const showSpotsRef = useRef(true);
  
  // Boundary fetching states
  const [isFetchingBoundaries, setIsFetchingBoundaries] = useState(false);
  const [fetchedBoundaries, setFetchedBoundaries] = useState({});
  const [boundaryOverlays, setBoundaryOverlays] = useState([]);
  const [showFetchedBoundaries, setShowFetchedBoundaries] = useState(false);

  const BAIDU_API_KEY = 'nxCgqEZCeYebMtEi2YspKyYElw9GuCiv';

  const loadScenicAreas = async () => {
    try {
      const data = await ttsService.getScenicAreas();
      setScenicAreas(data);
      setLoading(false);
    } catch (error) {
      setError(`Failed to load scenic areas data: ${error.message}`);
      setLoading(false);
    }
  };

  const loadSpots = async () => {
    try {
      console.log('🗺️ DEBUG MODE: Loading ALL spots data for boundary view map');
      const spotsData = {};
      let totalSpots = 0;
      let visibleSpots = 0;
      
      for (const area of scenicAreas) {
        try {
          const areaSpots = await ttsService.getSpotData(area.name);
          
          // Filter spots by display field for map display
          const visibleAreaSpots = areaSpots.filter(spot => spot.display !== "hide");
          
          console.log(`📍 Loaded ${visibleAreaSpots.length}/${areaSpots.length} visible spots for ${area.name}`);
          spotsData[area.name] = visibleAreaSpots;
          totalSpots += areaSpots.length;
          visibleSpots += visibleAreaSpots.length;
        } catch (error) {
          console.warn(`Failed to load spots for ${area.name}:`, error);
          spotsData[area.name] = [];
        }
      }
      
      // Log a sample spot to check structure
      const sampleArea = Object.keys(spotsData)[0];
      if (sampleArea && spotsData[sampleArea].length > 0) {
        console.log('Sample spot structure:', spotsData[sampleArea][0]);
      }
      
      setSpots(spotsData);
      setAllDataLoaded(true); // Mark all data as loaded
      console.log(`🎉 DEBUG MODE: All data loaded successfully! ${visibleSpots}/${totalSpots} spots visible on map`);
      
      // Update cache status
      const status = ttsService.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('Failed to load spots:', error);
      setAllDataLoaded(true); // Still mark as loaded even if there's an error
    }
  };



  // Remove all fallback and bounds logic, only use center/radius for all area operations

  // Use imported functions from boundaryUtils.js

  // Polygon recording functions
  const startRecordingPolygon = () => {
    setIsRecordingPolygon(true);
    isRecordingRef.current = true;
    setRecordedPoints([]);
    setPolygonName('');
    console.log('🎯 Started recording polygon coordinates');
  };

  const stopRecordingPolygon = () => {
    setIsRecordingPolygon(false);
    isRecordingRef.current = false;
    console.log('⏹️ Stopped recording polygon coordinates');
    
    // Clear recorded point markers from map
    if (map) {
      const overlays = map.getOverlays();
      overlays.forEach(overlay => {
        if (overlay._isRecordedPoint) {
          map.removeOverlay(overlay);
        }
      });
    }
  };

  const addPointToPolygon = (point) => {
    if (!isRecordingRef.current) {
      console.log('❌ Not recording polygon, ignoring click');
      return;
    }
    
    const newPoint = [point.lng, point.lat];
    console.log(`📍 Recording point: [${point.lng}, ${point.lat}]`);
    
    setRecordedPoints(prev => {
      const newPoints = [...prev, newPoint];
      console.log(`✅ Updated points array: ${newPoints.length} points total`);
      return newPoints;
    });
  };

  const generatePolygonGeoJSON = () => {
    if (recordedPoints.length < 3) {
      alert('Need at least 3 points to create a polygon');
      return;
    }

    // Close the polygon by adding the first point at the end
    const closedCoordinates = [...recordedPoints, recordedPoints[0]];
    
    const geoJSON = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [closedCoordinates]
      }
    };

    const jsonString = JSON.stringify(geoJSON, null, 2);
    setGeneratedGeoJSON(jsonString);
    setShowGeoJSONOutput(true);
    console.log('Generated GeoJSON:', jsonString);
  };

  const calculatePolygonCenter = (points) => {
    if (points.length === 0) return null;
    
    const sumLng = points.reduce((sum, point) => sum + point[0], 0);
    const sumLat = points.reduce((sum, point) => sum + point[1], 0);
    
    return {
      lng: sumLng / points.length,
      lat: sumLat / points.length
    };
  };

  const clearRecordedPoints = () => {
    setRecordedPoints([]);
    setPolygonName('');
    setGeneratedGeoJSON('');
    setShowGeoJSONOutput(false);
    
    // Clear recorded point markers from map
    if (map) {
      const overlays = map.getOverlays();
      overlays.forEach(overlay => {
        if (overlay._isRecordedPoint) {
          map.removeOverlay(overlay);
        }
      });
    }
  };

  // Boundary fetching functions
  const fetchBoundaryForArea = (areaName) => {
    return new Promise((resolve, reject) => {
      console.log('🔍 Checking Baidu Map API availability...');
      console.log('window.BMap:', window.BMap);
      console.log('window.BMap.LocalSearch:', window.BMap?.LocalSearch);
      console.log('window.BMap.Boundary:', window.BMap?.Boundary);
      console.log('🔄 Using multiple API approach for:', areaName);
      
      if (!window.BMap) {
        console.error('❌ window.BMap is not available');
        reject('Baidu Map API not loaded');
        return;
      }

      // Try multiple approaches to get boundaries
      const tryAllApproaches = async () => {
        // Approach 1: Try LocalSearch for POI boundaries
        console.log(`🌐 Approach 1: LocalSearch for POI: ${areaName}`);
        

        throw new Error('All approaches failed');
      };

      // Execute all approaches
      tryAllApproaches().then(boundaryString => {
        // Convert boundary string to GeoJSON
        const coordinates = boundaryString.split(';').map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat];
        });
        
        const geoJSON = {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [coordinates]
          }
        };
        
        console.log(`✅ Final boundary for ${areaName}:`, geoJSON);
        resolve(geoJSON);
      }).catch(error => {
        console.log(`❌ All approaches failed for ${areaName}:`, error);
        reject(`No boundary found for ${areaName}`);
      });
    });
  };

  const fetchAllBoundaries = async () => {
    console.log('🚀 fetchAllBoundaries called!');
    console.log('📊 Scenic areas count:', scenicAreas.length);
    console.log('📊 Scenic areas:', scenicAreas.map(a => a.name));
    
    setIsFetchingBoundaries(true);
    const newBoundaries = {};
    const newOverlays = [];
    
    try {
      console.log('🌐 Starting to fetch boundaries for all areas...');
      
      for (let i = 0; i < scenicAreas.length; i++) {
        const area = scenicAreas[i];
        try {
          console.log(`🔍 Fetching boundary for: ${area.name} (${i + 1}/${scenicAreas.length})`);
          const boundary = await fetchBoundaryForArea(area.name);
          newBoundaries[area.name] = boundary;
          
          // Create and add overlay to map
          console.log(`🎨 Creating polygon for ${area.name} with coordinates:`, boundary.geometry.coordinates[0]);
          const coordinates = boundary.geometry.coordinates[0].map(coord => 
            new window.BMap.Point(coord[0], coord[1])
          );
          console.log(`📍 Converted to BMap points:`, coordinates);
          
          const polygon = new window.BMap.Polygon(coordinates, {
            strokeWeight: 3,
            strokeColor: "#00ff00",
            fillColor: "#00ff00",
            fillOpacity: 0.1
          });
          
          polygon._isFetchedBoundary = true;
          polygon._areaName = area.name;
          
          console.log(`🗺️ Adding polygon to map for ${area.name}. Map available:`, !!map);
          if (map) {
            map.addOverlay(polygon);
            console.log(`✅ Polygon added to map for ${area.name}`);
          } else {
            console.log(`❌ Map not available for ${area.name}`);
          }
          newOverlays.push(polygon);
          
          // Add delay between API calls to avoid rate limits
          if (i < scenicAreas.length - 1) { // Don't delay after the last call
            console.log(`⏳ Waiting 1 second before next API call...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
          }
          
        } catch (error) {
          console.log(`⚠️ Failed to fetch boundary for ${area.name}:`, error.message);
        }
      }
      
      setFetchedBoundaries(newBoundaries);
      setBoundaryOverlays(newOverlays);
      setShowFetchedBoundaries(true);
      
      console.log(`✅ Boundary fetching complete. Found ${Object.keys(newBoundaries).length} boundaries.`);
      
    } catch (error) {
      console.error('❌ Error fetching boundaries:', error);
    } finally {
      setIsFetchingBoundaries(false);
    }
  };

  const clearFetchedBoundaries = () => {
    // Remove overlays from map
    if (map) {
      boundaryOverlays.forEach(overlay => {
        map.removeOverlay(overlay);
      });
    }
    
    setBoundaryOverlays([]);
    setFetchedBoundaries({});
    setShowFetchedBoundaries(false);
  };

  const generateUpdatedScenicAreaJSON = () => {
    const updatedAreas = scenicAreas.map(area => {
      const fetchedBoundary = fetchedBoundaries[area.name];
      if (fetchedBoundary) {
        return {
          ...area,
          polygon: fetchedBoundary
        };
      }
      return area;
    });
    
    const updatedJSON = JSON.stringify(updatedAreas, null, 2);
    setGeneratedGeoJSON(updatedJSON);
    setShowGeoJSONOutput(true);
    console.log('📋 Generated updated scenic-area.json with fetched boundaries');
  };

  // Calculate map bounds to fit all areas
  const getMapBounds = () => {
    if (scenicAreas.length === 0) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    scenicAreas.forEach(area => {
      if (area.center && area.center.lat && area.center.lng) {
        // Use center coordinates for circle areas
        minLat = Math.min(minLat, area.center.lat);
        maxLat = Math.max(maxLat, area.center.lat);
        minLng = Math.min(minLng, area.center.lng);
        maxLng = Math.max(maxLng, area.center.lng);
      } else if (area.polygon && area.polygon.geometry && area.polygon.geometry.coordinates) {
        // Use polygon coordinates for polygon areas
        const coordinates = area.polygon.geometry.coordinates[0];
        coordinates.forEach(coord => {
          const [lng, lat] = coord;
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        });
      }
    });
    
    // Check if we found any valid coordinates
    if (minLat === Infinity || maxLat === -Infinity || minLng === Infinity || maxLng === -Infinity) {
      console.warn('No valid coordinates found in scenic areas, using fallback bounds');
      return null;
    }
    
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
      
      // Set the map state so other functions can access it
      setMap(baiduMap);

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
          
          
          // Draw each scenic area boundary (circles or polygons)
          scenicAreas.forEach((area) => {
            const isSelected = selectedArea?.name === area.name;
            const fillColor = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(156, 163, 175, 0.2)';
            const strokeColor = isSelected ? '#3b82f6' : '#6b7280';
            const lineWidth = isSelected ? 3 : 2;

            if (area.polygon) {
              // Draw polygon boundary
              const coordinates = area.polygon.geometry.coordinates[0];
              ctx.beginPath();
              
              coordinates.forEach((coord, index) => {
                const point = new window.BMap.Point(coord[0], coord[1]);
                const pixel = baiduMap.pointToPixel(point);
                
                if (index === 0) {
                  ctx.moveTo(pixel.x, pixel.y);
                } else {
                  ctx.lineTo(pixel.x, pixel.y);
                }
              });
              
              ctx.closePath();
              ctx.fillStyle = fillColor;
              ctx.fill();
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = lineWidth;
              ctx.stroke();

              // Draw center marker for polygon areas
              if (area.center) {
                const centerPoint = new window.BMap.Point(area.center.lng, area.center.lat);
                const centerPixel = baiduMap.pointToPixel(centerPoint);
                const crossColor = isSelected ? '#2563eb' : '#6b7280';
                const crossSize = 6;
                
                // White outline
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
                
                // Colored cross
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
                ctx.fillStyle = isSelected ? '#3b82f6' : '#333';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(area.name, centerPixel.x, centerPixel.y);
              }
            } else if (area.center && area.radius) {
              // Draw circle boundary
              const centerPoint = new window.BMap.Point(area.center.lng, area.center.lat);
              const centerPixel = baiduMap.pointToPixel(centerPoint);
              const radiusInMeters = area.radius;
              
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
              
              // Draw circle
              ctx.beginPath();
              ctx.arc(centerPixel.x, centerPixel.y, radiusInPixels, 0, 2 * Math.PI);
              ctx.fillStyle = fillColor;
              ctx.fill();
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = lineWidth;
              ctx.stroke();

              // Draw center marker as a cross
              const crossColor = isSelected ? '#2563eb' : '#6b7280';
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
              ctx.fillStyle = isSelected ? '#3b82f6' : '#333';
              ctx.font = '14px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(area.name, centerPixel.x, centerPixel.y);
            }
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
                    ctx.fillStyle = '#f97316';
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    totalSpotsDrawn++;
                    // console.log(`✅ Successfully drew spot: ${spot.name} at (${spotPixel.x}, ${spotPixel.y})`);
                    
                    // Draw spot name if zoomed in enough
                    const zoom = baiduMap.getZoom();
                    if (zoom >= 12) {
                      ctx.fillStyle = '#333';
                      ctx.font = '10px Arial';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'top';
                      ctx.fillText(spot.name, spotPixel.x, spotPixel.y + 8);
                    }
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
        console.log('🗺️ Map clicked at:', clickPoint);
        console.log('🔍 Recording state:', isRecordingPolygon);
        
        // Handle polygon recording
        if (isRecordingRef.current) {
          console.log('🎯 Processing polygon recording click');
          addPointToPolygon(clickPoint);
          
          // Add visual marker for recorded point
          const pointMarker = new window.BMap.Marker(clickPoint, {
            icon: new window.BMap.Icon('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAxMiAxMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNiIgY3k9IjYiIHI9IjYiIGZpbGw9IiNmNTczYzAiLz4KPC9zdmc+', new window.BMap.Size(12, 12))
          });
          pointMarker._isRecordedPoint = true;
          baiduMap.addOverlay(pointMarker);
          
          console.log('✅ Polygon recording click handled, returning early');
          return; // Don't do other click handling when recording
        }
        
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
          if (isPointInBounds(clickPoint, area)) {
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
        
        // Remove any existing click markers first
        const overlays = baiduMap.getOverlays();
        overlays.forEach(overlay => {
          if (overlay._isClickMarker) {
            baiduMap.removeOverlay(overlay);
          }
        });
        
        // Add a small click point marker
        const clickMarker = new window.BMap.Marker(clickPoint, {
          icon: new window.BMap.Icon('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyQzIgMTcuNTIgNi40OCAyMiAxMiAyMkMxNy41MiAyMiAyMiAxNy41MiAyMiAxMkMyMiA2LjQ4IDE3LjUyIDIgMTIgMloiIGZpbGw9IiMzMDAiLz4KPC9zdmc+', new window.BMap.Size(16, 16))
        });
        clickMarker._isClickMarker = true;
        baiduMap.addOverlay(clickMarker);
        
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
    // getUserLocation();

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



  // Debug clickedLocation state changes
  useEffect(() => {
    console.log('clickedLocation state changed:', clickedLocation);
  }, [clickedLocation]);

  // Auto-select scenic area based on user location
  useEffect(() => {
    if (userLocation && scenicAreas.length > 0 && !isTestMode) {
      console.log('User location changed, auto-selecting scenic area');
      autoSelectScenicArea();
    }
  }, [userLocation, scenicAreas, isTestMode]);

  // Get nearest area using imported calculateDistance function
  const getNearestArea = () => {
    if (!userLocation) return null;
    let nearest = null;
    let minDistance = Infinity;
    scenicAreas.forEach(area => {
      if (area.center && area.center.lat && area.center.lng) {
        const distance = calculateDistance(
          userLocation.lat, userLocation.lng,
          area.center.lat, area.center.lng
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = { ...area, distance };
        }
      } else if (area.polygon && area.polygon.geometry && area.polygon.geometry.coordinates) {
        // For polygon areas without center, use the first coordinate as reference
        const coordinates = area.polygon.geometry.coordinates[0];
        if (coordinates.length > 0) {
          const [lng, lat] = coordinates[0];
          const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            lat, lng
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearest = { ...area, distance };
          }
        }
      }
    });
    return nearest;
  };

  const autoSelectScenicArea = () => {
    if (!userLocation || scenicAreas.length === 0) return;
    
    console.log('Auto-selecting scenic area based on user location:', userLocation);
    
    // First, check if user is inside any scenic area boundary
    const currentArea = scenicAreas.find(area => isPointInBounds(userLocation, area));
    
    if (currentArea) {
      console.log('User is inside scenic area:', currentArea.name);
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

  // Sync local currentTargetArea with global context value (only when local is null)
  useEffect(() => {
    if (globalCurrentTargetArea && !currentTargetArea) {
      setCurrentTargetArea(globalCurrentTargetArea);
    }
  }, [globalCurrentTargetArea, currentTargetArea]);



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
      <div className="text-center p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white relative">
        <h1 className="text-2xl font-bold mb-1">🗺️ Scenic Area Boundaries</h1>
        <p className="text-sm opacity-90">View and explore the circular boundaries of all scenic areas</p>
        
        {/* Debug Mode Exit Button */}
        {isDebugMode && (
          <button
            onClick={exitDebugMode}
            className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-semibold transition-colors"
          >
            🚪 Exit Debug Mode
          </button>
        )}
        
        {/* Cache Status Indicator */}
        {cacheStatus && (
          <div className="text-xs opacity-75 mt-2">
            💾 缓存: {cacheStatus.validEntries}/{cacheStatus.totalEntries} 条有效
            {cacheStatus.totalSize > 0 && (
              <span className="ml-2">
                ({Math.round(cacheStatus.totalSize / 1024)}KB)
              </span>
            )}
          </div>
        )}
      </div>



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
                  <div className="w-4 h-4 bg-blue-500 bg-opacity-30 border-2 border-blue-500 rounded-full mr-2"></div>
                  <span>Selected Area</span>
                </div>
                <div className="flex items-center mb-1">
                  <div className="w-4 h-4 bg-gray-500 bg-opacity-20 border-2 border-gray-500 rounded-full mr-2"></div>
                  <span>Other Areas</span>
                </div>
                <div className="flex items-center mb-1">
                  <div className="w-4 h-4 bg-green-500 bg-opacity-30 border-2 border-green-500 mr-2">⬟</div>
                  <span>Polygon Boundary</span>
                </div>
                <div className="flex items-center mb-1">
                  <div className="w-4 h-4 bg-purple-500 bg-opacity-30 border-2 border-purple-500 rounded-full mr-2"></div>
                  <span>Circle Boundary</span>
                </div>
                {showFetchedBoundaries && (
                  <div className="flex items-center mb-1">
                    <div className="w-4 h-4 bg-green-500 bg-opacity-30 border-2 border-green-500 mr-2">⬟</div>
                    <span>Fetched Boundary</span>
                  </div>
                )}
                {showSpots && (
                  <div className="flex items-center mb-1">
                    <div className="w-4 h-4 bg-orange-500 mr-2">●</div>
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
            {/* Polygon Recording Controls */}
            <div className="mb-6 bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800 mb-3">🎯 Polygon Recorder</h3>
              
              {!isRecordingPolygon ? (
                <button
                  onClick={startRecordingPolygon}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors w-full"
                >
                  Start Recording
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-green-700">
                    Click points on map to record polygon
                  </div>
                  <div className="text-sm text-green-700 font-medium">
                    Points: {recordedPoints.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={stopRecordingPolygon}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors flex-1"
                    >
                      Stop
                    </button>
                    <button
                      onClick={clearRecordedPoints}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors flex-1"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Boundary Fetching Controls */}
            <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-3">🌐 Boundary Fetcher</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    console.log('🔘 Fetch All Boundaries button clicked!');
                    fetchAllBoundaries();
                  }}
                  disabled={isFetchingBoundaries}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFetchingBoundaries ? '🔄 Fetching...' : '🌐 Fetch All Boundaries'}
                </button>
                
                {showFetchedBoundaries && (
                  <div className="space-y-2">
                    <div className="text-sm text-blue-700">
                      Found: {Object.keys(fetchedBoundaries).length} boundaries
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={generateUpdatedScenicAreaJSON}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors flex-1"
                      >
                        📋 Generate JSON
                      </button>
                      <button
                        onClick={clearFetchedBoundaries}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors flex-1"
                      >
                        🗑️ Clear
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-blue-600">
                  Fetches POI boundaries from Baidu Map LocalSearch API
                </div>
              </div>
            </div>

            {/* Selected Area Details */}
            {selectedArea ? (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">📍 {selectedArea.name}</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Boundary Information</h4>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm font-mono">
                      {selectedArea.polygon ? (
                        <>
                          <div className="text-green-600 font-semibold mb-2">⬟ Polygon Boundary</div>
                          <div>Center: {selectedArea.center?.lat.toFixed(6)}, {selectedArea.center?.lng.toFixed(6)}</div>
                          <div>Type: Custom Polygon Shape</div>
                          <div>Vertices: {selectedArea.polygon.geometry.coordinates[0].length} points</div>
                        </>
                      ) : selectedArea.center && selectedArea.radius ? (
                        <>
                          <div className="text-purple-600 font-semibold mb-2">● Circle Boundary</div>
                          <div>Center: {selectedArea.center.lat.toFixed(6)}, {selectedArea.center.lng.toFixed(6)}</div>
                          <div>Radius: {formatDistance(selectedArea.radius)}</div>
                        </>
                      ) : (
                        <div className="text-red-500">No boundary data available</div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Area Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Spots File:</span> {selectedArea.spotsFile}</div>
                      <div><span className="font-medium">Spots Count:</span> {spots[selectedArea.name]?.length || 0} spots</div>
                      <div><span className="font-medium">Center:</span> 
                        {selectedArea.center ? 
                          `${selectedArea.center.lat.toFixed(6)}, ${selectedArea.center.lng.toFixed(6)}` :
                          'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">🗺️ Map Info</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Click on any area to select it and view details. Orange dots show individual spots when enabled.
                </p>
                

                {/* Test Mode Controls */}
                {showTestControls && (
                  <div className="mt-4 bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-800 mb-2">🧪 Test Mode Controls</h4>
                    <div className="text-sm text-purple-700 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Test Mode:</span>
                        <button
                          onClick={toggleTestMode}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                            isTestMode 
                              ? 'bg-green-600 hover:bg-green-700 text-white' 
                              : 'bg-gray-600 hover:bg-gray-700 text-white'
                          }`}
                        >
                          {isTestMode ? 'ON' : 'OFF'}
                        </button>
                        {isTestMode && (
                          <span className="text-xs text-green-600 font-medium">
                            Using mock location
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="font-medium">Set Mock Location:</div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.000001"
                            placeholder="Latitude"
                            value={mockLat}
                            onChange={(e) => setMockLat(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            step="0.000001"
                            placeholder="Longitude"
                            value={mockLng}
                            onChange={(e) => setMockLng(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (mockLat && mockLng) {
                                const mockLocation = {
                                  lat: parseFloat(mockLat),
                                  lng: parseFloat(mockLng)
                                };
                                updateMockLocation(mockLocation);
                                setMockLat('');
                                setMockLng('');
                              }
                            }}
                            disabled={!mockLat || !mockLng}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Set Mock Location
                          </button>
                          <button
                            onClick={() => {
                              // Set to Shaolin Temple center
                              const shaolinLocation = { lat: 34.5083, lng: 113.0362 };
                              updateMockLocation(shaolinLocation);
                              setMockLat(shaolinLocation.lat.toString());
                              setMockLng(shaolinLocation.lng.toString());
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                          >
                            Set to Shaolin
                          </button>
                        </div>
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
                          
                          // Use the global mock location system
                          updateMockLocation(testUserLocation);
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                      >
                        Set as Mock Location
                      </button>
                      
                      <button
                        onClick={() => {
                          setClickedLocation(null);
                          // Also remove the click marker from the map
                          if (map) {
                            const overlays = map.getOverlays();
                            overlays.forEach(overlay => {
                              if (overlay._isClickMarker) {
                                map.removeOverlay(overlay);
                              }
                            });
                          }
                        }}
                        className="ml-2 bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Polygon Generation Panel */}
                {recordedPoints.length > 0 && (
                  <div className="mt-4 bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2">🎯 Recorded Polygon</h4>
                    <div className="text-sm text-green-700 space-y-3">
                      <div>
                        <strong>Points recorded:</strong> {recordedPoints.length}
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={generatePolygonGeoJSON}
                          disabled={recordedPoints.length < 3}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Generate GeoJSON
                        </button>
                        <button
                          onClick={clearRecordedPoints}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                      
                      {recordedPoints.length < 3 && (
                        <div className="text-xs text-orange-600">
                          Need at least 3 points to generate polygon
                        </div>
                      )}
                      
                      {recordedPoints.length >= 3 && !showGeoJSONOutput && (
                        <div className="text-xs text-green-600">
                          ✅ Ready to generate GeoJSON geometry
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Generated GeoJSON Output */}
                {showGeoJSONOutput && generatedGeoJSON && (
                  <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">📋 Generated GeoJSON Geometry</h4>
                    <div className="text-sm text-blue-700 space-y-3">
                      <div className="text-xs text-gray-600">
                        Copy this geometry and paste it as the "polygon" field in your scenic-area.json:
                      </div>
                      
                      <textarea
                        value={generatedGeoJSON}
                        readOnly
                        className="w-full h-48 px-3 py-2 text-xs font-mono bg-white border border-blue-300 rounded focus:outline-none focus:border-blue-500 resize-none"
                        onClick={(e) => e.target.select()}
                      />
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedGeoJSON);
                            alert('GeoJSON copied to clipboard!');
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Copy to Clipboard
                        </button>
                        <button
                          onClick={() => {
                            setShowGeoJSONOutput(false);
                            setGeneratedGeoJSON('');
                          }}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Hide Output
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Debug Info */}
                <div className="mt-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2">🔍 Debug Info</h4>
                  <div className="text-xs text-yellow-700 space-y-2">
                    <div>Recording: {isRecordingPolygon ? 'Yes' : 'No'}</div>
                    <div>Points: {recordedPoints.length}</div>
                    <div>Show Output: {showGeoJSONOutput ? 'Yes' : 'No'}</div>
                    <div>Has GeoJSON: {generatedGeoJSON ? 'Yes' : 'No'}</div>
                    <div>Fetching Boundaries: {isFetchingBoundaries ? 'Yes' : 'No'}</div>
                    <div>Fetched Boundaries: {Object.keys(fetchedBoundaries).length}</div>
                    <div>Show Fetched: {showFetchedBoundaries ? 'Yes' : 'No'}</div>
                    {recordedPoints.length > 0 && (
                      <div>
                        <strong>Recorded Points:</strong>
                        <div className="font-mono text-xs mt-1">
                          {recordedPoints.map((point, index) => (
                            <div key={index}>
                              Point {index + 1}: [{point[0].toFixed(6)}, {point[1].toFixed(6)}]
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Current Target Area Info */}
                {currentTargetArea && (
                  <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">🎯 Current Target Area: {currentTargetArea.name}</h4>
                    <div className="text-sm text-blue-700 space-y-2">
                      <div>
                        <strong>Spots:</strong> {spots[currentTargetArea.name]?.length || 0} locations
                      </div>
                      
                      {userLocation && currentTargetArea.center && (
                        <div>
                          <strong>Distance from you:</strong>
                          <div className="text-blue-600 font-medium">
                            {formatDistance(calculateDistance(
                              userLocation.lat, userLocation.lng,
                              currentTargetArea.center.lat, currentTargetArea.center.lng
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