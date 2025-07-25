import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHowlerAudio } from './hooks/useHowlerAudio';
import { dataService } from './utils/dataService';

function SpotDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get spot data from location state or fallback
  const spot = location.state?.spot || null;
  
  const [videoError, setVideoError] = useState(false);
  const [mediaType, setMediaType] = useState('video'); // 'video', 'imageSequence', or 'audio'
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef(null);

  // If no spot data, redirect back to list
  useEffect(() => {
    if (!spot) {
      console.warn('No spot data found, redirecting to list');
      navigate('/', { replace: true });
    }
  }, [spot, navigate]);

  // Get media files directly from spot data
  const audioFile = spot ? dataService.resolveAudioUrl(spot.audioFile) : null;
  const videoFile = spot?.videoFile ? `/video/${spot.videoFile}` : null;
  const imageSequence = spot?.imageSequence || null;

  // Use Howler hook for audio and image sequence
  const {
    isPlaying,
    isLoading,
    currentTime,
    duration: realAudioDuration,
    playbackRate,
    currentImageIndex,
    error: audioError,
    play: playAudio,
    pause: pauseAudio,
    seekRelative,
    changePlaybackRate,
    formatTime
  } = useHowlerAudio(audioFile, imageSequence);

  // Determine which media to use
  const hasVideo = videoFile && !videoError;
  const hasImageSequence = imageSequence && imageSequence.length > 0;
  const hasAudio = audioFile && !audioError;

  const handleSeek = (seconds) => {
    if (mediaType === 'video' && videoRef.current) {
      const newTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
    } else if (mediaType === 'imageSequence' || mediaType === 'audio') {
      seekRelative(seconds);
    }
  };

  const handleSpeedChange = (rate) => {
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.playbackRate = rate;
    } else if (mediaType === 'imageSequence' || mediaType === 'audio') {
      changePlaybackRate(rate);
    }
  };

  const playVideo = () => {
    if (!hasVideo) {
      playImageSequence();
      return;
    }

    setVideoError(false);
    setMediaType('video');

    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
      
      video.addEventListener('loadeddata', () => {
        video.play().catch(error => {
          console.error('Error playing video:', error);
          setVideoError(true);
          playImageSequence();
        });
      });

      video.addEventListener('error', () => {
        setVideoError(true);
        playImageSequence();
      });

      video.load();
    }
  };

  const playImageSequence = () => {
    if (!hasImageSequence || !hasAudio) {
      playPreGeneratedAudio();
      return;
    }

    setMediaType('imageSequence');
    playAudio();
  };

  const playPreGeneratedAudio = () => {
    if (!hasAudio) {
      return;
    }

    setMediaType('audio');
    playAudio();
  };

  const toggleMedia = () => {
    if (isPlaying) {
      // Pause current playback
      if (videoRef.current && mediaType === 'video') {
        videoRef.current.pause();
      } else if (mediaType === 'audio' || mediaType === 'imageSequence') {
        pauseAudio();
      }
    } else {
      // Resume or start playback
      if (videoRef.current && mediaType === 'video') {
        videoRef.current.play().catch(() => {
          playVideo(); // Fallback to restart if resume fails
        });
      } else if (mediaType === 'audio' || mediaType === 'imageSequence') {
        playAudio();
      } else {
        // Start fresh playback - try video first, then image sequence, then audio
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
    if (!spot) return;
    
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

    return () => {
      clearTimeout(timer);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, [spot]);

  // Show loading if no spot data
  if (!spot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-4"> {/* Reduced bottom padding since nav is handled by Layout */}
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
              poster={spot.image}
              onError={() => {
                setVideoError(true);
              }}
              onClick={toggleMedia}
            >
              <source src={videoFile} type="video/mp4" />
              您的浏览器不支持视频播放。
            </video>
          ) : hasImageSequence && mediaType === 'imageSequence' ? (
            <div className="relative">
              <img
                src={(imageSequence[currentImageIndex]?.img || spot.image)}
                alt={imageSequence[currentImageIndex]?.notes || spot.name}
                className="w-full h-80 md:h-96 object-cover rounded-xl shadow-lg cursor-pointer transition-opacity duration-500"
                onError={(e) => {
                  e.target.src = spot.image || 'https://via.placeholder.com/800x400/f3f4f6/9ca3af?text=' + encodeURIComponent(spot.name);
                }}
                onClick={toggleMedia}
              />
              {/* Image sequence progress indicator */}
              <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs">
                {currentImageIndex + 1}/{imageSequence.length} - {imageSequence[currentImageIndex]?.notes}
              </div>
              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 rounded-b-xl">
                <div 
                  className="h-full bg-blue-500 transition-all duration-100 rounded-bl-xl"
                  style={{
                    width: `${((currentTime / realAudioDuration) * 100)}%`
                  }}
                ></div>
              </div>
            </div>
          ) : (
            <img
              src={spot.image || 'https://via.placeholder.com/800x400/f3f4f6/9ca3af?text=' + encodeURIComponent(spot.name)}
              alt={spot.name}
              className="w-full h-80 md:h-96 object-cover rounded-xl shadow-lg cursor-pointer"
              onClick={toggleMedia}
            />
          )}
          
          {/* Center Play/Pause Button Overlay */}
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
                   hasAudio && mediaType === 'audio' ? '🎵' : '🎵'}
                </span>
              </div>
              {/* Show audio error if present */}
              {audioError && (
                <div className="text-red-300 text-xs mt-1">
                  ⚠️ 音频加载失败
                </div>
              )}
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
      </div>
    </div>
  );
}

export default SpotDetail; 