import { useState, useEffect, useRef } from 'react';

function SpotDetail({ spot, onBack }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [mediaType, setMediaType] = useState('video'); // 'video', 'audio', or 'tts'
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  // Get media files directly from spot data
  const audioFile = spot.audioFile ? `/audio/${spot.audioFile}` : null;
  const videoFile = spot.videoFile ? `/video/${spot.videoFile}` : null;

  // Determine which media to use
  const hasVideo = videoFile && !videoError;
  const hasAudio = audioFile && !audioError;

  const playVideo = () => {
    if (!videoFile) {
      console.log('No video file found, falling back to audio');
      playPreGeneratedAudio();
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
        video.play().catch(error => {
          console.error('Error playing video:', error);
          setVideoError(true);
          setIsLoading(false);
          setIsPlaying(false);
          // Fallback to audio
          playPreGeneratedAudio();
        });
      });

      video.addEventListener('ended', () => {
        setIsPlaying(false);
        setIsLoading(false);
      });

      video.addEventListener('error', (e) => {
        console.error('Video file error:', e);
        setVideoError(true);
        setIsLoading(false);
        setIsPlaying(false);
        // Fallback to audio
        playPreGeneratedAudio();
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

    audio.addEventListener('loadeddata', () => {
      setIsLoading(false);
      setIsPlaying(true);
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
      } else if (audioRef.current && mediaType === 'audio') {
        audioRef.current.pause();
        setIsPlaying(false);
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
        }).catch(error => {
          console.error('Error resuming video:', error);
          playVideo(); // Fallback to restart if resume fails
        });
      } else if (audioRef.current && mediaType === 'audio') {
        // Resume audio from current position
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(error => {
          console.error('Error resuming audio:', error);
          playPreGeneratedAudio(); // Fallback to restart if resume fails
        });
      } else {
        // Start fresh playback - try video first, then audio, then TTS
        if (hasVideo) {
          playVideo();
        } else {
          playPreGeneratedAudio();
        }
      }
    }
  };

  // Auto-play media when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasVideo) {
        playVideo();
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
    };
  }, [spot]);



  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">
          🏯 {spot.name}
        </h1>

        {/* Video Player or Large Image with Overlay Controls */}
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
          ) : (
            <img
              src={spot.image_full}
              alt={spot.name}
              className="w-full h-80 md:h-96 object-cover rounded-xl shadow-lg cursor-pointer"
              onError={(e) => {
                e.target.src = spot.image_thumb || 'https://via.placeholder.com/800x400/f3f4f6/9ca3af?text=' + encodeURIComponent(spot.name);
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
          <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded-md text-sm">
            <div className="flex items-center gap-2">
              <span>⏱️ {spot.suggested_duration}</span>
              <span className="text-xs opacity-80">
                {hasVideo && mediaType === 'video' ? '🎬' : 
                 hasAudio && mediaType === 'audio' ? '🎵' : 
                 mediaType === 'tts' ? '🔊' : '🎵'}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl p-4 shadow-md mb-4">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">
            📖 景点详细介绍
          </h2>
          <p className="text-base text-gray-700 leading-relaxed">
            {spot.extended_description}
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