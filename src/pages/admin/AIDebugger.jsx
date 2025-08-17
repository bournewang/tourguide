import React, { useState, useEffect } from 'react';

const AIDebugger = () => {
  const [recentLogs, setRecentLogs] = useState([]);
  const [provinceLogs, setProvinceLogs] = useState([]);
  const [validationSummary, setValidationSummary] = useState({});
  const [selectedProvince, setSelectedProvince] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const provinces = [
    { id: 'henan', name: '河南省' },
    { id: 'shandong', name: '山东省' },
    { id: 'jiangsu', name: '江苏省' },
    { id: 'zhejiang', name: '浙江省' },
    { id: 'guangdong', name: '广东省' }
  ];

  useEffect(() => {
    loadRecentLogs();
    loadValidationSummary();
  }, []);

  const loadRecentLogs = async () => {
    try {
      const response = await fetch('/api/admin/ai/logs/recent?limit=20');
      const data = await response.json();
      if (data.success) {
        setRecentLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to load recent logs:', error);
    }
  };

  const loadProvinceLogs = async (provinceName) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/ai/logs/province/${provinceName}`);
      const data = await response.json();
      if (data.success) {
        setProvinceLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to load province logs:', error);
      setError(`Failed to load logs for ${provinceName}`);
    } finally {
      setLoading(false);
    }
  };

  const loadValidationSummary = async () => {
    try {
      const response = await fetch('/api/admin/ai/validation-summary');
      const data = await response.json();
      if (data.success) {
        setValidationSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to load validation summary:', error);
    }
  };

  const forceRefreshProvince = async (provinceName) => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/admin/ai/provinces/${provinceName}/force-refresh`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        alert(`Successfully refreshed ${provinceName}`);
        loadValidationSummary();
        if (selectedProvince === provinceName) {
          loadProvinceLogs(provinceName);
        }
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Failed to refresh province:', error);
      setError(`Failed to refresh ${provinceName}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProvinceSelect = (provinceId) => {
    setSelectedProvince(provinceId);
    if (provinceId) {
      loadProvinceLogs(provinceId);
    } else {
      setProvinceLogs([]);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getValidationColor = (validation) => {
    if (!validation) return 'text-gray-500';
    return validation.isValid ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI 调试工具</h1>
        <p className="text-gray-600">查看 AI 响应日志和验证结果</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Validation Summary */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">验证摘要</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  省份
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  城市数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  景区数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  验证状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  缓存时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(validationSummary).map(([provinceName, summary]) => (
                <tr key={provinceName}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {provinceName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {summary.citiesCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {summary.scenicAreasCount}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${getValidationColor(summary.validation)}`}>
                    {summary.validation ? (
                      summary.validation.isValid ? '✅ 完整' : `⚠️ ${summary.validation.warnings.length} 个警告`
                    ) : '未验证'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {summary.cacheAge} 分钟前
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => forceRefreshProvince(provinceName)}
                      disabled={loading}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                    >
                      强制刷新
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Logs */}
        <div>
          <h2 className="text-xl font-semibold mb-4">最近的 AI 调用</h2>
          <div className="bg-white rounded-lg shadow max-h-96 overflow-y-auto">
            {recentLogs.length === 0 ? (
              <p className="p-4 text-gray-500">暂无日志</p>
            ) : (
              <div className="divide-y divide-gray-200">
                {recentLogs.map((log, index) => (
                  <div key={index} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-900">{log.provinceName}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.success ? '成功' : '失败'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {formatTimestamp(log.timestamp)}
                    </p>
                    {log.error && (
                      <p className="text-sm text-red-600">{log.error}</p>
                    )}
                    {log.parsedResult && (
                      <p className="text-sm text-gray-500">
                        找到 {Object.keys(log.parsedResult.cities || {}).length} 个城市，
                        {Object.values(log.parsedResult.cities || {}).flat().length} 个景区
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Province-specific Logs */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">省份详细日志</h2>
            <select
              value={selectedProvince}
              onChange={(e) => handleProvinceSelect(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">选择省份</option>
              {provinces.map(province => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-lg shadow max-h-96 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-gray-500">加载中...</p>
            ) : provinceLogs.length === 0 ? (
              <p className="p-4 text-gray-500">
                {selectedProvince ? '该省份暂无日志' : '请选择省份查看日志'}
              </p>
            ) : (
              <div className="divide-y divide-gray-200">
                {provinceLogs.map((log, index) => (
                  <div key={index} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.success ? '成功' : '失败'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    
                    {log.error && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-red-600 mb-1">错误:</p>
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          {log.error}
                        </p>
                      </div>
                    )}

                    {log.rawResponse && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          AI 响应 ({log.rawResponse.length} 字符):
                        </p>
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                          {log.rawResponse.substring(0, 500)}
                          {log.rawResponse.length > 500 && '...'}
                        </div>
                      </div>
                    )}

                    {log.parsedResult && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">解析结果:</p>
                        <p className="text-sm text-gray-600">
                          {Object.keys(log.parsedResult.cities || {}).length} 个城市，
                          {Object.values(log.parsedResult.cities || {}).flat().length} 个景区
                        </p>
                        <div className="text-xs text-gray-500 mt-1">
                          城市: {Object.keys(log.parsedResult.cities || {}).join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDebugger;
