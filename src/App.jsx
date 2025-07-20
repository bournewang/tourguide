import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import SpotList from './SpotList'
import SpotDetail from './SpotDetail'
import BoundaryView from './BoundaryView'
import MapView from './MapView'
import NarrationEditor from './NarrationEditor'
import AccessGate from './components/AccessGate'
import Layout from './components/Layout'
import { TargetAreaProvider } from './contexts/TargetAreaContext'

// Main App Layout Component
function AppLayout({ isAdmin }) {
  const location = useLocation()
  const navigate = useNavigate()

  const toggleView = () => {
    if (location.pathname === '/editor') {
      navigate('/')
    } else {
      navigate('/editor')
    }
  }

  return (
    <div className="app">
      {/* View Toggle Button - Only show for admin */}
      {isAdmin && (
        <button
          onClick={toggleView}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 shadow-lg"
        >
          {location.pathname === '/editor' ? '🎯 导览模式' : '📝 编辑模式'}
        </button>
      )}

      <Routes>
        {/* Main routes */}
        <Route path="/" element={
          <Layout title="景点导览" showBack={false} showBottomNav={true}>
            <SpotList />
          </Layout>
        } />
        
        <Route path="/spot/:spotId" element={
          <Layout title="景点详情" showBack={true} showBottomNav={true}>
            <SpotDetail />
          </Layout>
        } />
        
        <Route path="/map" element={
          <Layout title="景点地图" showBack={true} showBottomNav={true}>
            <MapView />
          </Layout>
        } />
        
        <Route path="/boundaries" element={
          <Layout title="管理" showBack={true} showBottomNav={true}>
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
