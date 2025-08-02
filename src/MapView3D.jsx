import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTargetArea } from './hooks/useTargetArea';
import { ttsService } from './utils/ttsService';

const MapView3D = () => {
  const navigate = useNavigate();
  const { currentTargetArea, userLocation } = useTargetArea();
  const BAIDU_API_KEY = 'nxCgqEZCeYebMtEi2YspKyYElw9GuCiv';

  // load map script and init
  useEffect(() => {
    if (!currentTargetArea) {
      navigate('/select-area');
      return;
    }

    const loadScript = (src) => (
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      })
    );

    const initializeMap = async () => {
      const centerLng = currentTargetArea.center?.lng || 113.05;
      const centerLat = currentTargetArea.center?.lat || 34.49;
      const zoomLevel = currentTargetArea.level || 16;

      const mapInstance = new window.BMapGL.Map('baidu-3d-map', {
        enableTilt: true,
        enableRotate: true,
      });
      const centerPoint = new window.BMapGL.Point(centerLng, centerLat);
      mapInstance.centerAndZoom(centerPoint, zoomLevel);
      mapInstance.enableScrollWheelZoom(true);
      mapInstance.setTilt(60);
      mapInstance.setHeading(0);

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

      // draw user location
      if (userLocation) {
        const point = new window.BMapGL.Point(userLocation.lng, userLocation.lat);
        const marker = new window.BMapGL.Marker(point);
        mapInstance.addOverlay(marker);
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
  }, [currentTargetArea, navigate, userLocation]);

  return <div id="baidu-3d-map" className="w-full h-full" />;
};

export default MapView3D;

