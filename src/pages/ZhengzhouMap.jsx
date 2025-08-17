import React, { useEffect, useRef, useState } from 'react';

const ZhengzhouMap = () => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [_markers, setMarkers] = useState([]);

  // 郑州市的地点数据
  const locations = [
    // B
    { name: '北大学城', lat: 34.8167, lng: 113.5333 },
    { name: '北龙湖', lat: 34.8000, lng: 113.7500 },
    { name: '北站', lat: 34.8333, lng: 113.6667 },
    
    // C
    { name: '财富广场', lat: 34.7500, lng: 113.6500 },
    { name: 'CBD', lat: 34.7333, lng: 113.7167 },
    { name: '陈寨', lat: 34.8000, lng: 113.6333 },
    
    // D
    { name: '大石桥', lat: 34.7667, lng: 113.6333 },
    { name: '东建材', lat: 34.7333, lng: 113.7333 },
    
    // E
    { name: '二七广场', lat: 34.7500, lng: 113.6500 },
    
    // H
    { name: '海洋馆', lat: 34.7167, lng: 113.7000 },
    { name: '鸿园片区', lat: 34.7833, lng: 113.6833 },
    { name: '花园路', lat: 34.7833, lng: 113.6667 },
    { name: '火车站', lat: 34.7500, lng: 113.6500 },
    
    // J
    { name: '金水北', lat: 34.8000, lng: 113.6667 },
    
    // K
    { name: '科技市场', lat: 34.7667, lng: 113.6667 },
    
    // L
    { name: '绿茵广场', lat: 34.7333, lng: 113.6833 },
    
    // N
    { name: '南阳路', lat: 34.7667, lng: 113.6500 },
    
    // P
    { name: '普罗旺世', lat: 34.7167, lng: 113.7167 },
    
    // Q
    { name: '轻工业学院', lat: 34.7000, lng: 113.6833 },
    { name: '青少年公园', lat: 34.7500, lng: 113.6833 },
    { name: '汽配大世界', lat: 34.7333, lng: 113.6167 },
    
    // R
    { name: '人民路', lat: 34.7500, lng: 113.6333 },
    
    // S
    { name: '沙口路', lat: 34.7833, lng: 113.6500 },
    { name: '商代遗址', lat: 34.7667, lng: 113.6833 },
    { name: '省人民医院', lat: 34.7667, lng: 113.6667 },
    { name: '省体育中心', lat: 34.7333, lng: 113.7000 },
    { name: '省中医院', lat: 34.7500, lng: 113.6667 },
    { name: '索凌路北段', lat: 34.8167, lng: 113.6833 },
    
    // W
    { name: '王府井', lat: 34.7500, lng: 113.6500 },
    { name: '未来大厦', lat: 34.7667, lng: 113.7000 },
    { name: '文博广场', lat: 34.7833, lng: 113.7167 },
    
    // X
    { name: '新北站', lat: 34.8500, lng: 113.6833 },
    { name: '徐寨', lat: 34.7000, lng: 113.6000 },
    
    // Y
    { name: '杨金路', lat: 34.7167, lng: 113.6167 },
    { name: '燕庄', lat: 34.7833, lng: 113.7333 },
    
    // Z
    { name: '枣庄', lat: 34.7000, lng: 113.7333 },
    { name: '紫荆山公园', lat: 34.7500, lng: 113.6667 }
  ];

  useEffect(() => {
    // 检查百度地图API是否已加载
    if (typeof window.BMap === 'undefined') {
      // 动态加载百度地图API
      const script = document.createElement('script');
      script.src = `https://api.map.baidu.com/api?v=3.0&ak=${import.meta.env.VITE_BAIDU_MAP_AK || 'YOUR_BAIDU_MAP_AK'}&callback=initBaiduMap`;
      script.async = true;
      
      window.initBaiduMap = () => {
        initializeMap();
      };
      
      document.head.appendChild(script);
      
      return () => {
        document.head.removeChild(script);
        delete window.initBaiduMap;
      };
    } else {
      initializeMap();
    }
  }, []);

  const initializeMap = () => {
    if (!mapRef.current) return;

    // 创建地图实例
    const mapInstance = new window.BMap.Map(mapRef.current);
    
    // 设置郑州市中心为地图中心点
    const zhengzhouCenter = new window.BMap.Point(113.6667, 34.7667);
    mapInstance.centerAndZoom(zhengzhouCenter, 11);
    
    // 启用滚轮缩放
    mapInstance.enableScrollWheelZoom(true);
    
    // 添加地图控件
    mapInstance.addControl(new window.BMap.NavigationControl());
    mapInstance.addControl(new window.BMap.ScaleControl());
    mapInstance.addControl(new window.BMap.OverviewMapControl());
    mapInstance.addControl(new window.BMap.MapTypeControl());
    
    setMap(mapInstance);
    
    // 添加标记点
    addMarkers(mapInstance);
  };

  const addMarkers = (mapInstance) => {
    const newMarkers = [];
    
    locations.forEach((location) => {
      const point = new window.BMap.Point(location.lng, location.lat);
      const marker = new window.BMap.Marker(point);
      
      // 创建信息窗口
      const infoWindow = new window.BMap.InfoWindow(`
        <div style="padding: 10px; min-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #333;">${location.name}</h4>
          <p style="margin: 0; color: #666; font-size: 12px;">
            经度: ${location.lng}<br/>
            纬度: ${location.lat}
          </p>
        </div>
      `);
      
      // 添加点击事件
      marker.addEventListener('click', () => {
        mapInstance.openInfoWindow(infoWindow, point);
      });
      
      // 添加标记到地图
      mapInstance.addOverlay(marker);
      newMarkers.push(marker);
    });
    
    setMarkers(newMarkers);
  };

  const handleLocationClick = (location) => {
    if (!map) return;
    
    const point = new window.BMap.Point(location.lng, location.lat);
    map.centerAndZoom(point, 15);
    
    // 创建并打开信息窗口
    const infoWindow = new window.BMap.InfoWindow(`
      <div style="padding: 10px; min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">${location.name}</h4>
        <p style="margin: 0; color: #666; font-size: 12px;">
          经度: ${location.lng}<br/>
          纬度: ${location.lat}
        </p>
      </div>
    `);
    
    map.openInfoWindow(infoWindow, point);
  };

  const groupLocationsByLetter = () => {
    const grouped = {};
    locations.forEach(location => {
      const firstChar = location.name.charAt(0);
      if (!grouped[firstChar]) {
        grouped[firstChar] = [];
      }
      grouped[firstChar].push(location);
    });
    return grouped;
  };

  const groupedLocations = groupLocationsByLetter();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左侧地点列表 */}
      <div className="w-80 bg-white shadow-lg overflow-y-auto">
        <div className="p-4 border-b bg-blue-600 text-white">
          <h2 className="text-xl font-bold">郑州市地点导航</h2>
          <p className="text-sm opacity-90">共 {locations.length} 个地点</p>
        </div>
        
        <div className="p-4">
          {Object.keys(groupedLocations).sort().map(letter => (
            <div key={letter} className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b pb-1">
                {letter}
              </h3>
              <div className="space-y-1">
                {groupedLocations[letter].map((location, index) => (
                  <button
                    key={`${letter}-${index}`}
                    onClick={() => handleLocationClick(location)}
                    className="w-full text-left p-2 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200 text-sm"
                  >
                    <div className="font-medium">{location.name}</div>
                    <div className="text-xs text-gray-500">
                      {location.lng}, {location.lat}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 右侧地图 */}
      <div className="flex-1 relative">
        <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3">
          <h3 className="font-semibold text-gray-800 mb-1">郑州市地点分布图</h3>
          <p className="text-sm text-gray-600">点击左侧地点或地图标记查看详情</p>
        </div>
        
        <div 
          ref={mapRef} 
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
        
        {/* 地图加载提示 */}
        {!map && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">正在加载百度地图...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZhengzhouMap;
