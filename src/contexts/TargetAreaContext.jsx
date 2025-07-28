import { useState, useEffect, useRef } from 'react';
import { TargetAreaContext } from './TargetAreaContextDef';
import { wgs84ToBaidu } from '../utils/coordinateUtils';
import { dataService } from '../utils/dataService';

export const TargetAreaProvider = ({ children }) => {
  const [currentTargetArea, setCurrentTargetArea] = useState(null);
  const [scenicAreas, setScenicAreas] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [userLocationWGS84, setUserLocationWGS84] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isLocationWatching, setIsLocationWatching] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isAutoSelectionEnabled, setIsAutoSelectionEnabled] = useState(true);
  const watchIdRef = useRef(null);
  const lastSpotsCalculationRef = useRef(null);
  const lastAreaCalculationRef = useRef(null);

  // Check for test mode and debug mode on initialization
  useEffect(() => {
    // Check for debug mode from localStorage or URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('debug');
    const storedDebugMode = localStorage.getItem('debugMode') === 'true';
    const debugMode = debugParam === '1' || storedDebugMode;
    
    if (debugMode) {
      localStorage.setItem('debugMode', 'true');
    }
    
    setIsDebugMode(debugMode);
    console.log('Debug mode:', debugMode, '(from URL:', debugParam === '1', ', from localStorage:', storedDebugMode, ')');
    
    // Load auto-selection preference
    const storedAutoSelection = localStorage.getItem('autoSelectionEnabled');
    const autoSelectionEnabled = storedAutoSelection === null ? true : storedAutoSelection === 'true';
    setIsAutoSelectionEnabled(autoSelectionEnabled);
    console.log('Auto-selection enabled:', autoSelectionEnabled, '(from localStorage:', storedAutoSelection, ')');
    
    if (debugMode) {
      console.log('Debug mode active, stopping real geolocation');
      
      // Force stop any existing location monitoring
      stopLocationWatching();
      
      // Load initial mock location if available
      const mockLocation = getMockLocation();
      if (mockLocation) {
        console.log('Loaded mock location:', mockLocation);
        updateUserLocationCoordinates(mockLocation, true); // Assume BD-09 from mock
        lastSpotsCalculationRef.current = mockLocation;
        lastAreaCalculationRef.current = mockLocation;
      }
    } else {
      console.log('Normal mode active, starting real geolocation');
      startLocationWatching();
    }
  }, []);

  // Helper functions for coordinate management
  const updateUserLocationCoordinates = (location, isFromBaiduMap = false) => {
    if (isFromBaiduMap) {
      // Coordinates from Baidu Map are already in BD-09 format
      setUserLocation(location); // Store as BD-09 (default)
      setUserLocationWGS84(null); // We don't have WGS-84 for Baidu Map clicks
      console.log('Updated coordinates from Baidu Map (BD-09):', location);
    } else {
      // Coordinates from GPS are in WGS-84 format
      setUserLocationWGS84(location);
      const bd09Location = wgs84ToBaidu(location.lat, location.lng);
      setUserLocation(bd09Location); // Store BD-09 as default
      console.log('Updated coordinates from GPS (WGS-84):', location, 'converted to BD-09:', bd09Location);
    }
  };

  // Helper functions for test mode
  const getMockLocation = () => {
    try {
      const stored = localStorage.getItem('mockUserLocation');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading mock location:', error);
    }
    return null;
  };

  const setMockLocation = (location) => {
    try {
      localStorage.setItem('mockUserLocation', JSON.stringify(location));
      console.log('Mock location set:', location);
    } catch (error) {
      console.error('Error setting mock location:', error);
    }
  };



  // Load scenic areas
  useEffect(() => {
    const loadScenicAreas = async () => {
      try {
        console.log('TargetAreaContext: Loading visible scenic areas using dataService...');
        const data = await dataService.getVisibleScenicAreas();
        console.log('TargetAreaContext: Loaded visible scenic areas:', data);
        setScenicAreas(data);
      } catch (error) {
        console.error('TargetAreaContext: Failed to load scenic areas:', error);
      }
    };
    loadScenicAreas();
  }, []);



  // Start continuous location monitoring
  const startLocationWatching = () => {
    // Don't start real geolocation if in debug mode
    if (isDebugMode) {
      console.log('Debug mode active, skipping real geolocation watching');
      return;
    }

    if (!navigator.geolocation) {
      console.log('Geolocation not available');
      setLocationError('Geolocation not available');
      return;
    }

    if (isLocationWatching) return;

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    };

    // First get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const initialLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        console.log('Initial location:', initialLocation);
        updateUserLocationCoordinates(initialLocation, false); // GPS coordinates
        setLocationError(null);
        lastSpotsCalculationRef.current = initialLocation;
        lastAreaCalculationRef.current = initialLocation;
        
        // Then start continuous monitoring (only if not in debug mode)
        if (!isDebugMode) {
          startContinuousWatching();
        }
      },
      (error) => {
        console.log('Initial geolocation error:', error);
        setLocationError(error.message || '定位失败');
        // Still start watching in case permission is granted later (only if not in debug mode)
        if (!isDebugMode) {
          startContinuousWatching();
        }
      },
      options
    );
  };

  // Start continuous location monitoring
  const startContinuousWatching = () => {
    if (!navigator.geolocation || isLocationWatching) return;

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        console.log('Location updated:', newLocation);
        console.log('Last spots calculation location:', lastSpotsCalculationRef.current);
        console.log('Last area calculation location:', lastAreaCalculationRef.current);
        
        // Check if we need to recalculate spots (10m threshold)
        if (lastSpotsCalculationRef.current) {
          const spotsDistance = calculateDistance(
            lastSpotsCalculationRef.current.lat,
            lastSpotsCalculationRef.current.lng,
            newLocation.lat,
            newLocation.lng
          );
          
        console.log(`Spots distance calculation: ${spotsDistance.toFixed(2)}m (threshold: 3m)`);
          
        if (spotsDistance >= 3) {
          console.log(`✅ Moved ${spotsDistance.toFixed(1)}m, triggering spots recalculation`);
          lastSpotsCalculationRef.current = newLocation;
          // Only update userLocation when movement exceeds threshold
          updateUserLocationCoordinates(newLocation, isDebugMode);
        } else {
          console.log(`❌ Movement ${spotsDistance.toFixed(1)}m is below 3m threshold, NOT triggering spots recalculation`);
          // Don't update userLocation for small movements
        }
        } else {
          console.log('No last spots calculation location, setting initial reference');
          lastSpotsCalculationRef.current = newLocation;
          // Set initial userLocation
          updateUserLocationCoordinates(newLocation, isDebugMode);
        }
        
        // Check if we need to recalculate area (100m threshold)
        if (lastAreaCalculationRef.current) {
          const areaDistance = calculateDistance(
            lastAreaCalculationRef.current.lat,
            lastAreaCalculationRef.current.lng,
            newLocation.lat,
            newLocation.lng
          );
          
          console.log(`Area distance calculation: ${areaDistance.toFixed(2)}m (threshold: 100m)`);
          
          if (areaDistance >= 100) {
            console.log(`✅ Moved ${areaDistance.toFixed(1)}m, triggering area recalculation`);
            lastAreaCalculationRef.current = newLocation;
            // Trigger area recalculation
            autoSelectTargetArea();
          } else {
            console.log(`❌ Movement ${areaDistance.toFixed(1)}m is below 100m threshold, NOT triggering area recalculation`);
          }
        } else {
          console.log('No last area calculation location, setting initial reference');
          lastAreaCalculationRef.current = newLocation;
        }
      },
      (error) => {
        console.log('Location watching error:', error);
        setLocationError(error.message || '定位失败');
        setIsLocationWatching(false);
      },
      options
    );

    setIsLocationWatching(true);
    console.log('Started automatic location monitoring');
  };

  // Stop continuous location monitoring
  const stopLocationWatching = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsLocationWatching(false);
      console.log('Stopped location monitoring');
    }
  };

  // Set default target area when scenic areas are loaded
  useEffect(() => {
    // console.log('TargetAreaContext: scenicAreas.length:', scenicAreas.length, 'currentTargetArea:', currentTargetArea);
    
    if (scenicAreas.length > 0 && !currentTargetArea) {
      // Set Shaolin Temple as default target area
      const shaolinArea = scenicAreas.find(area => area.name === '少林寺');
      if (shaolinArea) {
        console.log('TargetAreaContext: Setting default target area:', shaolinArea.name);
        setCurrentTargetArea(shaolinArea);
      } else {
        // Fallback to first area if Shaolin not found
        console.log('TargetAreaContext: Shaolin not found, setting default target area:', scenicAreas[0].name);
        setCurrentTargetArea(scenicAreas[0]);
      }
    }
  }, [scenicAreas, currentTargetArea]);

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

  const isPointInBounds = (pointBaidu, area) => {
    // Use center/radius only
    const centerLat = area.center.lat;
    const centerLng = area.center.lng;
    const radius = area.radius;
    const distance = calculateDistance(pointBaidu.lat, pointBaidu.lng, centerLat, centerLng);
    console.log('isPointInBounds:', area.name, pointBaidu.lat, pointBaidu.lng, centerLat, centerLng, radius, distance);
    return distance <= radius;
  };

  const getNearestArea = (userLocationBaidu) => {
    if (!userLocationBaidu) return null;
    let nearest = null;
    let minDistance = Infinity;
    scenicAreas.forEach(area => {
      const centerLat = area.center.lat;
      const centerLng = area.center.lng;
      const distance = calculateDistance(userLocationBaidu.lat, userLocationBaidu.lng, centerLat, centerLng);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { ...area, distance };
      }
    });
    return nearest;
  };

  const autoSelectTargetArea = () => {
    if (!userLocation || scenicAreas.length === 0) return;
    console.log('Auto-selecting target area based on user location (BD-09):', userLocation);
    const userLocationBaidu = userLocation;
    // First, check if user is inside any scenic area boundary
    const currentArea = scenicAreas.find(area => isPointInBounds(userLocationBaidu, area));
    if (currentArea) {
      console.log('User is inside scenic area:', currentArea.name);
      setCurrentTargetArea(currentArea);
      return;
    }
    // If not inside any area, find the nearest one
    const nearestArea = getNearestArea(userLocationBaidu);
    if (nearestArea) {
      console.log('User is not in any area, selecting nearest:', nearestArea.name, 'distance:', nearestArea.distance);
      setCurrentTargetArea(nearestArea);
    }
  };

  // Auto-select target area based on user location (only if auto-selection is enabled)
  useEffect(() => {
    if (userLocation && scenicAreas.length > 0 && !isDebugMode && isAutoSelectionEnabled) {
      console.log('User location changed, auto-selecting target area (auto mode enabled)');
      autoSelectTargetArea();
    } else if (userLocation && scenicAreas.length > 0 && !isDebugMode && !isAutoSelectionEnabled) {
      console.log('User location changed, but auto-selection is disabled (manual mode)');
    }
  }, [userLocation, scenicAreas, isDebugMode, isAutoSelectionEnabled]);

  const setTargetArea = (area) => {
    setCurrentTargetArea(area);
  };

  const updateUserLocation = (newLocation) => {
    console.log('Manually updating user location:', newLocation);
    updateUserLocationCoordinates(newLocation, false);
  };

  const updateMockLocation = (newLocation) => {
    console.log('Updating mock location:', newLocation);
    setMockLocation(newLocation);
    updateUserLocationCoordinates(newLocation, true); // BD-09 from Baidu Map
    lastSpotsCalculationRef.current = newLocation;
    lastAreaCalculationRef.current = newLocation;
    
    // Trigger area selection for mock locations in debug mode (only if auto-selection is enabled)
    if (isDebugMode && scenicAreas.length > 0 && isAutoSelectionEnabled) {
      console.log('Debug mode: Triggering area selection for mock location (auto mode enabled)');
      autoSelectTargetArea();
    } else if (isDebugMode && scenicAreas.length > 0 && !isAutoSelectionEnabled) {
      console.log('Debug mode: Mock location updated, but auto-selection is disabled (manual mode)');
    }
  };

  const exitDebugMode = () => {
    localStorage.removeItem('debugMode');
    setIsDebugMode(false);
    console.log('Debug mode exited, localStorage cleared');
    
    // Start real geolocation when exiting debug mode
    console.log('Starting real geolocation after exiting debug mode');
    startLocationWatching();
  };

  // Auto-selection control functions
  const toggleAutoSelection = () => {
    const newValue = !isAutoSelectionEnabled;
    setIsAutoSelectionEnabled(newValue);
    localStorage.setItem('autoSelectionEnabled', newValue.toString());
    console.log('Auto-selection toggled:', newValue ? 'enabled' : 'disabled');
  };

  const setAutoSelectionEnabled = (enabled) => {
    setIsAutoSelectionEnabled(enabled);
    localStorage.setItem('autoSelectionEnabled', enabled.toString());
    console.log('Auto-selection set to:', enabled ? 'enabled' : 'disabled');
  };

  return (
    <TargetAreaContext.Provider
      value={{
        currentTargetArea,
        setCurrentTargetArea,
        scenicAreas,
        setScenicAreas,
        userLocation,
        userLocationWGS84,
        locationError,
        setLocationError,
        isDebugMode,
        setIsDebugMode,
        exitDebugMode,
        setTargetArea,
        updateUserLocation,
        updateMockLocation,
        isAutoSelectionEnabled,
        toggleAutoSelection,
        setAutoSelectionEnabled
      }}
    >
      {children}
    </TargetAreaContext.Provider>
  );
}; 