import React from 'react';
import { useParams } from 'react-router-dom';
import { TargetAreaProvider } from './contexts/TargetAreaContext';
import CityAppLayout from './CityAppLayout'; // Assuming CityAppLayout is extracted or imported

const CityWrapper = ({ isAdmin }) => {
  const { cityId } = useParams();

  return (
    <TargetAreaProvider cityId={cityId}>
      <CityAppLayout isAdmin={isAdmin} />
    </TargetAreaProvider>
  );
};

export default CityWrapper;
