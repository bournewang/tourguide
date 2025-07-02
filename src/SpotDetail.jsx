import { useState, useEffect, useRef } from 'react';

function SpotDetail({ spot, onBack }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  // Get audio file directly from spot data
  const audioFile = spot.audioFile ? `/audio/${spot.audioFile}` : null;

  const playPreGeneratedAudio = () => {
    if (!audioFile) {
      console.log('No audio file found, falling back to text-to-speech');
      playTextToSpeech();
      return;
    }

    setIsLoading(true);
    setAudioError(false);

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

  const toggleNarration = () => {
    if (isPlaying) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      } else {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      }
    } else {
      // Start playback - try pre-generated audio first
      playPreGeneratedAudio();
    }
  };

  // Auto-play narration when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      playPreGeneratedAudio();
    }, 800);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [spot]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Title */}
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 border-b-4 border-blue-300 pb-4">
          🏯 {spot.name}
        </h1>

        {/* Large Image */}
        <div className="mb-8">
          <img
            src={spot.image_full}
            alt={spot.name}
            className="w-full h-80 md:h-96 object-cover rounded-2xl shadow-xl border-4 border-white"
            onError={(e) => {
              e.target.src = spot.image_thumb || 'https://via.placeholder.com/800x400/f3f4f6/9ca3af?text=' + encodeURIComponent(spot.name);
            }}
          />
        </div>

        {/* Audio Controls */}
        <div className="mb-8 text-center bg-white rounded-2xl p-8 shadow-lg border-2 border-blue-200">
          <button
            onClick={toggleNarration}
            disabled={isLoading}
            className={`px-8 py-4 rounded-2xl font-bold text-xl shadow-lg transition-all duration-200 ${
              isLoading
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : isPlaying 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isLoading ? '⏳ 加载中...' : isPlaying ? '⏹️ 停止讲解' : '🎧 播放讲解'}
          </button>
          
          <div className="mt-4">
            <p className="text-lg text-gray-700">
              ⏱️ 讲解时长: <span className="font-bold text-blue-600">{spot.suggested_duration}</span>
            </p>
            {audioFile && !audioError && (
              <p className="text-sm text-green-600 mt-2">
                🎵 高品质音频播放
              </p>
            )}
            {audioError && (
              <p className="text-sm text-yellow-600 mt-2">
                ⚠️ 使用浏览器语音合成
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-blue-200 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b-2 border-blue-200 pb-3">
            📖 景点详细介绍
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            {spot.extended_description}
          </p>
        </div>

        {/* Instructions */}
        <div className="mb-8 text-center bg-yellow-100 border-2 border-yellow-300 rounded-2xl p-6">
          <p className="text-lg text-yellow-800 font-medium">
            💡 提示：您可以随时点击"播放讲解"按钮重新收听介绍
          </p>
        </div>
      </div>

      {/* Fixed Back Button at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-gray-300 shadow-lg">
        <button
          onClick={onBack}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-2xl text-xl font-bold shadow-lg transition-colors duration-200"
        >
          ← 返回景点列表
        </button>
      </div>
    </div>
  );
}

export default SpotDetail; 