import React, { useState, useEffect } from 'react';

const CacheManager = () => {
  const [cacheStatus, setCacheStatus] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCacheStatus();
  }, []);

  const fetchCacheStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/cache/status');
      const data = await response.json();
      
      if (data.success) {
        setCacheStatus(data.cache);
      } else {
        console.error('Failed to fetch cache status:', data.error);
      }
    } catch (error) {
      console.error('Error fetching cache status:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearProvinceCache = async (provinceId) => {
    try {
      const response = await fetch(`/api/admin/cache/provinces/${provinceId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchCacheStatus();
      } else {
        alert(`清理失败: ${data.error}`);
      }
    } catch (error) {
      alert(`清理失败: ${error.message}`);
    }
  };

  const clearAllCache = async () => {
    if (!confirm('确定要清理所有缓存吗？')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/cache/all', {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchCacheStatus();
      } else {
        alert(`清理失败: ${data.error}`);
      }
    } catch (error) {
      alert(`清理失败: ${error.message}`);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}小时${remainingMinutes}分钟`;
  };

  const getStatusColor = (expired) => {
    return expired ? 'text-red-600' : 'text-green-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">加载缓存状态...</span>
      </div>
    );
  }

  const cacheEntries = Object.entries(cacheStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">缓存管理</h2>
        <div className="flex space-x-4">
          <button
            onClick={clearAllCache}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            🗑️ 清理所有缓存
          </button>
          <button
            onClick={fetchCacheStatus}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            🔄 刷新状态
          </button>
        </div>
      </div>

      {/* Cache Overview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">缓存概览</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{cacheEntries.length}</div>
            <div className="text-sm text-blue-800">缓存条目总数</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {cacheEntries.filter(([, status]) => !status.expired).length}
            </div>
            <div className="text-sm text-green-800">有效缓存</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {cacheEntries.filter(([, status]) => status.expired).length}
            </div>
            <div className="text-sm text-red-800">过期缓存</div>
          </div>
        </div>
      </div>

      {/* Cache Details */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">缓存详情</h3>
        </div>
        
        {cacheEntries.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            暂无缓存数据
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {cacheEntries.map(([key, status]) => {
              const provinceId = key.replace('scenic_areas_', '');
              
              return (
                <div key={key} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-lg font-medium text-gray-900">
                          {provinceId} 省景区数据
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          status.expired 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {status.expired ? '已过期' : '有效'}
                        </span>
                      </div>
                      
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">缓存时长:</span>
                          <span className="ml-2">{formatTime(status.age)}</span>
                        </div>
                        <div>
                          <span className="font-medium">剩余时间:</span>
                          <span className={`ml-2 ${getStatusColor(status.expired)}`}>
                            {status.expired ? '已过期' : formatTime(status.remaining)}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">缓存键:</span>
                          <span className="ml-2 font-mono text-xs">{key}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => clearProvinceCache(provinceId)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        清理
                      </button>
                    </div>
                  </div>
                  
                  {/* Progress Bar for Cache Expiry */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>缓存进度</span>
                      <span>{status.expired ? '100%' : `${Math.round((status.age / (status.age + status.remaining)) * 100)}%`}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          status.expired ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ 
                          width: status.expired 
                            ? '100%' 
                            : `${Math.round((status.age / (status.age + status.remaining)) * 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cache Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-3">💡 缓存说明</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>• <strong>缓存时长:</strong> AI景区数据缓存4小时，减少API调用次数</p>
          <p>• <strong>自动过期:</strong> 超过4小时的缓存会自动失效，下次请求时重新获取</p>
          <p>• <strong>手动清理:</strong> 可以手动清理特定省份或所有缓存</p>
          <p>• <strong>数据一致性:</strong> 清理缓存后，下次AI请求会获取最新数据</p>
        </div>
      </div>

      {/* Cache Statistics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">缓存统计</h3>
        <div className="space-y-4">
          {cacheEntries.length > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">平均缓存时长:</span>
                <span className="font-medium">
                  {formatTime(Math.round(
                    cacheEntries.reduce((sum, [, status]) => sum + status.age, 0) / cacheEntries.length
                  ))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">最老缓存:</span>
                <span className="font-medium">
                  {formatTime(Math.max(...cacheEntries.map(([, status]) => status.age)))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">最新缓存:</span>
                <span className="font-medium">
                  {formatTime(Math.min(...cacheEntries.map(([, status]) => status.age)))}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CacheManager;
