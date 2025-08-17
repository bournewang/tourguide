import React, { useState, useEffect } from 'react';
import ScenicAreasFetcher from '../../components/admin/ScenicAreasFetcher';

const ProvincesDashboard = () => {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [showFetcher, setShowFetcher] = useState(false);

  useEffect(() => {
    fetchProvinces();
  }, []);

  const fetchProvinces = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/admin/provinces');
      const data = await response.json();
      
      if (data.success) {
        setProvinces(data.provinces);
      } else {
        console.error('Failed to fetch provinces:', data.error);
      }
    } catch (error) {
      console.error('Error fetching provinces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProvinceSelect = (province) => {
    setSelectedProvince(province);
    setShowFetcher(true);
  };

  const handleCityProcessing = async (provinceId, cityId, action) => {
    try {
      let endpoint = '';
      let method = 'POST';
      
      switch (action) {
        case 'searchSpots':
          endpoint = `http://localhost:3001/api/admin/provinces/${provinceId}/cities/${cityId}/spots/search`;
          break;
        case 'generateSummary':
          endpoint = `http://localhost:3001/api/admin/provinces/${provinceId}/cities/${cityId}/summary/generate`;
          break;
        case 'processNarration':
          endpoint = `http://localhost:3001/api/admin/provinces/${provinceId}/cities/${cityId}/narration/process`;
          break;
        default:
          return;
      }

      const response = await fetch(endpoint, { method });
      const data = await response.json();
      
      if (data.success) {
        alert(`${action} 任务已创建: ${data.message}`);
        // Refresh provinces data
        fetchProvinces();
      } else {
        alert(`操作失败: ${data.error}`);
      }
    } catch (error) {
      console.error(`Error in ${action}:`, error);
      alert(`操作失败: ${error.message}`);
    }
  };

  const handleStartAll = async (province) => {
    if (!confirm(`确定要开始处理 ${province.name} 的所有任务吗？\n\n这将包括：\n1. AI获取景区数据\n2. 创建城市结构\n3. 搜索所有景点\n4. 生成摘要\n5. 处理解说音频\n\n这可能需要较长时间完成。`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/admin/provinces/${province.id}/start-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh: false // Set to true if you want to refresh AI cache
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`🚀 已启动 ${province.name} 的完整处理流程！\n\n` +
              `📊 处理统计：\n` +
              `• 城市数量: ${data.results.cities.length}\n` +
              `• 总任务数: ${data.results.totalTasks}\n` +
              `• 数据来源: ${data.scenicAreasData.fromCache ? '缓存' : 'AI新获取'}\n\n` +
              `请在任务监控页面查看进度。`);
        
        // Refresh provinces data
        fetchProvinces();
      } else {
        alert(`启动失败: ${data.error}`);
      }
    } catch (error) {
      console.error('Error starting all tasks:', error);
      alert(`启动失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">加载省份数据...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">省份管理</h2>
        <button
          onClick={fetchProvinces}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          🔄 刷新数据
        </button>
      </div>

      {/* Provinces Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {provinces.map((province) => (
          <div key={province.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">{province.name}</h3>
              <span className="text-sm text-gray-500">
                {province.processedCities}/{province.citiesCount} 已处理
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">城市数量:</span>
                <span className="font-medium">{province.citiesCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">已处理:</span>
                <span className="font-medium text-green-600">{province.processedCities}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">待处理:</span>
                <span className="font-medium text-orange-600">
                  {province.citiesCount - province.processedCities}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t space-y-2">
              <button
                onClick={() => handleProvinceSelect(province)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                🤖 AI获取景区数据
              </button>
              <button
                onClick={() => handleStartAll(province)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium text-center"
                style={{ display: 'block', minHeight: '40px' }}
              >
                🚀 开始全部任务
              </button>
            </div>

            {/* Cities List */}
            {province.cities.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-2">城市列表:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {province.cities.map((city) => (
                    <div key={city.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{city.name}</span>
                        {city.hasData && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            ✓ 已处理
                          </span>
                        )}
                      </div>
                      
                      {city.hasData && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleCityProcessing(province.id, city.id, 'searchSpots')}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            title="搜索景点"
                          >
                            🔍
                          </button>
                          <button
                            onClick={() => handleCityProcessing(province.id, city.id, 'generateSummary')}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            title="生成摘要"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => handleCityProcessing(province.id, city.id, 'processNarration')}
                            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                            title="处理解说"
                          >
                            🎤
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add New Province */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">添加新省份</h3>
        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="输入省份名称 (如: 河南)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => handleProvinceSelect({ id: 'new', name: '新省份' })}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            🤖 AI获取数据
          </button>
        </div>
      </div>

      {/* Scenic Areas Fetcher Modal */}
      {showFetcher && selectedProvince && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  AI获取景区数据 - {selectedProvince.name}
                </h3>
                <button
                  onClick={() => {
                    setShowFetcher(false);
                    setSelectedProvince(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <ScenicAreasFetcher
                provinceId={selectedProvince.id}
                onDataFetched={(data) => {
                  console.log('Scenic areas data fetched:', data);
                }}
                onComplete={() => {
                  setShowFetcher(false);
                  setSelectedProvince(null);
                  fetchProvinces(); // Refresh the provinces list
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvincesDashboard;
