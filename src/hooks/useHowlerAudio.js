import { useState, useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';

export const useHowlerAudio = (audioFile, imageSequence = null) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [error, setError] = useState(null);
  
  const soundRef = useRef(null);
  const timeUpdateTimerRef = useRef(null);
  const nextImageTimeRef = useRef(0);

  // Initialize Howl instance
  const initializeSound = useCallback(() => {
    if (!audioFile) {
      console.log('No audio file provided');
      return null;
    }

    console.log('Initializing audio with file:', audioFile);

    // Clean up existing sound
    if (soundRef.current) {
      soundRef.current.unload();
    }

    const sound = new Howl({
      src: [audioFile],
      html5: true,
      preload: true,
      onload: () => {
        console.log('Audio loaded successfully:', audioFile);
        setDuration(sound.duration());
        setIsLoading(false);
        setError(null);
      },
      onloaderror: (id, error) => {
        console.error('Audio load error for file:', audioFile, error);
        setError('音频加载失败 - 可能文件不存在或格式不支持');
        setIsLoading(false);
      },
      onplay: () => {
        console.log('Audio playback started');
        setIsPlaying(true);
        setIsLoading(false);
        startTimeUpdateTimer();
      },
      onpause: () => {
        console.log('Audio playback paused');
        setIsPlaying(false);
        stopTimeUpdateTimer();
      },
      onstop: () => {
        console.log('Audio playback stopped');
        setIsPlaying(false);
        setCurrentTime(0);
        setCurrentImageIndex(0);
        nextImageTimeRef.current = 0;
        stopTimeUpdateTimer();
      },
      onend: () => {
        console.log('Audio playback ended');
        setIsPlaying(false);
        setCurrentTime(0);
        setCurrentImageIndex(0);
        nextImageTimeRef.current = 0;
        stopTimeUpdateTimer();
      },
      onplayerror: (id, error) => {
        console.error('Audio play error:', error);
        setError('音频播放失败');
        setIsPlaying(false);
        setIsLoading(false);
      }
    });

    soundRef.current = sound;
    return sound;
  }, [audioFile]);

  // Optimized time update timer that handles both time display and image switching
  const startTimeUpdateTimer = useCallback(() => {
    if (timeUpdateTimerRef.current) {
      clearInterval(timeUpdateTimerRef.current);
    }
    
    timeUpdateTimerRef.current = setInterval(() => {
      if (soundRef.current && soundRef.current.playing()) {
        const time = soundRef.current.seek();
        setCurrentTime(time);
        
        // Handle image sequence switching efficiently
        if (imageSequence && imageSequence.length > 0) {
          if (time >= nextImageTimeRef.current) {
            const currentImage = imageSequence.find(img => 
              time >= img.start && time < (img.start + img.duration)
            );
            
            if (currentImage) {
              const newIndex = imageSequence.indexOf(currentImage);
              setCurrentImageIndex(newIndex);
              
              // Set next check time to the next image start time
              const nextImage = imageSequence[newIndex + 1];
              nextImageTimeRef.current = nextImage ? nextImage.start : Infinity;
            }
          }
        }
      }
    }, 50);
  }, [imageSequence]);

  // Stop time update timer
  const stopTimeUpdateTimer = useCallback(() => {
    if (timeUpdateTimerRef.current) {
      clearInterval(timeUpdateTimerRef.current);
      timeUpdateTimerRef.current = null;
    }
  }, []);

  // Play audio
  const play = useCallback(() => {
    if (!soundRef.current) {
      const sound = initializeSound();
      if (!sound) return;
    }

    setIsLoading(true);
    setError(null);
    
    // Apply current playback rate
    soundRef.current.rate(playbackRate);
    
    // Reset image sequence state
    if (imageSequence && imageSequence.length > 0) {
      setCurrentImageIndex(0);
      nextImageTimeRef.current = imageSequence[0] ? imageSequence[0].start : 0;
    }
    
    soundRef.current.play();
  }, [initializeSound, playbackRate, imageSequence]);

  // Pause audio
  const pause = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.pause();
    }
  }, []);

  // Change playback rate
  const changePlaybackRate = useCallback((rate) => {
    setPlaybackRate(rate);
    if (soundRef.current) {
      soundRef.current.rate(rate);
    }
  }, []);

  // Seek relative to current time
  const seekRelative = useCallback((seconds) => {
    if (soundRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      soundRef.current.seek(newTime);
      setCurrentTime(newTime);
      
      // Update image sequence to match new time
      if (imageSequence && imageSequence.length > 0) {
        const currentImage = imageSequence.find(img => 
          newTime >= img.start && newTime < (img.start + img.duration)
        );
        
        if (currentImage) {
          const newIndex = imageSequence.indexOf(currentImage);
          setCurrentImageIndex(newIndex);
          
          // Update next image time
          const nextImage = imageSequence[newIndex + 1];
          nextImageTimeRef.current = nextImage ? nextImage.start : Infinity;
        }
      }
    }
  }, [currentTime, duration, imageSequence]);

  // Seek to absolute time
  const seekToTime = useCallback((time) => {
    if (soundRef.current) {
      const clampedTime = Math.max(0, Math.min(duration, time));
      soundRef.current.seek(clampedTime);
      setCurrentTime(clampedTime);
      
      // Update image sequence to match new time
      if (imageSequence && imageSequence.length > 0) {
        const currentImage = imageSequence.find(img => 
          clampedTime >= img.start && clampedTime < (img.start + img.duration)
        );
        
        if (currentImage) {
          const newIndex = imageSequence.indexOf(currentImage);
          setCurrentImageIndex(newIndex);
          
          // Update next image time
          const nextImage = imageSequence[newIndex + 1];
          nextImageTimeRef.current = nextImage ? nextImage.start : Infinity;
        }
      }
    }
  }, [duration, imageSequence]);

  // Initialize sound when audioFile changes
  useEffect(() => {
    if (audioFile) {
      setIsLoading(true);
      initializeSound();
    }
  }, [audioFile, initializeSound]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimeUpdateTimer();
      if (soundRef.current) {
        soundRef.current.unload();
      }
    };
  }, [stopTimeUpdateTimer]);

  return {
    // State
    isPlaying,
    isLoading,
    currentTime,
    duration,
    playbackRate,
    currentImageIndex,
    error,
    
    // Controls
    play,
    pause,
    seekRelative,
    seekToTime,
    changePlaybackRate,
    
    // Utilities
    formatTime: (seconds) => {
      if (!seconds || isNaN(seconds)) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };
}; 