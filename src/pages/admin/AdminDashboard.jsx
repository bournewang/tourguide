import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import ProvincesDashboard from './ProvincesDashboard';
import TasksMonitor from './TasksMonitor';
import CacheManager from './CacheManager';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('provinces');
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    // Initialize WebSocket connection
    const newSocket = io('http://localhost:3001');
    
    newSocket.on('connect', () => {
      setConnectionStatus('connected');
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      console.log('Disconnected from server');
    });

    newSocket.on('connect_error', (error) => {
      setConnectionStatus('error');
      console.error('Connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const tabs = [
    { id: 'provinces', label: '省份管理', icon: '🗺️' },
    { id: 'tasks', label: '任务监控', icon: '⚙️' },
    { id: 'cache', label: '缓存管理', icon: '💾' }
  ];

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'disconnected': return 'text-red-500';
      case 'error': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return '已连接';
      case 'disconnected': return '未连接';
      case 'error': return '连接错误';
      default: return '连接中...';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                🏛️ 景区数据管理系统
              </h1>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm ${getConnectionStatusColor()}`}>
                  {getConnectionStatusText()}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'provinces' && <ProvincesDashboard socket={socket} />}
        {activeTab === 'tasks' && <TasksMonitor socket={socket} />}
        {activeTab === 'cache' && <CacheManager />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-gray-500">
            景区数据管理系统 - 自动化收集和处理景区信息
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminDashboard;
