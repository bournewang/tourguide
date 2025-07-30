import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import SpotList from './SpotList'
import SpotDetail from './SpotDetail'
import MapView from './MapView'
import ScenicAreaSelector from './pages/ScenicAreaSelector'
import AccessGate from './components/AccessGate'
import Layout from './components/Layout'
import { TargetAreaProvider } from './contexts/TargetAreaContext'

// Conditionally import admin/debug components only in development
const isDevelopment = import.meta.env.DEV;

// Import testing utilities only in development
if (isDevelopment) {
  import('./utils/sessionTest');
}

// Main App Layout Component
function AppLayout({ isAdmin }) {
  return (
    <div className="app">
      <Routes>
        {/* Main routes */}
        <Route path="/" element={
          <Layout title="景点导览" showBack={false} showBottomNav={true} isAdmin={isAdmin}>
            <SpotList />
          </Layout>
        } />
        
        <Route path="/spot/:spotId" element={
          <Layout title="景点详情" showBack={true} showBottomNav={true} isAdmin={isAdmin}>
            <SpotDetail />
          </Layout>
        } />
        
        <Route path="/select-area" element={
          <Layout title="选择景区" showBack={true} showBottomNav={true} isAdmin={isAdmin}>
            <ScenicAreaSelector />
          </Layout>
        } />
        
        <Route path="/map" element={
          <Layout title="景点地图" showBack={true} showBottomNav={true} isAdmin={isAdmin}>
            <MapView />
          </Layout>
        } />
        
        {/* Admin routes - only available in development */}
        {isDevelopment && (
          <>
            <Route path="/boundaries" element={
              <Layout title="管理" showBack={true} showBottomNav={true} isAdmin={isAdmin}>
                <div className="p-8 text-center">
                  <h2 className="text-xl font-bold mb-4">BoundaryView - Development Only</h2>
                  <p className="text-gray-600">This page is only available in development mode.</p>
                </div>
              </Layout>
            } />
            
            <Route path="/editor" element={
              isAdmin ? (
                <Layout title="编辑模式" showBack={false} showBottomNav={false}>
                  <div className="p-8 text-center">
                    <h2 className="text-xl font-bold mb-4">NarrationEditor - Development Only</h2>
                    <p className="text-gray-600">This page is only available in development mode.</p>
                  </div>
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            } />
            
            <Route path="/debug" element={<Navigate to="/boundaries" replace />} />
            
            <Route path="/direction-debug" element={
              <div className="p-8 text-center">
                <h2 className="text-xl font-bold mb-4">DirectionDebug - Development Only</h2>
                <p className="text-gray-600">This page is only available in development mode.</p>
              </div>
            } />
          </>
        )}
        
        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

function App() {
  const [isAdmin, setIsAdmin] = useState(false)

    // Check for admin parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const adminParam = urlParams.get('admin')
    console.log('adminParam', adminParam)
    setIsAdmin(adminParam === '1')
  }, [])

  return (
    <Router>
      <AccessGate>
        <TargetAreaProvider>
          <AppLayout isAdmin={isAdmin} />
        </TargetAreaProvider>
      </AccessGate>
    </Router>
  )
}

export default App
