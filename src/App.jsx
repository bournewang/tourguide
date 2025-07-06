import { useState, useRef, useEffect } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import SpotList from './SpotList'
import SpotDetail from './SpotDetail'
import BoundaryView from './BoundaryView'
import { TargetAreaProvider } from './contexts/TargetAreaContext'
import './index.css'

function App() {
  const [currentView, setCurrentView] = useState('list')
  const [selectedSpot, setSelectedSpot] = useState(null)
  const [isDebugMode, setIsDebugMode] = useState(false)
  const scrollPositionRef = useRef(0) // Store scroll position

  // Check for debug mode on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug');
    setIsDebugMode(debugMode);
    console.log('Debug mode:', debugMode);
  }, []);

  const handleSpotClick = (spot) => {
    // Save current scroll position before navigating to detail
    scrollPositionRef.current = window.scrollY
    setSelectedSpot(spot)
    setCurrentView('detail')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedSpot(null)
    // Restore scroll position after a brief delay to ensure component is mounted
    setTimeout(() => {
      window.scrollTo(0, scrollPositionRef.current)
    }, 100)
  }

  const handleShowMap = () => {
    setCurrentView('map')
  }

  const handleShowMapFixed = () => {
    setCurrentView('mapFixed')
  }

  const handleShowMyLocation = () => {
    setCurrentView('myLocation')
  }

  const handleShowBoundaries = () => {
    if (isDebugMode) {
      setCurrentView('boundaries')
    } else {
      console.log('BoundaryView is only available in debug mode (add ?query=debug to URL)');
    }
  }

  return (
    <TargetAreaProvider>
      <div className="min-h-screen bg-gray-100">
        {currentView === 'list' ? (
          <SpotList 
            onSpotClick={handleSpotClick} 
            onShowMap={handleShowMap} 
            onShowMapFixed={handleShowMapFixed} 
            onShowMyLocation={handleShowMyLocation} 
            onShowBoundaries={handleShowBoundaries}
            isDebugMode={isDebugMode}
          />
        ) : currentView === 'detail' ? (
          <SpotDetail spot={selectedSpot} onBack={handleBackToList} />
        ) : currentView === 'boundaries' && isDebugMode ? (
          <BoundaryView onBack={handleBackToList} />
        ) : null}
      </div>
    </TargetAreaProvider>
  )
}

export default App
