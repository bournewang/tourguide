import { useState } from 'react';
import { ttsService } from '../utils/ttsService';

export const useTTSService = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const generateAudio = async (text, options = {}) => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await ttsService.generateAudio(text, options);
      return result;
    } catch (err) {
      console.error('TTS generation error:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateAudio,
    isGenerating,
    error
  };
}; 