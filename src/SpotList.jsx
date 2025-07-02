import { useState, useEffect } from 'react';
import spots from './shaolin.json';

function SpotList({ onSpotClick }) {
  const [userLocation, setUserLocation] = useState(null);
  const [spotsWithDistance, setSpotsWithDistance] = useState(
    // Initialize with original spots sequence
    spots.map(spot => ({ ...spot, distance: null }))
  );
  const [locationError, setLocationError] = useState(null);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  // Format distance for display
  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}米`;
    } else {
      return `${distance.toFixed(1)}公里`;
    }
  };

  // Get user's location and calculate distances
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLon = position.coords.longitude;
          setUserLocation({ lat: userLat, lon: userLon });

          // Calculate distances and sort by nearest
          const spotsWithDist = spots.map(spot => ({
            ...spot,
            distance: calculateDistance(userLat, userLon, spot.latitude, spot.longitude)
          })).sort((a, b) => a.distance - b.distance);

          setSpotsWithDistance(spotsWithDist);
        },
        (error) => {
          setLocationError(error.message);
          // Keep original sequence if location access denied
          setSpotsWithDistance(spots.map(spot => ({ ...spot, distance: null })));
        }
      );
    } else {
      setLocationError('浏览器不支持定位功能');
      // Keep original sequence if geolocation not supported
      setSpotsWithDistance(spots.map(spot => ({ ...spot, distance: null })));
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-3xl mx-auto px-6">
        <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">
          🏯 少林寺景点导览
        </h1>
        
        {/* Location status */}
        {locationError ? (
          <div className="bg-red-50 rounded-2xl p-4 mb-6 text-center shadow-sm">
            <p className="text-base text-red-600">
              📍 无法获取位置: {locationError}
            </p>
          </div>
        ) : userLocation ? (
          <div className="bg-green-50 rounded-2xl p-4 mb-6 text-center shadow-sm">
            <p className="text-base text-green-600 font-medium">
              ✅ 已获取您的位置，按距离远近排序
            </p>
          </div>
        ) : (
          <div className="bg-yellow-50 rounded-2xl p-4 mb-6 text-center shadow-sm">
            <p className="text-base text-yellow-600">
              ⏳ 正在获取您的位置，请稍候...
            </p>
          </div>
        )}
        
        <div className="space-y-3">
          {spotsWithDistance.map((spot, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 flex items-center space-x-6 hover:shadow-lg cursor-pointer shadow-sm transition-all duration-200 hover:-translate-y-1"
              onClick={() => onSpotClick && onSpotClick(spot)}
            >
              <img
                src={spot.image_thumb}
                alt={spot.name}
                className="w-20 h-20 object-cover rounded-xl"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/80x80/f3f4f6/9ca3af?text=' + encodeURIComponent(spot.name);
                }}
              />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{spot.name}</h3>
                <div className="space-y-1">
                  {/* <p className="text-base text-gray-600">
                    ⏱️ 参观时长: {spot.suggested_duration}
                  </p> */}
                  {spot.distance !== null && (
                    <p className="text-base text-blue-600 font-semibold">
                      📍 {formatDistance(spot.distance)}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-blue-500 text-2xl font-bold">
                ▶
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-base text-gray-600">
            👆 点击任意景点查看详情和听取讲解
          </p>
        </div>
      </div>
    </div>
  );
}

export default SpotList;
