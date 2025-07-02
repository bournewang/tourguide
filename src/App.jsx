import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import SpotList from './SpotList'
import SpotDetail from './SpotDetail'
import './index.css'

function App() {
  const [currentView, setCurrentView] = useState('list')
  const [selectedSpot, setSelectedSpot] = useState(null)

  const handleSpotClick = (spot) => {
    setSelectedSpot(spot)
    setCurrentView('detail')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedSpot(null)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {currentView === 'list' ? (
        <SpotList onSpotClick={handleSpotClick} />
      ) : (
        <SpotDetail spot={selectedSpot} onBack={handleBackToList} />
      )}
    </div>
  )
}

export default App
