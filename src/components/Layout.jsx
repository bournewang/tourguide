import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTargetArea } from '../hooks/useTargetArea';

const Layout = ({ children, title, showBack = false, showBottomNav = true, isAdmin = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDebugMode, currentTargetArea } = useTargetArea();

  const handleBack = () => {
    navigate('/');
  };

  const handleNavigate = (path) => {
    navigate(path);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Navigation Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center px-4 py-3 relative">
          {/* Left side - Back button */}
          {showBack && (
            <button
              onClick={handleBack}
              className="absolute left-4 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          {/* Center - Title */}
          <div className="flex-1 flex justify-center">
            <h1 className="text-lg font-semibold text-gray-800 text-center">
              {currentTargetArea?.name + ' ' + title}
            </h1>
          </div>

          {/* Right side - Additional actions can be added here */}
          <div className="flex items-center space-x-2">
            {/* Placeholder for future actions */}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 overflow-hidden ${showBottomNav ? 'pb-20' : ''}`}>
        {children}
      </div>

      {/* Bottom Navigation Bar */}
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="flex items-center justify-around px-2 py-3">
            {/* Home/List Button */}
            <button
              onClick={() => handleNavigate('/')}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                isActive('/') 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-xs">景点列表</span>
            </button>

            {/* Map Button */}
            <button
              onClick={() => handleNavigate('/map')}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                isActive('/map') 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
              </svg>
              <span className="text-xs">地图</span>
            </button>

            {/* Boundaries Button - Only show in debug mode */}
            {isDebugMode && (
              <button
                onClick={() => handleNavigate('/boundaries')}
                className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                  isActive('/boundaries') 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs">管理</span>
              </button>
            )}

            {/* Editor Mode Button - Only show in admin mode */}
            {isAdmin && (
              <button
                onClick={() => handleNavigate('/editor')}
                className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                  isActive('/editor') 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-xs">编辑模式</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout; 