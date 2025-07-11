import { useState, useEffect, useRef } from 'react';
import { TargetAreaContext } from './TargetAreaContextDef';
import { wgs84ToBaidu } from '../utils/coordinateUtils';
import { dataService } from '../utils/dataService';

export const TargetAreaProvider = ({ children }) => {
  const [currentTargetArea, setCurrentTargetArea] = useState(null);
  const [scenicAreas, setScenicAreas] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationWatching, setIsLocationWatching] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const watchIdRef = useRef(null);
  const lastSpotsCalculationRef = useRef(null);
  const lastAreaCalculationRef = useRef(null);

  // Check for test mode on initialization
  useEffect(() => {
    const testMode = localStorage.getItem('testMode') === 'true';
    setIsTestMode(testMode);
    console.log('Test mode:', testMode);
    
    if (testMode) {
      // Load initial mock location if available
      const mockLocation = getMockLocation();
      if (mockLocation) {
        console.log('Loaded mock location:', mockLocation);
        setUserLocation(mockLocation);
        lastSpotsCalculationRef.current = mockLocation;
        lastAreaCalculationRef.current = mockLocation;
      }
    }
  }, []);

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

  const toggleTestMode = () => {
    const newTestMode = !isTestMode;
    setIsTestMode(newTestMode);
    localStorage.setItem('testMode', newTestMode.toString());
    console.log('Test mode toggled:', newTestMode);
    
    if (newTestMode) {
      // Stop real geolocation if it was running
      stopLocationWatching();
      // Load mock location
      const mockLocation = getMockLocation();
      if (mockLocation) {
        setUserLocation(mockLocation);
        lastSpotsCalculationRef.current = mockLocation;
        lastAreaCalculationRef.current = mockLocation;
      }
    } else {
      // Switch back to real geolocation
      startLocationWatching();
    }
  };

  // Load scenic areas
  useEffect(() => {
    const loadScenicAreas = async () => {
      try {
        console.log('TargetAreaContext: Loading scenic areas using dataService...');
        const data = await dataService.getScenicAreas();
        console.log('TargetAreaContext: Loaded scenic areas:', data);
        setScenicAreas(data);
      } catch (error) {
        console.error('TargetAreaContext: Failed to load scenic areas:', error);
      }
    };
    loadScenicAreas();
  }, []);

  // Start automatic location monitoring
  useEffect(() => {
    // Don't start real geolocation if in test mode
    if (isTestMode) {
      console.log('Test mode active, skipping real geolocation');
      return;
    }

    if (!navigator.geolocation) {
      console.log('Geolocation not available');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000 // Accept cached positions up to 30 seconds old
    };

    // First get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const initialLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        console.log('Initial location:', initialLocation);
        setUserLocation(initialLocation);
        lastSpotsCalculationRef.current = initialLocation;
        lastAreaCalculationRef.current = initialLocation;
        
        // Then start continuous monitoring
        startLocationWatching();
      },
      (error) => {
        console.log('Initial geolocation error:', error);
        // Still start watching in case permission is granted later
        startLocationWatching();
      },
      options
    );

    return () => {
      stopLocationWatching();
    };
  }, [isTestMode]);

  // Start continuous location monitoring
  const startLocationWatching = () => {
    // Don't start real geolocation if in test mode
    if (isTestMode) {
      console.log('Test mode active, skipping real geolocation watching');
      return;
    }

    if (!navigator.geolocation || isLocationWatching) return;

    const options = {
      enableHighAccuracy: true,
      timeout: 3000,
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
          
          console.log(`Spots distance calculation: ${spotsDistance.toFixed(2)}m (threshold: 10m)`);
          
          if (spotsDistance >= 10) {
            console.log(`✅ Moved ${spotsDistance.toFixed(1)}m, triggering spots recalculation`);
            lastSpotsCalculationRef.current = newLocation;
            // Only update userLocation when movement exceeds threshold
            setUserLocation(newLocation);
          } else {
            console.log(`❌ Movement ${spotsDistance.toFixed(1)}m is below 10m threshold, NOT triggering spots recalculation`);
            // Don't update userLocation for small movements
          }
        } else {
          console.log('No last spots calculation location, setting initial reference');
          lastSpotsCalculationRef.current = newLocation;
          // Set initial userLocation
          setUserLocation(newLocation);
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
    console.log('TargetAreaContext: scenicAreas.length:', scenicAreas.length, 'currentTargetArea:', currentTargetArea);
    
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

  const isPointInBounds = (pointBaidu, bounds) => {
    // Both point and bounds are now in Baidu coordinate system
    return pointBaidu.lat >= bounds.sw.lat && 
           pointBaidu.lat <= bounds.ne.lat && 
           pointBaidu.lng >= bounds.sw.lng && 
           pointBaidu.lng <= bounds.ne.lng;
  };

  const getNearestArea = (userLocationBaidu) => {
    if (!userLocationBaidu) return null;
    
    let nearest = null;
    let minDistance = Infinity;
    
    scenicAreas.forEach(area => {
      // Both user location and area bounds are in Baidu BD-09, calculate center
      const centerLat = (area.bounds.sw.lat + area.bounds.ne.lat) / 2;
      const centerLng = (area.bounds.sw.lng + area.bounds.ne.lng) / 2;
      
      // Calculate distance in Baidu coordinate system
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
    
    console.log('Auto-selecting target area based on user location (WGS-84):', userLocation);
    
    // Convert user location from WGS-84 to Baidu for all calculations
    const userLocationBaidu = wgs84ToBaidu(userLocation.lat, userLocation.lng);
    console.log('User location converted to Baidu:', userLocationBaidu);
    
    // First, check if user is inside any scenic area boundary
    const currentArea = scenicAreas.find(area => isPointInBounds(userLocationBaidu, area.bounds));
    
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

  // Auto-select target area based on user location (both automatic and manual)
  useEffect(() => {
    if (userLocation && scenicAreas.length > 0) {
      console.log('User location changed, auto-selecting target area');
      autoSelectTargetArea();
    }
  }, [userLocation, scenicAreas]);

  const setTargetArea = (area) => {
    setCurrentTargetArea(area);
  };

  const updateUserLocation = (newLocation) => {
    console.log('Manually updating user location:', newLocation);
    setUserLocation(newLocation);
  };

  const updateMockLocation = (newLocation) => {
    console.log('Updating mock location:', newLocation);
    setMockLocation(newLocation);
    setUserLocation(newLocation);
    lastSpotsCalculationRef.current = newLocation;
    lastAreaCalculationRef.current = newLocation;
  };

  const value = {
    currentTargetArea,
    setTargetArea,
    scenicAreas,
    userLocation,
    setUserLocation: updateUserLocation,
    autoSelectTargetArea,
    isLocationWatching,
    isTestMode,
    toggleTestMode,
    updateMockLocation
  };

  return (
    <TargetAreaContext.Provider value={value}>
      {children}
    </TargetAreaContext.Provider>
  );
}; 