import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import SpotList from './SpotList'
import SpotDetail from './SpotDetail'
import BoundaryView from './BoundaryView'
import MapView from './MapView'
import NarrationEditor from './NarrationEditor'
import ScenicAreaSelector from './pages/ScenicAreaSelector'
import AccessGate from './components/AccessGate'
import Layout from './components/Layout'
import { TargetAreaProvider } from './contexts/TargetAreaContext'
import DirectionDebug from './DirectionDebug'
import './utils/sessionTest' // Import for testing utilities

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
        
        <Route path="/boundaries" element={
          <Layout title="管理" showBack={true} showBottomNav={true} isAdmin={isAdmin}>
            <BoundaryView />
          </Layout>
        } />
        
        {/* Admin routes */}
        <Route 
          path="/editor" 
          element={isAdmin ? (
            <Layout title="编辑模式" showBack={false} showBottomNav={false}>
              <NarrationEditor />
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )} 
        />
        
        {/* Debug route - redirects to boundaries */}
        <Route 
          path="/debug" 
          element={<Navigate to="/boundaries" replace />} 
        />
        
        {/* Direction debug page */}
        <Route path="/direction-debug" element={<DirectionDebug />} />
        
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
