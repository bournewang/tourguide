import { useState, useEffect, useRef } from 'react';

function SpotDetail({ spot, onBack }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [mediaType, setMediaType] = useState('video'); // 'video', 'imageSequence', 'audio', or 'tts'
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageSequenceTime, setImageSequenceTime] = useState(0);
  const [realAudioDuration, setRealAudioDuration] = useState(0); // Store real audio duration
  const [currentTime, setCurrentTime] = useState(0); // Current playback time
  const [playbackRate, setPlaybackRate] = useState(1.0); // Playback speed
  const [showControls, setShowControls] = useState(false); // Show/hide advanced controls
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const imageSequenceTimerRef = useRef(null);
  const timeUpdateTimerRef = useRef(null);

  // Get media files directly from spot data
  const audioFile = spot.audioFile || null;
  const videoFile = spot.videoFile ? `/video/${spot.videoFile}` : null;
  const imageSequence = spot.imageSequence || null;

  // Determine which media to use
  const hasVideo = videoFile && !videoError;
  const hasImageSequence = imageSequence && imageSequence.length > 0;
  const hasAudio = audioFile && !audioError;

  const playImageSequence = () => {
    if (!hasImageSequence || !hasAudio) {
      console.log('No image sequence or audio found, falling back to audio only');
      playPreGeneratedAudio();
      return;
    }

    setIsLoading(true);
    setMediaType('imageSequence');
    setCurrentImageIndex(0);
    setImageSequenceTime(0);

    // Create new audio element for image sequence
    const audio = new Audio(audioFile);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      // Capture real audio duration
      setRealAudioDuration(audio.duration);
    });

    audio.addEventListener('loadeddata', () => {
      setIsLoading(false);
      setIsPlaying(true);
      
      // Apply current playback rate
      audio.playbackRate = playbackRate;
      
      // Start image sequence timer and time update timer
      startImageSequenceTimer();
      startTimeUpdateTimer();
      
      audio.play().catch(error => {
        console.error('Error playing audio with image sequence:', error);
        setIsLoading(false);
        setIsPlaying(false);
        // Fallback to text-to-speech
        playTextToSpeech();
      });
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setIsLoading(false);
      stopImageSequenceTimer();
      stopTimeUpdateTimer();
      setCurrentTime(0);
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio file error:', e);
      setIsLoading(false);
      setIsPlaying(false);
      stopImageSequenceTimer();
      // Fallback to text-to-speech
      playTextToSpeech();
    });

    // Start loading the audio
    audio.load();
  };

  const startImageSequenceTimer = () => {
    imageSequenceTimerRef.current = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        const currentAudioTime = audioRef.current.currentTime;
        setImageSequenceTime(currentAudioTime);
        
        // Find current image based on audio time
        const currentImage = imageSequence.find(img => 
          currentAudioTime >= img.startTime && currentAudioTime < (img.startTime + img.duration)
        );
        
        if (currentImage) {
          const newIndex = imageSequence.indexOf(currentImage);
          setCurrentImageIndex(newIndex);
        }
      }
    }, 100);
  };

  const stopImageSequenceTimer = () => {
    if (imageSequenceTimerRef.current) {
      clearInterval(imageSequenceTimerRef.current);
      imageSequenceTimerRef.current = null;
    }
  };

  const startTimeUpdateTimer = () => {
    timeUpdateTimerRef.current = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
      } else if (videoRef.current && !videoRef.current.paused) {
        setCurrentTime(videoRef.current.currentTime);
      }
    }, 1000);
  };

  const stopTimeUpdateTimer = () => {
    if (timeUpdateTimerRef.current) {
      clearInterval(timeUpdateTimerRef.current);
      timeUpdateTimerRef.current = null;
    }
  };

  const handleSeek = (seconds) => {
    const currentMedia = audioRef.current || videoRef.current;
    if (currentMedia) {
      const newTime = Math.max(0, Math.min(currentMedia.duration, currentMedia.currentTime + seconds));
      currentMedia.currentTime = newTime;
      setCurrentTime(newTime);
      
      // Update image sequence to match new audio time
      if (mediaType === 'imageSequence' && hasImageSequence) {
        setImageSequenceTime(newTime);
        
        // Find the correct image for the new time
        const currentImage = imageSequence.find(img => 
          newTime >= img.startTime && newTime < (img.startTime + img.duration)
        );
        
        if (currentImage) {
          const newIndex = imageSequence.indexOf(currentImage);
          setCurrentImageIndex(newIndex);
        }
      }
    }
  };

  const handleSpeedChange = (rate) => {
    setPlaybackRate(rate);
    const currentMedia = audioRef.current || videoRef.current;
    if (currentMedia) {
      currentMedia.playbackRate = rate;
    }
    
    // For TTS, we need to restart with new rate
    if (mediaType === 'tts' && isPlaying) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spot.audio_script);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.8 * rate; // Base rate 0.8 * speed multiplier
      
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playVideo = () => {
    if (!videoFile) {
      console.log('No video file found, falling back to image sequence');
      playImageSequence();
      return;
    }

    setIsLoading(true);
    setVideoError(false);
    setMediaType('video');

    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadstart', () => {
        setIsLoading(true);
      });

      video.addEventListener('loadeddata', () => {
        setIsLoading(false);
        setIsPlaying(true);
        
        // Apply current playback rate
        video.playbackRate = playbackRate;
        
        // Start time update timer
        startTimeUpdateTimer();
        
        video.play().catch(error => {
          console.error('Error playing video:', error);
          setVideoError(true);
          setIsLoading(false);
          setIsPlaying(false);
          // Fallback to image sequence
          playImageSequence();
        });
      });

      video.addEventListener('ended', () => {
        setIsPlaying(false);
        setIsLoading(false);
        stopTimeUpdateTimer();
        setCurrentTime(0);
      });

      video.addEventListener('error', (e) => {
        console.error('Video file error:', e);
        setVideoError(true);
        setIsLoading(false);
        setIsPlaying(false);
        // Fallback to image sequence
        playImageSequence();
      });

      // Start loading the video
      video.load();
    }
  };

  const playPreGeneratedAudio = () => {
    if (!audioFile) {
      console.log('No audio file found, falling back to text-to-speech');
      playTextToSpeech();
      return;
    }

    setIsLoading(true);
    setAudioError(false);
    setMediaType('audio');

    // Create new audio element
    const audio = new Audio(audioFile);
    audioRef.current = audio;

    audio.addEventListener('loadstart', () => {
      setIsLoading(true);
    });

    audio.addEventListener('loadedmetadata', () => {
      // Capture real audio duration
      setRealAudioDuration(audio.duration);
    });

    audio.addEventListener('loadeddata', () => {
      setIsLoading(false);
      setIsPlaying(true);
      
      // Apply current playback rate
      audio.playbackRate = playbackRate;
      
      // Start time update timer
      startTimeUpdateTimer();
      
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        setAudioError(true);
        setIsLoading(false);
        setIsPlaying(false);
        // Fallback to text-to-speech
        playTextToSpeech();
      });
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setIsLoading(false);
      stopTimeUpdateTimer();
      setCurrentTime(0);
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio file error:', e);
      setAudioError(true);
      setIsLoading(false);
      setIsPlaying(false);
      // Fallback to text-to-speech
      playTextToSpeech();
    });

    // Start loading the audio
    audio.load();
  };

  const playTextToSpeech = () => {
    if ('speechSynthesis' in window) {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      setMediaType('tts');
      
      const utterance = new SpeechSynthesisUtterance(spot.audio_script);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.8;
      
      utterance.onstart = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
      window.speechSynthesis.speak(utterance);
    } else {
      alert('您的浏览器不支持语音播放功能');
    }
  };

  const toggleMedia = () => {
    if (isPlaying) {
      // Pause current playback (keep current position)
      if (videoRef.current && mediaType === 'video') {
        videoRef.current.pause();
        setIsPlaying(false);
      } else if (audioRef.current && (mediaType === 'audio' || mediaType === 'imageSequence')) {
        audioRef.current.pause();
        setIsPlaying(false);
        if (mediaType === 'imageSequence') {
          stopImageSequenceTimer();
        }
        stopTimeUpdateTimer();
      } else if (mediaType === 'tts') {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      }
    } else {
      // Resume or start playback
      if (videoRef.current && mediaType === 'video') {
        // Resume video from current position
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          startTimeUpdateTimer();
        }).catch(error => {
          console.error('Error resuming video:', error);
          playVideo(); // Fallback to restart if resume fails
        });
      } else if (audioRef.current && (mediaType === 'audio' || mediaType === 'imageSequence')) {
        // Check if audio has ended, if so restart from beginning
        if (audioRef.current.ended) {
          // Audio has ended, restart from beginning
          if (mediaType === 'imageSequence') {
            playImageSequence(); // This will reset image sequence to beginning
          } else {
            playPreGeneratedAudio(); // This will restart audio from beginning
          }
        } else {
          // Resume audio from current position
          audioRef.current.play().then(() => {
            setIsPlaying(true);
            if (mediaType === 'imageSequence') {
              startImageSequenceTimer();
            }
            startTimeUpdateTimer();
          }).catch(error => {
            console.error('Error resuming audio:', error);
            if (mediaType === 'imageSequence') {
              playImageSequence(); // Fallback to restart if resume fails
            } else {
              playPreGeneratedAudio();
            }
          });
        }
      } else {
        // Start fresh playback - try video first, then image sequence, then audio, then TTS
        if (hasVideo) {
          playVideo();
        } else if (hasImageSequence) {
          playImageSequence();
        } else {
          playPreGeneratedAudio();
        }
      }
    }
  };

  // Auto-play media when component mounts
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    const timer = setTimeout(() => {
      if (hasVideo) {
        playVideo();
      } else if (hasImageSequence) {
        playImageSequence();
      } else {
        playPreGeneratedAudio();
      }
    }, 800);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stopImageSequenceTimer();
      stopTimeUpdateTimer();
    };
  }, [spot]);



  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">
          🏯 {spot.name}
        </h1>

        {/* Video Player, Image Sequence, or Large Image with Overlay Controls */}
        <div className="mb-4 relative group">
          {hasVideo ? (
            <video
              ref={videoRef}
              className="w-full h-80 md:h-96 object-cover rounded-xl shadow-lg bg-black"
              poster={spot.image_full || spot.image_thumb}
              onError={() => {
                console.error('Video failed to load');
                setVideoError(true);
                setIsLoading(false);
                setIsPlaying(false);
              }}
              onClick={toggleMedia}
            >
              <source src={videoFile} type="video/mp4" />
              您的浏览器不支持视频播放。
            </video>
          ) : hasImageSequence && mediaType === 'imageSequence' ? (
            <div className="relative">
              <img
                src={imageSequence[currentImageIndex]?.image || spot.image_full || spot.image_thumb}
                alt={imageSequence[currentImageIndex]?.description || spot.name}
                className="w-full h-80 md:h-96 object-cover rounded-xl shadow-lg cursor-pointer transition-opacity duration-500"
                onError={(e) => {
                  e.target.src = spot.image_thumb || 'https://via.placeholder.com/800x400/f3f4f6/9ca3af?text=' + encodeURIComponent(spot.name);
                }}
                onClick={toggleMedia}
              />
              {/* Image sequence progress indicator */}
              <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs">
                {currentImageIndex + 1}/{imageSequence.length} - {imageSequence[currentImageIndex]?.description}
              </div>
              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 rounded-b-xl">
                <div 
                  className="h-full bg-blue-500 transition-all duration-100 rounded-bl-xl"
                  style={{
                    width: `${((imageSequenceTime / realAudioDuration) * 100)}%`
                  }}
                ></div>
              </div>
            </div>
          ) : (
            <img
              src={spot.image_full || spot.image_thumb}
              alt={spot.name}
              className="w-full h-80 md:h-96 object-cover rounded-xl shadow-lg cursor-pointer"
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/800x400/f3f4f6/9ca3af?text=' + encodeURIComponent(spot.name);
              }}
              onClick={toggleMedia}
            />
          )}
          
          {/* Center Play/Pause Button Overlay - Only show when paused or on hover during playback */}
          <div 
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
              !isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-80'
            } ${isPlaying ? 'pointer-events-none group-hover:pointer-events-auto' : ''}`}
          >
            <button
              onClick={toggleMedia}
              disabled={isLoading}
              className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 transform hover:scale-110 ${
                isLoading
                  ? 'bg-gray-800/80 text-white cursor-not-allowed'
                  : isPlaying 
                    ? 'bg-black/60 hover:bg-black/80 text-white' 
                    : hasVideo 
                      ? 'bg-blue-600/90 hover:bg-blue-700/90 text-white'
                      : 'bg-green-600/90 hover:bg-green-700/90 text-white'
              }`}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              ) : isPlaying ? (
                <svg className="w-8 h-8 md:w-10 md:h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8 md:w-10 md:h-10 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
          </div>

          {/* Duration and Status Info - Bottom Right Corner */}
          {!(hasImageSequence && mediaType === 'imageSequence') && (
            <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded-md text-sm">
              <div className="flex items-center gap-2">
                <span>⏱️ {realAudioDuration > 0 ? `${Math.floor(realAudioDuration / 60)}分${Math.floor(realAudioDuration % 60)}秒` : (spot.suggested_duration || '暂无时长信息')}</span>
                <span className="text-xs opacity-80">
                  {hasVideo && mediaType === 'video' ? '🎬' : 
                   hasImageSequence && mediaType === 'imageSequence' ? '🖼️' :
                   hasAudio && mediaType === 'audio' ? '🎵' : 
                   mediaType === 'tts' ? '🔊' : '🎵'}
                </span>
              </div>
            </div>
          )}

          {/* Audio Controls Toggle Button - Bottom Left Corner */}
          {isPlaying && (mediaType === 'audio' || mediaType === 'imageSequence' || mediaType === 'video') && (
            <button
              onClick={() => setShowControls(!showControls)}
              className="absolute bottom-3 left-3 bg-black/70 hover:bg-black/90 text-white px-3 py-1 rounded-md text-sm transition-colors"
            >
              🎛️ {showControls ? '隐藏' : '控制'}
            </button>
          )}
        </div>

        {/* Advanced Audio Controls Panel */}
        {showControls && isPlaying && (mediaType === 'audio' || mediaType === 'imageSequence' || mediaType === 'video') && (
          <div className="mb-4 bg-white rounded-xl p-4 shadow-md">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">🎛️ 音频控制</h3>
            
            {/* Time Display and Progress */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  {formatTime(currentTime)} / {formatTime(realAudioDuration)}
                </span>
                <span className="text-sm text-gray-600">
                  {playbackRate}x 速度
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${realAudioDuration > 0 ? (currentTime / realAudioDuration) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>

            {/* Seek Controls */}
            <div className="mb-4">
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => handleSeek(-30)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  ⏪ -30秒
                </button>
                <button
                  onClick={() => handleSeek(-10)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  ⏮️ -10秒
                </button>
                <button
                  onClick={() => handleSeek(10)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  ⏭️ +10秒
                </button>
                <button
                  onClick={() => handleSeek(30)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  ⏩ +30秒
                </button>
              </div>
            </div>

            {/* Speed Controls */}
            <div>
              <p className="text-sm text-gray-600 mb-2">播放速度：</p>
              <div className="flex justify-center items-center gap-2 flex-wrap">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map(speed => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      playbackRate === speed
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="bg-white rounded-xl p-4 shadow-md mb-4">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">
            📖 景点详细介绍
          </h2>
          <p className="text-base text-gray-700 leading-relaxed">
            {spot.description || '暂无详细介绍'}
          </p>
        </div>

        {/* Instructions */}
        {/* <div className="mb-4 text-center bg-blue-50 rounded-xl p-3">
          <p className="text-sm text-gray-600">
            💡 提示：您可以随时点击"{hasVideo ? '播放视频讲解' : '播放讲解'}"按钮重新{hasVideo ? '观看' : '收听'}介绍
          </p>
        </div> */}
      </div>

      {/* Fixed Back Button at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-sm shadow-lg">
        <button
          onClick={onBack}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl text-lg font-semibold shadow-md transition-colors duration-200"
        >
          ← 返回景点列表
        </button>
      </div>
    </div>
  );
}

export default SpotDetail; 