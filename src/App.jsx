import { useState, useEffect } from 'react'
import './App.css'
import SpotList from './SpotList'
import SpotDetail from './SpotDetail'
import BoundaryView from './BoundaryView'
import MapView from './MapView'
import NarrationEditor from './NarrationEditor'
import AccessGate from './components/AccessGate'
import { TargetAreaProvider } from './contexts/TargetAreaContext'

function App() {
  const [selectedSpot, setSelectedSpot] = useState(null)
  const [currentView, setCurrentView] = useState('tour') // 'tour' or 'editor'
  const [showMap, setShowMap] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isDebug, setIsDebug] = useState(false)

  // Check for admin and debug parameters in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const adminParam = urlParams.get('admin')
    const debugParam = urlParams.get('debug')
    setIsAdmin(adminParam === '1')
    setIsDebug(debugParam === '1')
  }, [])

  const handleSpotSelect = (spot) => {
    setSelectedSpot(spot)
  }

  const handleBack = () => {
    setSelectedSpot(null)
    setShowMap(false)
  }

  const handleShowMap = () => {
    setShowMap(true)
    setSelectedSpot(null)
  }

  const handleMapBack = () => {
    setShowMap(false)
  }

  const handleSpotClickFromMap = (spot) => {
    setSelectedSpot(spot)
    setShowMap(false)
  }

  const toggleView = () => {
    setCurrentView(currentView === 'tour' ? 'editor' : 'tour')
  }

  return (
    <AccessGate>
      <TargetAreaProvider>
        <div className="app">
          {/* View Toggle Button - Only show for admin */}
          {isAdmin && (
            <button
              onClick={toggleView}
              className="fixed top-4 right-4 z-50 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 shadow-lg"
            >
              {currentView === 'tour' ? '📝 编辑模式' : '🎯 导览模式'}
            </button>
          )}

          {isDebug ? (
            <BoundaryView onBack={handleBack} />
          ) : isAdmin && currentView === 'editor' ? (
            <NarrationEditor />
          ) : showMap ? (
            <MapView onBack={handleMapBack} onSpotClick={handleSpotClickFromMap} />
          ) : (
            <>
              {selectedSpot ? (
                <SpotDetail spot={selectedSpot} onBack={handleBack} />
              ) : (
                <SpotList 
                  onSpotClick={handleSpotSelect} 
                  onShowBoundaries={() => setIsDebug(true)}
                  onShowMap={handleShowMap}
                  isDebugMode={isDebug}
                />
              )}
            </>
          )}
        </div>
      </TargetAreaProvider>
    </AccessGate>
  )
}

export default App
