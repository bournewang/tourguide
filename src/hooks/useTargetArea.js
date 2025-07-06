import { useContext } from 'react';
import { TargetAreaContext } from '../contexts/TargetAreaContextDef';

export const useTargetArea = () => {
  const context = useContext(TargetAreaContext);
  if (!context) {
    throw new Error('useTargetArea must be used within a TargetAreaProvider');
  }
  return context;
}; 