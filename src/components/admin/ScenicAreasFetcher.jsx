import React, { useState } from 'react';

const ScenicAreasFetcher = ({ provinceId, onDataFetched, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selectedCities, setSelectedCities] = useState([]);
  const [error, setError] = useState(null);

  const fetchScenicAreas = async (refresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://localhost:3001/api/admin/provinces/${provinceId}/scenic-areas/fetch${refresh ? '?refresh=true' : ''}`
      );
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        onDataFetched && onDataFetched(result.data);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveScenicAreas = async () => {
    if (!selectedCities.length) {
      alert('请选择至少一个城市');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:3001/api/admin/provinces/${provinceId}/scenic-areas/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scenicAreas: data,
          selectedCities
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`成功为 ${result.results.length} 个城市创建了数据结构任务`);
        onComplete && onComplete();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCitySelection = (cityName) => {
    setSelectedCities(prev => 
      prev.includes(cityName) 
        ? prev.filter(c => c !== cityName)
        : [...prev, cityName]
    );
  };

  const selectAllCities = () => {
    if (data && data.cities) {
      setSelectedCities(Object.keys(data.cities));
    }
  };

  const clearSelection = () => {
    setSelectedCities([]);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4">
        <button 
          onClick={() => fetchScenicAreas(false)} 
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '获取中...' : '🤖 AI获取景区数据 (缓存)'}
        </button>
        
        <button 
          onClick={() => fetchScenicAreas(true)} 
          disabled={loading}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '获取中...' : '🔄 刷新AI数据'}
        </button>

        {data && (
          <>
            <button 
              onClick={selectAllCities}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              ✅ 全选城市
            </button>
            
            <button 
              onClick={clearSelection}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              ❌ 清空选择
            </button>
          </>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">错误</h3>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">AI正在分析景区数据...</span>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              🗺️ {data.province} 省景区数据
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-600">城市数量:</span>
                <span className="ml-2 font-medium">{Object.keys(data.cities).length}</span>
              </div>
              <div>
                <span className="text-blue-600">总景区数:</span>
                <span className="ml-2 font-medium">
                  {Object.values(data.cities).reduce((sum, areas) => sum + areas.length, 0)}
                </span>
              </div>
              <div>
                <span className="text-blue-600">已选城市:</span>
                <span className="ml-2 font-medium text-green-600">{selectedCities.length}</span>
              </div>
              <div>
                <span className="text-blue-600">缓存状态:</span>
                <span className={`ml-2 font-medium ${data.fromCache ? 'text-green-600' : 'text-orange-600'}`}>
                  {data.fromCache ? '缓存数据' : '新获取'}
                </span>
              </div>
            </div>
          </div>

          {/* Cities Selection */}
          <div className="bg-white border border-gray-200 rounded-md">
            <div className="px-4 py-3 border-b border-gray-200">
              <h4 className="text-lg font-medium text-gray-900">选择要处理的城市</h4>
              <p className="text-sm text-gray-600 mt-1">
                选择的城市将创建数据结构并保存景区信息
              </p>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data.cities).map(([cityName, areas]) => (
                  <div key={cityName} className="border border-gray-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCities.includes(cityName)}
                          onChange={() => toggleCitySelection(cityName)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-lg font-medium text-gray-900">{cityName}</span>
                      </label>
                      <span className="text-sm text-gray-500">
                        {areas.length} 个景区
                      </span>
                    </div>
                    
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {areas.map((area, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{area.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            area.level === '5A' ? 'bg-red-100 text-red-800' :
                            area.level === '4A' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {area.level}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end space-x-4">
            <button 
              onClick={saveScenicAreas}
              disabled={loading || !selectedCities.length}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '保存中...' : `💾 保存选中的 ${selectedCities.length} 个城市`}
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!data && !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">使用说明</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>1. 点击 "AI获取景区数据" 按钮，系统将使用AI分析该省份的5A/4A/3A级景区</p>
            <p>2. AI将按城市分组返回景区信息，包括名称、等级、地址、坐标等</p>
            <p>3. 选择要处理的城市，系统将为每个城市创建数据结构</p>
            <p>4. 保存后可以继续进行景点搜索、摘要生成、解说处理等步骤</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenicAreasFetcher;
