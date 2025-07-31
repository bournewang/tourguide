import * as turf from '@turf/turf';

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Check if a point is inside a circle boundary
 * @param {Object} point - Point with lat, lng properties
 * @param {Object} area - Area with center and radius properties
 * @returns {boolean} True if point is inside circle
 */
export const isPointInCircle = (point, area) => {
  if (!area.center || !area.radius) {
    return false;
  }
  
  const centerLat = area.center.lat;
  const centerLng = area.center.lng;
  const radius = area.radius;
  const distance = calculateDistance(point.lat, point.lng, centerLat, centerLng);
  
  return distance <= radius;
};

/**
 * Check if a point is inside a polygon boundary
 * @param {Object} point - Point with lat, lng properties
 * @param {Object} area - Area with polygon property (GeoJSON Feature)
 * @returns {boolean} True if point is inside polygon
 */
export const isPointInPolygon = (point, area) => {
  if (!area.polygon) {
    return false;
  }
  
  try {
    const turfPoint = turf.point([point.lng, point.lat]);
    return turf.booleanPointInPolygon(turfPoint, area.polygon);
  } catch (error) {
    console.error('Error checking point in polygon:', error);
    return false;
  }
};

/**
 * Check if a point is inside a scenic area boundary
 * Primary: Circle detection (fast)
 * Fallback: Polygon detection (precise)
 * @param {Object} point - Point with lat, lng properties
 * @param {Object} area - Scenic area object
 * @returns {boolean} True if point is inside area boundary
 */
export const isPointInBounds = (point, area) => {
  // First try circle detection (fast)
  if (isPointInCircle(point, area)) {
    return true;
  }
  
  // Fallback to polygon detection (precise)
  if (isPointInPolygon(point, area)) {
    return true;
  }
  
  return false;
};

/**
 * Generate a circular polygon from center and radius
 * @param {Object} center - Center point with lat, lng properties
 * @param {number} radius - Radius in meters
 * @param {number} steps - Number of points in the circle (default: 32)
 * @returns {Object} GeoJSON polygon
 */
export const createCirclePolygon = (center, radius, steps = 32) => {
  try {
    const circle = turf.circle([center.lng, center.lat], radius / 1000, { steps });
    return circle;
  } catch (error) {
    console.error('Error creating circle polygon:', error);
    return null;
  }
};

/**
 * Convert existing center-radius areas to include polygon boundaries (optional)
 * Only needed if you want to use polygon detection for all areas
 * @param {Array} areas - Array of scenic areas
 * @returns {Array} Updated areas with polygon boundaries
 */
export const addPolygonBoundaries = (areas) => {
  return areas.map(area => {
    if (area.center && area.radius && !area.polygon) {
      const polygon = createCirclePolygon(area.center, area.radius);
      if (polygon) {
        return { ...area, polygon };
      }
    }
    return area;
  });
};

/**
 * Find the nearest scenic area to a point
 * @param {Object} point - Point with lat, lng properties
 * @param {Array} areas - Array of scenic areas
 * @returns {Object|null} Nearest area with distance property
 */
export const getNearestArea = (point, areas) => {
  if (!point || !areas || areas.length === 0) {
    return null;
  }
  
  let nearest = null;
  let minDistance = Infinity;
  
  areas.forEach(area => {
    if (area.center) {
      const distance = calculateDistance(
        point.lat, point.lng,
        area.center.lat, area.center.lng
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { ...area, distance };
      }
    }
  });
  
  return nearest;
};

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    return `${(meters / 1000).toFixed(1)}km`;
  }
}; 