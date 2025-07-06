// Coordinate conversion utilities for Baidu Maps API

// Convert Baidu BD-09 coordinates to WGS-84 (GPS standard)
export function baiduToWgs84(bdLat, bdLng) {
  const X_PI = Math.PI * 3000.0 / 180.0;
  const PI = Math.PI;
  const A = 6378245.0;
  const EE = 0.006693421622965943;
  
  // BD-09 to GCJ-02
  const x = bdLng - 0.0065;
  const y = bdLat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  const gcjLng = z * Math.cos(theta);
  const gcjLat = z * Math.sin(theta);
  
  // GCJ-02 to WGS-84
  const dlat = transformLat(gcjLng - 105.0, gcjLat - 35.0);
  const dlng = transformLng(gcjLng - 105.0, gcjLat - 35.0);
  const radlat = gcjLat / 180.0 * PI;
  let magic = Math.sin(radlat);
  magic = 1 - EE * magic * magic;
  const sqrtmagic = Math.sqrt(magic);
  const dlat2 = (dlat * 180.0) / ((A * (1 - EE)) / (magic * sqrtmagic) * PI);
  const dlng2 = (dlng * 180.0) / (A / sqrtmagic * Math.cos(radlat) * PI);
  const mglat = gcjLat - dlat2;
  const mglng = gcjLng - dlng2;
  
  return {
    lat: Number(mglat.toFixed(6)),
    lng: Number(mglng.toFixed(6))
  };
}

// Convert WGS-84 (GPS) coordinates to Baidu BD-09 for display
export function wgs84ToBaidu(wgsLat, wgsLng) {
  const X_PI = Math.PI * 3000.0 / 180.0;
  const PI = Math.PI;
  const A = 6378245.0;
  const EE = 0.006693421622965943;
  
  // WGS-84 to GCJ-02
  const dlat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
  const dlng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radlat = wgsLat / 180.0 * PI;
  let magic = Math.sin(radlat);
  magic = 1 - EE * magic * magic;
  const sqrtmagic = Math.sqrt(magic);
  const dlat2 = (dlat * 180.0) / ((A * (1 - EE)) / (magic * sqrtmagic) * PI);
  const dlng2 = (dlng * 180.0) / (A / sqrtmagic * Math.cos(radlat) * PI);
  const gcjLat = wgsLat + dlat2;
  const gcjLng = wgsLng + dlng2;
  
  // GCJ-02 to BD-09
  const z = Math.sqrt(gcjLng * gcjLng + gcjLat * gcjLat) + 0.00002 * Math.sin(gcjLat * X_PI);
  const theta = Math.atan2(gcjLat, gcjLng) + 0.000003 * Math.cos(gcjLng * X_PI);
  const bdLng = z * Math.cos(theta) + 0.0065;
  const bdLat = z * Math.sin(theta) + 0.006;
  
  return { lat: bdLat, lng: bdLng };
}

// Helper functions for coordinate transformations
function transformLat(lng, lat) {
  const PI = Math.PI;
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(lng, lat) {
  const PI = Math.PI;
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

// Calculate distance between two points using Haversine formula
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Format distance for display
export function formatDistance(distance) {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}米`;
  } else {
    return `${distance.toFixed(1)}公里`;
  }
} 