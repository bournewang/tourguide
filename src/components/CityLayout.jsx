import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from './Layout';

const CityContext = createContext(null);

export const useCity = () => useContext(CityContext);

const CityLayout = ({ children, ...props }) => {
  const { cityId } = useParams();
  const [cityData, setCityData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCityData = async () => {
      try {
        setLoading(true);
        const data = await import(`../../cities/${cityId}.json`);
        console.log('City data loaded:', data);
        setCityData(data);
      } catch (error) {
        console.error('Failed to load city data:', error);
        // Handle error, e.g., show a not found page
      } finally {
        setLoading(false);
      }
    };

    if (cityId) {
      fetchCityData();
    }
  }, [cityId]);

  if (loading) {
    return <div className="p-8 text-center">Loading city data...</div>;
  }

  if (!cityData) {
    return <div className="p-8 text-center">City not found.</div>;
  }

  return (
    <CityContext.Provider value={{ cityId, cityData }}>
      <Layout {...props}>{children}</Layout>
    </CityContext.Provider>
  );
};

export default CityLayout;
