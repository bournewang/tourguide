
import React, { createContext, useState, useContext } from 'react';

const SpotContext = createContext();

export const useSpots = () => {
  return useContext(SpotContext);
};

export const SpotProvider = ({ children }) => {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);

  const value = {
    spots,
    setSpots,
    loading,
    setLoading,
  };

  return (
    <SpotContext.Provider value={value}>
      {children}
    </SpotContext.Provider>
  );
};
