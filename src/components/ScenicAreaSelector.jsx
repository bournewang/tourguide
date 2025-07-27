import React, { useState } from 'react';

const ScenicAreaSelector = ({ 
  scenicAreas = [], 
  currentTargetArea, 
  onAreaSelect, 
  onGoToArea,
  className = "",
  showCollapsible = true,
  showCurrentAreaButton = true,
  showUserLocationButton = false,
  onUserLocationClick
}) => {
  const [showNavigationButtons, setShowNavigationButtons] = useState(false);

  if (!showCollapsible) {
    // Simple dropdown version for SpotList
    return (
      <div className={`bg-white rounded-lg shadow-lg border border-gray-200 ${className}`}>
        <select
          value={currentTargetArea?.name || ''}
          onChange={(e) => {
            const area = scenicAreas.find(a => a.name === e.target.value);
            if (area && onAreaSelect) {
              onAreaSelect(area);
            }
          }}
          className="w-full p-3 border-0 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent"
        >
          <option value="">选择景区</option>
          {scenicAreas.map(area => (
            <option key={area.name} value={area.name}>
              {area.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Collapsible version for MapView
  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setShowNavigationButtons(!showNavigationButtons)}
        className="w-full p-3 bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors duration-200 flex items-center justify-between"
        title={showNavigationButtons ? "收起导航按钮" : "展开导航按钮"}
      >
        <span>🗺️ 导航</span>
        <span className={`transform transition-transform duration-200 ${showNavigationButtons ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      
      {/* Collapsible Content */}
      {showNavigationButtons && (
        <div className="max-h-96 overflow-y-auto">
          {/* Scenic Area Navigation Buttons */}
          <div className="p-2">
            <div className="text-xs text-gray-500 mb-2 px-2">景区导航</div>
            {scenicAreas.map((area, index) => (
              <button
                key={area.name}
                onClick={() => {
                  if (onAreaSelect) {
                    onAreaSelect(area);
                  }
                }}
                className="w-full mb-1 p-2 text-left bg-gray-50 hover:bg-gray-100 text-gray-700 rounded transition-colors duration-200 flex items-center justify-between"
                title={`前往${area.name}`}
              >
                <span className="text-sm truncate">{area.name}</span>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">{index + 1}</span>
              </button>
            ))}
          </div>
          
          {/* Divider */}
          <div className="border-t border-gray-200 mx-2"></div>
          
          {/* Current Area Button */}
          {showCurrentAreaButton && (
            <div className="p-2">
              <div className="text-xs text-gray-500 mb-2 px-2">快速导航</div>
              
              {/* Current Area Button */}
              {currentTargetArea && onGoToArea && (
                <button
                  onClick={onGoToArea}
                  className="w-full mb-1 p-2 text-left bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors duration-200 flex items-center justify-between"
                  title="回到当前景区中心"
                >
                  <span className="text-sm">🏔️ 当前景区</span>
                  <span className="text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded-full">中心</span>
                </button>
              )}
              
              {/* User Location Button */}
              {showUserLocationButton && onUserLocationClick && (
                <button
                  onClick={onUserLocationClick}
                  className="w-full mb-1 p-2 text-left bg-green-50 hover:bg-green-100 text-green-700 rounded transition-colors duration-200 flex items-center justify-between"
                  title="定位到我的位置"
                >
                  <span className="text-sm">🔴 我的位置</span>
                  <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded-full">定位</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScenicAreaSelector; 