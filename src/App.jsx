import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import AccessGate from './components/AccessGate';
import HomePage from './pages/HomePage';
import CityWrapper from './CityWrapper';
import AdminDashboard from './pages/admin/AdminDashboard';
import ZhengzhouMap from './pages/ZhengzhouMap';

// Import testing utilities only in development
if (import.meta.env.DEV) {
  import('./utils/sessionTest');
}

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  // Check for admin parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get('admin');
    console.log('adminParam', adminParam);
    setIsAdmin(adminParam === '1');
  }, []);

  return (
    <Router>
      <AccessGate>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/zhengzhou-map" element={<ZhengzhouMap />} />
          <Route path="/city/:cityId/*" element={<CityWrapper isAdmin={isAdmin} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AccessGate>
    </Router>
  );
}

export default App;
