import React, { useState, useEffect } from 'react';

const TasksMonitor = ({ socket }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  useEffect(() => {
    if (socket) {
      socket.on('taskAdded', (task) => {
        setTasks(prev => [task, ...prev]);
      });

      socket.on('taskUpdated', (task) => {
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        if (selectedTask && selectedTask.id === task.id) {
          setSelectedTask(task);
        }
      });

      socket.on('taskLog', ({ taskId, log }) => {
        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            return { ...t, logs: [...(t.logs || []), log] };
          }
          return t;
        }));
      });

      return () => {
        socket.off('taskAdded');
        socket.off('taskUpdated');
        socket.off('taskLog');
      };
    }
  }, [socket, selectedTask]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const statusParam = filter !== 'all' ? `?status=${filter}` : '';
      const response = await fetch(`http://localhost:3001/api/admin/tasks${statusParam}`);
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.tasks);
      } else {
        console.error('Failed to fetch tasks:', data.error);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const retryTask = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/admin/tasks/${taskId}/retry`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        alert('任务已重新排队');
        fetchTasks();
      } else {
        alert(`重试失败: ${data.error}`);
      }
    } catch (error) {
      alert(`重试失败: ${error.message}`);
    }
  };

  const clearCompletedTasks = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/admin/tasks/completed', {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchTasks();
      } else {
        alert(`清理失败: ${data.error}`);
      }
    } catch (error) {
      alert(`清理失败: ${error.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '⚙️';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  const getTaskTypeLabel = (type) => {
    switch (type) {
      case 'ORGANIZE_PROVINCE_DATA': return '整理省份数据';
      case 'SEARCH_CITY_SPOTS': return '搜索城市景点';
      case 'CREATE_CITY_STRUCTURE': return '创建城市结构';
      case 'SEARCH_NEARBY_SPOTS': return '搜索附近景点';
      case 'GENERATE_SUMMARY': return '生成摘要';
      case 'PROCESS_NARRATION': return '处理解说';
      default: return type;
    }
  };

  const formatDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end - start) / 1000);
    
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`;
    return `${Math.floor(duration / 3600)}时${Math.floor((duration % 3600) / 60)}分`;
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">加载任务数据...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">任务监控</h2>
        <div className="flex space-x-4">
          <button
            onClick={clearCompletedTasks}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            🗑️ 清理已完成和失败
          </button>
          <button
            onClick={fetchTasks}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        {['all', 'pending', 'running', 'completed', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {status === 'all' ? '全部' : 
             status === 'pending' ? '等待中' :
             status === 'running' ? '运行中' :
             status === 'completed' ? '已完成' :
             '失败'}
            <span className="ml-2">
              ({tasks.filter(t => status === 'all' || t.status === status).length})
            </span>
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredTasks.map((task) => (
            <li key={task.id}>
              <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">{getStatusIcon(task.status)}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getTaskTypeLabel(task.type)}
                      </p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span>ID: {task.id.slice(0, 8)}</span>
                      <span>创建: {new Date(task.createdAt).toLocaleString('zh-CN')}</span>
                      <span>耗时: {formatDuration(task.createdAt, task.updatedAt)}</span>
                    </div>

                    {task.status === 'running' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 mt-1">
                          {task.progress || 0}%
                        </span>
                      </div>
                    )}

                    {task.error && (
                      <div className="mt-2 text-sm text-red-600">
                        错误: {task.error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    详情
                  </button>
                  
                  {task.status === 'failed' && (
                    <button
                      onClick={() => retryTask(task.id)}
                      className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                    >
                      重试
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {filteredTasks.length === 0 && (
          <div className="text-center py-12">
            <span className="text-gray-500">没有找到任务</span>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  任务详情 - {getTaskTypeLabel(selectedTask.type)}
                </h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">任务ID:</span>
                    <span className="ml-2">{selectedTask.id}</span>
                  </div>
                  <div>
                    <span className="font-medium">状态:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getStatusColor(selectedTask.status)}`}>
                      {selectedTask.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">创建时间:</span>
                    <span className="ml-2">{new Date(selectedTask.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <div>
                    <span className="font-medium">更新时间:</span>
                    <span className="ml-2">{new Date(selectedTask.updatedAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>

                {/* Progress */}
                {selectedTask.status === 'running' && (
                  <div>
                    <span className="font-medium text-sm">进度:</span>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${selectedTask.progress || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{selectedTask.progress || 0}%</span>
                  </div>
                )}

                {/* Task Data */}
                <div>
                  <span className="font-medium text-sm">任务数据:</span>
                  <pre className="mt-1 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedTask.data, null, 2)}
                  </pre>
                </div>

                {/* Result */}
                {selectedTask.result && (
                  <div>
                    <span className="font-medium text-sm">执行结果:</span>
                    <pre className="mt-1 bg-green-50 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedTask.result, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {selectedTask.error && (
                  <div>
                    <span className="font-medium text-sm text-red-600">错误信息:</span>
                    <div className="mt-1 bg-red-50 p-3 rounded text-sm text-red-700">
                      {selectedTask.error}
                    </div>
                  </div>
                )}

                {/* Logs */}
                {selectedTask.logs && selectedTask.logs.length > 0 && (
                  <div>
                    <span className="font-medium text-sm">执行日志:</span>
                    <div className="mt-1 bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                      {selectedTask.logs.map((log, index) => (
                        <div key={index} className="text-xs mb-1">
                          <span className="text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                          </span>
                          <span className={`ml-2 px-1 rounded text-xs ${
                            log.level === 'error' ? 'bg-red-100 text-red-700' :
                            log.level === 'warn' ? 'bg-yellow-100 text-yellow-700' :
                            log.level === 'success' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {log.level}
                          </span>
                          <span className="ml-2">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksMonitor;
