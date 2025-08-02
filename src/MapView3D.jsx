import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTargetArea } from './hooks/useTargetArea';
import { ttsService } from './utils/ttsService';
import { requestOrientationPermission, getCompassHeading } from './utils/orientation';

const MapView3D = () => {
  const navigate = useNavigate();
  const { currentTargetArea, userLocation } = useTargetArea();
  const BAIDU_API_KEY = 'nxCgqEZCeYebMtEi2YspKyYElw9GuCiv';
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const orientationCleanupRef = useRef(null);
  const [userHeading, setUserHeading] = useState(0);
  const [orientationAvailable, setOrientationAvailable] = useState(false);

  // handle device orientation
  const setupOrientation = () => {
    if (!window.DeviceOrientationEvent) return;
    if (orientationCleanupRef.current) orientationCleanupRef.current();
    const handleOrientation = (event) => {
      const heading = getCompassHeading(event);
      if (typeof heading === 'number') {
        setUserHeading(heading);
        setOrientationAvailable(true);
      }
    };
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    window.addEventListener('deviceorientation', handleOrientation);
    orientationCleanupRef.current = () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  };

  // load map script and initialize when target area is available
  useEffect(() => {
    if (!currentTargetArea) {
      navigate('/select-area');
      return;
    }

    const initOrientation = async () => {
      const granted = await requestOrientationPermission();
      if (granted) setupOrientation();
    };
    initOrientation();

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

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
      mapRef.current = mapInstance;

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

    return () => {
      if (orientationCleanupRef.current) orientationCleanupRef.current();
    };
  }, [currentTargetArea, navigate]);

  // update user location marker
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    const point = new window.BMapGL.Point(userLocation.lng, userLocation.lat);
    if (!userMarkerRef.current) {
      const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'>` +
        `<path d='M12 2L20 22L12 17L4 22Z' fill='#3b82f6' stroke='white' stroke-width='2' stroke-linejoin='round'/></svg>`;
      const icon = new window.BMapGL.Icon(
        `data:image/svg+xml;base64,${window.btoa(svg)}`,
        new window.BMapGL.Size(32, 32),
        { anchor: new window.BMapGL.Size(16, 16) }
      );
      const marker = new window.BMapGL.Marker(point, { icon });
      mapRef.current.addOverlay(marker);
      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setPosition(point);
    }

    if (orientationAvailable && userMarkerRef.current) {
      userMarkerRef.current.setRotation((360 - userHeading) % 360);
    }
  }, [userLocation, userHeading, orientationAvailable]);

  const handleGoToUserLocation = async () => {
    if (mapRef.current && userLocation) {
      const point = new window.BMapGL.Point(userLocation.lng, userLocation.lat);
      mapRef.current.centerAndZoom(point, 18);
    }
    if (!orientationAvailable) {
      const granted = await requestOrientationPermission();
      if (granted) {
        setupOrientation();
      }
    }
  };

  return (
    <div className="w-full h-full relative">
      <div id="baidu-3d-map" className="w-full h-full" />
      <div className="absolute bottom-24 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleGoToUserLocation();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleGoToUserLocation();
          }}
          disabled={!userLocation}
          className={`p-3 rounded-full shadow-lg border transition-colors duration-200 flex items-center justify-center touch-manipulation ${
            userLocation
              ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white border-red-200 cursor-pointer'
              : 'bg-gray-300 text-gray-500 border-gray-200 cursor-not-allowed'
          }`}
          title={userLocation ? '我的位置' : '位置不可用'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L20 22L12 17L4 22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MapView3D;

