import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTargetArea } from '../hooks/useTargetArea';
import { dataService } from '../utils/dataService';
import { useCity } from '../components/CityLayout';

const ScenicAreaSelector = () => {
  const navigate = useNavigate();
  const { cityId } = useCity();
  const { setTargetArea, currentTargetArea, isAutoSelectionEnabled, toggleAutoSelection } = useTargetArea();
  const [scenicAreas, setScenicAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load visible scenic areas
  useEffect(() => {
    const loadScenicAreas = async () => {
      if (!cityId) {
        setLoading(false);
        setError('City not selected');
        return;
      }
      try {
        setLoading(true);
        const areas = await dataService.getVisibleScenicAreas(cityId);
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
  }, [cityId]);

  const handleAreaSelect = (area) => {
    console.log('🎯 Selected area:', area.name);
    setTargetArea(area);
    navigate(`/city/${cityId}/map`);
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
      {/* Header with Auto-Selection Switcher */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">选择景区</h1>
        
        {/* Auto-Selection Toggle */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">自动选择</span>
          <button
            onClick={toggleAutoSelection}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isAutoSelectionEnabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            title={isAutoSelectionEnabled ? '自动选择已启用' : '自动选择已禁用'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isAutoSelectionEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-xs text-gray-500">
            {isAutoSelectionEnabled ? '开启' : '关闭'}
          </span>
        </div>
      </div>

      {/* Auto-Select Info Message */}
      {isAutoSelectionEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mx-1 mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">自动选择已启用</p>
              <p className="text-xs text-blue-600">系统将根据您的位置自动选择景区，无需手动选择</p>
            </div>
          </div>
        </div>
      )}

      {/* Compact Grid Layout */}
      <div className="p-1">
        <div className={`grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 ${
          isAutoSelectionEnabled ? 'pointer-events-none opacity-60' : ''
        }`}>
          {scenicAreas.map((area) => (
            <div
              key={area.name}
              onClick={() => !isAutoSelectionEnabled && handleAreaSelect(area)}
              className={`relative rounded-lg shadow-sm transition-all duration-200 border aspect-square flex flex-col ${
                isAutoSelectionEnabled 
                  ? 'cursor-not-allowed bg-gray-100 border-gray-300'
                  : currentTargetArea?.name === area.name
                    ? 'bg-green-50 border-green-400 shadow-md cursor-pointer hover:shadow-md'
                    : 'bg-white border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-md'
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
                  isAutoSelectionEnabled
                    ? 'text-gray-500'
                    : currentTargetArea?.name === area.name
                      ? 'text-green-700 font-semibold'
                      : 'text-gray-800 group-hover:text-blue-600'
                }`}>
                  {area.name}
                </h3>
              </div>
              
              {/* Selection Indicator */}
              {currentTargetArea?.name === area.name && (
                <div className="absolute top-2 right-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${
                    isAutoSelectionEnabled ? 'bg-gray-400' : 'bg-green-500'
                  }`}>
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  {/* Mode indicator */}
                  <div className="absolute -bottom-1 -right-1">
                    <div className={`w-3 h-3 rounded-full border-2 border-white ${
                      isAutoSelectionEnabled ? 'bg-gray-300' : 'bg-green-400'
                    }`} title={isAutoSelectionEnabled ? '自动选择' : '手动选择'}></div>
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