import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTargetArea } from '../hooks/useTargetArea';
import { dataService } from '../utils/dataService';

const ScenicAreaSelector = () => {
  const navigate = useNavigate();
  const { setTargetArea, currentTargetArea } = useTargetArea();
  const [scenicAreas, setScenicAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load visible scenic areas
  useEffect(() => {
    const loadScenicAreas = async () => {
      try {
        setLoading(true);
        const areas = await dataService.getVisibleScenicAreas();
        // filter visible areas
        const visibleAreas = areas.filter(area => area.display === 'show');
        setScenicAreas(visibleAreas);
        console.log('📍 Loaded scenic areas for selector:', areas.length);
      } catch (error) {
        console.error('Failed to load scenic areas:', error);
        setError('Failed to load scenic areas');
      } finally {
        setLoading(false);
      }
    };

    loadScenicAreas();
  }, []);

  const handleAreaSelect = (area) => {
    console.log('🎯 Selected area:', area.name);
    setTargetArea(area);
    navigate('/map');
  };



  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载景区数据中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Compact Header */}
      {/* <div className="bg-white border-b border-gray-200 px-2 py-1">
        <h1 className="text-lg font-semibold text-gray-800">选择景区</h1>
      </div> */}

      {/* Compact Grid Layout */}
      <div className="p-1">
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {scenicAreas.map((area) => (
            <div
              key={area.name}
              onClick={() => handleAreaSelect(area)}
              className={`relative rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border aspect-square flex flex-col ${
                currentTargetArea?.name === area.name
                  ? 'bg-blue-50 border-blue-400 shadow-md'
                  : 'bg-white border-gray-200 hover:border-blue-300'
              } group`}
            >
              {/* Color Indicator */}
              {/* <div 
                className={`h-1 rounded-t-lg ${
                  currentTargetArea?.name === area.name ? 'bg-blue-500' : ''
                }`}
                style={{ 
                  backgroundColor: currentTargetArea?.name === area.name 
                    ? '#3b82f6' 
                    : (area.color || '#3b82f6') 
                }}
              ></div> */}
              
              {/* Area Name */}
              <div className="flex-1 flex items-center justify-center p-2 text-center">
                <h3 className={`text-lg font-medium transition-colors leading-tight ${
                  currentTargetArea?.name === area.name
                    ? 'text-blue-700 font-semibold'
                    : 'text-gray-800 group-hover:text-blue-600'
                }`}>
                  {area.name}
                </h3>
              </div>
              
              {/* Selection Indicator */}
              {currentTargetArea?.name === area.name && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {scenicAreas.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-4xl mb-3">🗺️</div>
            <h3 className="text-lg font-medium text-gray-600 mb-1">暂无景区数据</h3>
            <p className="text-sm text-gray-500">请稍后再试</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenicAreaSelector; 