import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import SpotList from './SpotList'
import SpotDetail from './SpotDetail'
import MapView from './MapView'
import MapView3D from './MapView3D'
import ScenicAreaSelector from './pages/ScenicAreaSelector'
import AccessGate from './components/AccessGate'
import Layout from './components/Layout'
import { TargetAreaProvider } from './contexts/TargetAreaContext'

// Conditionally import admin/debug components only in development
const isDevelopment = import.meta.env.DEV;

// Lazy load admin/debug components only in development
const BoundaryView = isDevelopment ? lazy(() => import('./BoundaryView')) : null;
const NarrationEditor = isDevelopment ? lazy(() => import('./NarrationEditor')) : null;
const DirectionDebug = isDevelopment ? lazy(() => import('./DirectionDebug')) : null;

// Import testing utilities only in development
if (isDevelopment) {
  import('./utils/sessionTest');
}

// Main App Layout Component
function AppLayout({ isAdmin }) {
  // Create admin routes only in development
  const getAdminRoutes = () => {
    if (!isDevelopment || !BoundaryView || !NarrationEditor || !DirectionDebug) {
      return [];
    }
    
    return [
      <Route key="boundaries" path="/boundaries" element={
        <Suspense fallback={<div className="p-8 text-center">Loading admin tools...</div>}>
          <Layout title="管理" showBack={true} showBottomNav={true} isAdmin={isAdmin}>
            <BoundaryView />
          </Layout>
        </Suspense>
      } />,
      <Route key="editor" path="/editor" element={
        <Suspense fallback={<div className="p-8 text-center">Loading admin tools...</div>}>
          {isAdmin ? (
            <Layout title="编辑模式" showBack={false} showBottomNav={false}>
              <NarrationEditor />
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )}
        </Suspense>
      } />,
      <Route key="debug" path="/debug" element={<Navigate to="/boundaries" replace />} />,
      <Route key="direction-debug" path="/direction-debug" element={
        <Suspense fallback={<div className="p-8 text-center">Loading admin tools...</div>}>
          <DirectionDebug />
        </Suspense>
      } />
    ];
  };

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

        <Route path="/map3d" element={
          <Layout title="3D地图" showBack={true} showBottomNav={true} isAdmin={isAdmin}>
            <MapView3D />
          </Layout>
        } />
        
        {/* Admin routes - only available in development */}
        {getAdminRoutes()}
        
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
