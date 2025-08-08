import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const CityContext = createContext(null);

export const useCity = () => useContext(CityContext);

const CityLayout = ({ children }) => {
  const { cityId } = useParams();
  const [cityData, setCityData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCityData = async () => {
      try {
        setLoading(true);
        // Dynamically import the city's JSON configuration file
        const data = await import(`../../cities/${cityId}.json`);
        setCityData(data);
      } catch (error) {
        console.error('Failed to load city config data:', error);
        // Handle error, e.g., show a not found page or redirect
      } finally {
        setLoading(false);
      }
    };

    if (cityId) {
      fetchCityData();
    }
  }, [cityId]);

  if (loading) {
    return <div className="p-8 text-center">Loading city...</div>;
  }

  if (!cityData) {
    return <div className="p-8 text-center">City configuration not found.</div>;
  }

  return (
    <CityContext.Provider value={{ cityId, cityData }}>
      {children}
    </CityContext.Provider>
  );
};

export default CityLayout;
