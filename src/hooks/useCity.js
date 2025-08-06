import { useContext } from 'react';
import { CityContext } from '../contexts/CityContextDef';

export const useCity = () => {
  return useContext(CityContext);
}; 