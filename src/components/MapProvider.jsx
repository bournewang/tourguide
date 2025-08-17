import React, { useState, useEffect } from 'react';
import MapView from '../MapView';
import AMapView from '../AMapView';

/**
 * MapProvider component that dynamically selects the appropriate map component
 * based on the configured map provider (Baidu or AMap)
 */
const MapProvider = () => {
  const [mapProvider, setMapProvider] = useState('baidu'); // Default to Baidu
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the map provider configuration
    const fetchMapProvider = async () => {
      try {
        setLoading(true);
        const response = await fetch('/config.json');
        if (!response.ok) {
          throw new Error('Failed to load configuration');
        }
        
        const config = await response.json();
        if (config && config.mapProvider) {
          console.log('🗺️ Using map provider from config:', config.mapProvider);
          setMapProvider(config.mapProvider.toLowerCase());
        } else {
          console.log('⚠️ No map provider specified in config, using default: baidu');
          setMapProvider('baidu');
        }
      } catch (error) {
        console.error('Error loading map provider configuration:', error);
        console.log('⚠️ Using default map provider: baidu');
        setMapProvider('baidu');
      } finally {
        setLoading(false);
      }
    };

    fetchMapProvider();
  }, []);

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载地图中...</p>
        </div>
      </div>
    );
  }

  // Render the appropriate map component based on the provider
  return mapProvider === 'amap' ? <AMapView /> : <MapView />;
};

export default MapProvider;
