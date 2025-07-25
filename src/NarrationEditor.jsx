import { useState, useEffect } from 'react';
import { useHowlerAudio } from './hooks/useHowlerAudio';
import { useTTSService } from './hooks/useTTSService';
import ImageSequenceTimeline from './components/ImageSequenceTimeline';
import { ttsService } from './utils/ttsService';

function NarrationEditor() {
  // State management
  const [scenicAreas, setScenicAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [narrationText, setNarrationText] = useState('');
  
  // Local editing state - separate from spot data until save
  const [localImageSequence, setLocalImageSequence] = useState([]);
  const [localCoverImage, setLocalCoverImage] = useState('');
  const [localAudioInfo, setLocalAudioInfo] = useState(null); // Store audio info locally until save
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  
  // Flags to prevent local state reset during specific operations
  const [isUpdatingAudio, setIsUpdatingAudio] = useState(false);
  
  const [isDirty, setIsDirty] = useState(false);
  
  // TTS service
  const { generateAudio, isGenerating: isGeneratingAudio } = useTTSService();
  
  // QWen AI state
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);
  const [narrationSuccessMessage, setNarrationSuccessMessage] = useState('');
  
  // Audio generation state
  const [audioSuccessMessage, setAudioSuccessMessage] = useState('');
  
  // Save success state
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [coverSuccessMessage, setCoverSuccessMessage] = useState('');
  
  // Batch image import state
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchFolder, setBatchFolder] = useState('');
  const [batchImageList, setBatchImageList] = useState('');
  const [batchImportMessage, setBatchImportMessage] = useState('');

  // Audio state - Use local audio info if available, otherwise use saved spot audio
  const audioFile = localAudioInfo?.audioFile || selectedSpot?.audioFile || null;
  const {
    isPlaying,
    isLoading,
    currentTime,
    duration,
    play,
    pause,
    seekRelative,
    seekToTime,
    formatTime,
    error
  } = useHowlerAudio(audioFile, localImageSequence);

  // Load scenic areas on component mount
  useEffect(() => {
    loadScenicAreas();
  }, []);

  // Load spots when area changes
  useEffect(() => {
    if (selectedArea) {
      loadSpots(selectedArea.spotsFile);
    }
  }, [selectedArea]);

  // Update editor when spot changes
  useEffect(() => {
    console.log('🔍 useEffect[selectedSpot] triggered:', {
      selectedSpot: selectedSpot?.name,
      isUpdatingAudio,
      hasLocalChanges,
      localImageSequence: localImageSequence.length
    });
    
    if (selectedSpot && !isUpdatingAudio) {
      console.log('⚠️ RESETTING LOCAL STATE - Spot changed without isUpdatingAudio flag');
      setNarrationText(selectedSpot.description || '');
      // Sort existing image sequence by start time when loading
      const existingImageSequence = selectedSpot.imageSequence || [];
      const sortedImageSequence = [...existingImageSequence].sort((a, b) => a.start - b.start);
      setLocalImageSequence(sortedImageSequence);
      setLocalCoverImage(selectedSpot.image_thumb || '');
      setLocalAudioInfo(null); // Clear local audio info when spot changes
      setHasLocalChanges(false); // Clear local changes when spot data is loaded
      setIsDirty(false);
      
      // Set default batch folder path based on spot name
      setBatchFolder(`/spots/${selectedSpot.name}`);
      
      console.log('✅ Local state reset completed:', {
        imageSequenceCount: sortedImageSequence.length,
        coverImage: selectedSpot.image_thumb
      });
    } else if (selectedSpot && isUpdatingAudio) {
      console.log('🎵 Audio update detected - preserving local state');
      // Reset the flag immediately since we don't want it to persist
      setIsUpdatingAudio(false);
    }
  }, [selectedSpot]); // REMOVED isUpdatingAudio from dependencies

  // Debug effect to track localImageSequence changes
  useEffect(() => {
    console.log('🔍 localImageSequence changed:', {
      length: localImageSequence.length,
      hasLocalChanges,
      items: localImageSequence.map(img => ({ img: img.img, start: img.start, duration: img.duration }))
    });
  }, [localImageSequence]);

  // Debug effect to track hasLocalChanges
  useEffect(() => {
    console.log('🔍 hasLocalChanges changed:', hasLocalChanges);
  }, [hasLocalChanges]);

  // Load scenic areas data
  const loadScenicAreas = async () => {
    try {
      const result = await ttsService.getScenicAreas();
      setScenicAreas(result);
      if (result.length > 0) {
        setSelectedArea(result[0]);
      }
    } catch (error) {
      console.error('Failed to load scenic areas from Cloudflare:', error);
      alert(`加载景区数据失败: ${error.message}`);
    }
  };

  // Load spots data for selected area
  const loadSpots = async (spotsFile) => {
    if (!selectedArea) return;
    
    try {
      const result = await ttsService.getSpotData(selectedArea.name);
      setSpots(result);
      if (result.length > 0) {
        const firstSpot = result[0];
        setSelectedSpot(firstSpot);
        setNarrationText(firstSpot.description || '');
        setLocalImageSequence(firstSpot.imageSequence || []);
        setLocalCoverImage(firstSpot.image_thumb || '');
        setLocalAudioInfo(null); // Clear any local audio info when loading new spot
        
        // Log audio file status
        if (firstSpot.audioFile) {
          console.log(`Audio file available: ${firstSpot.audioFile}`);
        } else {
          console.log('No audio file available for this spot');
        }
      }
    } catch (error) {
      console.error('Failed to load spots from Cloudflare:', error);
      alert(`加载景点数据失败: ${error.message}`);
    }
  };

  // Handle narration text change
  const handleNarrationChange = (value) => {
    setNarrationText(value);
    setIsDirty(true);
  };

  // Generate narration using QWen AI through backend
  const handleGenerateNarration = async () => {
    if (!selectedSpot) {
      alert('请先选择一个景点');
      return;
    }

    setIsGeneratingNarration(true);
    setNarrationSuccessMessage(''); // Clear any previous success message
    
    try {
      const result = await ttsService.generateNarration(selectedSpot);
      
      if (result.success && result.narration) {
        setNarrationText(result.narration);
        setIsDirty(true);
        setNarrationSuccessMessage('导游词生成成功！');
        // Clear success message after 3 seconds
        setTimeout(() => setNarrationSuccessMessage(''), 3000);
      } else {
        alert('生成失败，请重试');
      }
    } catch (error) {
      console.error('QWen AI generation error:', error);
      alert(`生成失败: ${error.message}`);
    } finally {
      setIsGeneratingNarration(false);
    }
  };

  // Generate audio using Cloudflare Worker backend
  const handleGenerateAudio = async () => {
    if (!narrationText.trim()) {
      alert('请输入导游词文本');
      return;
    }

    if (!selectedArea || !selectedSpot) {
      alert('请先选择景区和景点');
      return;
    }

    setAudioSuccessMessage(''); // Clear any previous success message

    try {
      const result = await ttsService.generateAudio(narrationText, {
        voice: 'xiaoxiao',
        rate: '-10%',
        spotName: selectedSpot.name,
        areaName: selectedArea.name
      });

      if (result.success) {
        console.log('🎵 Audio generation successful, storing locally until save');
        console.log('📦 Audio info:', {
          audioFile: result.audioFile,
          audioVersion: result.audioVersion,
          fileName: result.fileName
        });
        
        // Store audio info locally (will be saved when user clicks "Save")
        setLocalAudioInfo({
          audioFile: result.audioFile,
          audioVersion: result.audioVersion,
          fileName: result.fileName
        });
        
        // Mark as having local changes
        setHasLocalChanges(true);
        setIsDirty(true);
        
        // Show success message with file info
        const sizeInfo = result.fileSizeKB ? ` (${result.fileSizeKB}KB)` : '';
        const versionInfo = result.audioVersion ? ` v${result.audioVersion}` : '';
        setAudioSuccessMessage(`语音生成成功！${sizeInfo}${versionInfo} 点击"保存修改"保存到云端`);
        // Clear success message after 5 seconds
        setTimeout(() => setAudioSuccessMessage(''), 5000);
        
        console.log('✅ Audio info stored locally, waiting for save');
      } else {
        alert(`语音生成失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Audio generation error:', error);
      alert(`语音生成失败: ${error.message}`);
    }
  };

  // Add new image to sequence
  const addImageToSequence = () => {
    console.log('➕ Adding image to sequence:', {
      currentSequenceLength: localImageSequence.length,
      hasLocalChanges
    });
    
    const startTime = localImageSequence.length > 0 
      ? localImageSequence[localImageSequence.length - 1].start + localImageSequence[localImageSequence.length - 1].duration 
      : Math.round(currentTime * 10) / 10;
    
    const newImage = {
      img: '',
      start: Math.round(startTime * 10) / 10,
      duration: 5.0,
      notes: ''
    };
    
    setLocalImageSequence([...localImageSequence, newImage]);
    setHasLocalChanges(true);
    setIsDirty(true);
    
    console.log('✅ Image added to local sequence, hasLocalChanges set to true');
  };

  // Handle batch import of images
  const handleBatchImportImages = () => {
    console.log('📁 Batch importing images from folder:', batchFolder, 'with files:', batchImageList);
    if (!batchFolder.trim()) {
      setBatchImportMessage('❌ 请输入文件夹路径');
      setTimeout(() => setBatchImportMessage(''), 3000);
      return;
    }

    if (!batchImageList.trim()) {
      setBatchImportMessage('❌ 请输入图片文件名列表');
      setTimeout(() => setBatchImportMessage(''), 3000);
      return;
    }

    try {
      // Parse image filenames from the text area
      const imageFiles = batchImageList
        .split(/[\n,\s]+/)
        .map(filename => filename.trim())
        .filter(filename => filename.length > 0)
        .filter(filename => /\.(jpg|jpeg|png|gif|webp)$/i.test(filename));

      if (imageFiles.length === 0) {
        setBatchImportMessage('❌ 没有找到有效的图片文件');
        setTimeout(() => setBatchImportMessage(''), 3000);
        return;
      }

      // Calculate starting time for batch import
      const startTime = localImageSequence.length > 0 
        ? localImageSequence[localImageSequence.length - 1].start + localImageSequence[localImageSequence.length - 1].duration 
        : 0;

      // Create new image sequence items
      const newImages = imageFiles.map((filename, index) => ({
        img: `${batchFolder}/${filename}`,
        start: Math.round((startTime + index * 5) * 10) / 10,
        duration: 5.0,
        notes: filename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '') // Use filename without extension as notes
      }));

      // Add to existing sequence
      const updatedSequence = [...localImageSequence, ...newImages];
      setLocalImageSequence(updatedSequence);
      setHasLocalChanges(true);
      setIsDirty(true);

      // Close modal and show success message
      setShowBatchImport(false);
      setBatchImportMessage(`✅ 成功添加 ${newImages.length} 张图片到序列`);
      setTimeout(() => setBatchImportMessage(''), 3000);

      // Clear form
      setBatchFolder('');
      setBatchImageList('');

    } catch (error) {
      setBatchImportMessage(`❌ 批量导入失败: ${error.message}`);
      setTimeout(() => setBatchImportMessage(''), 3000);
    }
  };

  // Handle image sequence updates from timeline (marks as dirty)
  const handleImageSequenceUpdate = (updatedSequence) => {
    console.log('🖼️ Image sequence updated:', {
      before: localImageSequence.length,
      after: updatedSequence.length,
      hasLocalChanges
    });
    
    // Sort by start time to maintain proper order
    const sortedSequence = [...updatedSequence].sort((a, b) => a.start - b.start);
    setLocalImageSequence(sortedSequence);
    setHasLocalChanges(true);
    setIsDirty(true);
    
    console.log('✅ Local image sequence updated, hasLocalChanges set to true');
  };

  // Handle setting image as spot cover
  const handleSetAsCover = (imageIndex) => {
    console.log('📸 Setting image as cover:', {
      imageIndex,
      currentLocalImageSequence: localImageSequence.length,
      currentLocalCoverImage: localCoverImage,
      hasLocalChanges
    });
    
    if (imageIndex >= 0 && imageIndex < localImageSequence.length) {
      const selectedImage = localImageSequence[imageIndex];
      
      if (!selectedImage.img) {
        setCoverSuccessMessage('❌ 该图片没有设置路径，无法设为封面');
        setTimeout(() => setCoverSuccessMessage(''), 3000);
        return;
      }
      
      console.log('🔄 Updating local cover image:', selectedImage.img);
      
      // Update local cover image only - no more selectedSpot updates
      setLocalCoverImage(selectedImage.img);
      setHasLocalChanges(true);
      setIsDirty(true);
      
      console.log('✅ Cover image set locally, hasLocalChanges set to true');
      
      setCoverSuccessMessage(`📸 已设置"${selectedImage.notes || '图片 ' + (imageIndex + 1)}"为景点封面`);
      setTimeout(() => setCoverSuccessMessage(''), 3000);
    }
  };

  // Save current spot data to Cloudflare
  const saveCurrentSpot = async () => {
    if (!selectedSpot || !hasLocalChanges) return;

    console.log('Saving spot with imageSequence:', localImageSequence);
    console.log('Saving spot with audio info:', localAudioInfo);

    // Sort image sequence by start time before saving
    const sortedImageSequence = [...localImageSequence].sort((a, b) => a.start - b.start);
    console.log('Sorted imageSequence by start time:', sortedImageSequence);

    // Prepare update payload with all local changes
    const updatePayload = {
      description: narrationText,
      imageSequence: sortedImageSequence,
      image_thumb: localCoverImage
    };

    // Include audio info if available
    if (localAudioInfo) {
      updatePayload.audioFile = localAudioInfo.audioFile;
      updatePayload.audioVersion = localAudioInfo.audioVersion;
      console.log('Including audio info in save:', {
        audioFile: localAudioInfo.audioFile,
        audioVersion: localAudioInfo.audioVersion
      });
    }

    const updatedSpot = {
      ...selectedSpot,
      ...updatePayload
    };

    try {
      // Save to Cloudflare KV storage with all updates
      await ttsService.updateSingleSpot(selectedArea.name, selectedSpot.name, updatePayload);

      // Update local state
      const updatedSpots = spots.map(spot => 
        spot.name === selectedSpot.name ? updatedSpot : spot
      );

      console.log('Updated spots:', updatedSpots);
      setSpots(updatedSpots);
      setSelectedSpot(updatedSpot);
      setLocalImageSequence(sortedImageSequence); // Update local state with sorted sequence
      setLocalCoverImage(updatedSpot.image_thumb); // Update local cover image
      setLocalAudioInfo(null); // Clear local audio info after successful save
      setHasLocalChanges(false); // Clear local changes after successful save
      setIsDirty(false);
      
      setSaveSuccessMessage('💾 数据已保存到云端！');
      setTimeout(() => setSaveSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save spot data:', error);
      setSaveSuccessMessage(`❌ 保存失败: ${error.message}`);
      setTimeout(() => setSaveSuccessMessage(''), 5000);
    }
  };

  // Export updated spots data
  const exportSpotsData = () => {
    const dataStr = JSON.stringify(spots, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedArea.spotsFile.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle toggling spot display (hide/show)
  const handleToggleSpotDisplay = async (spot, index) => {
    const newDisplay = spot.display === 'hide' ? 'show' : 'hide';
    const updatedSpots = [...spots];
    updatedSpots[index] = { ...spot, display: newDisplay };
    setSpots(updatedSpots);
    setIsDirty(true);
    setHasLocalChanges(true);

    try {
      await ttsService.updateSingleSpot(selectedArea.name, spot.name, { display: newDisplay });
      console.log(`Spot "${spot.name}" display status updated to: ${newDisplay}`);
    } catch (error) {
      console.error(`Failed to update spot display status for ${spot.name}:`, error);
      alert(`更新景点显示状态失败: ${error.message}`);
      // Revert the display status in the UI if update fails
      updatedSpots[index] = { ...spot, display: spot.display };
      setSpots(updatedSpots);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">导游词与图片序列编辑器</h1>
          <div className="flex gap-2 items-center">
            {saveSuccessMessage && (
              <span className={`text-sm font-medium ${saveSuccessMessage.includes('❌') ? 'text-red-600' : 'text-green-600'}`}>
                {saveSuccessMessage}
              </span>
            )}
            {coverSuccessMessage && (
              <span className={`text-sm font-medium ${coverSuccessMessage.includes('❌') ? 'text-red-600' : 'text-green-600'}`}>
                {coverSuccessMessage}
              </span>
            )}
            <button
              onClick={saveCurrentSpot}
              disabled={!hasLocalChanges}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存修改
            </button>
            <button
              onClick={exportSpotsData}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              导出JSON
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor */}
        <div className="flex-1 flex flex-col bg-white m-4 rounded-lg shadow-sm overflow-hidden">
          {selectedSpot ? (
            <>
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto">
                {/* Spot Info Header */}
                <div className="p-6 border-b">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-800">{selectedSpot.name}</h2>
                    <p className="text-gray-600 mt-1">{selectedSpot.address}</p>
                    {hasLocalChanges && (
                      <div className="mt-2 text-sm text-orange-600 flex items-center">
                        <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                        有未保存的修改
                      </div>
                    )}
                  </div>
                  {/* Current Cover Image */}
                  {localCoverImage && (
                    <div className="flex-shrink-0">
                      <div className="text-xs text-gray-500 mb-1">当前封面</div>
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border">
                        <img
                          src={localCoverImage}
                          alt="景点封面"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full hidden items-center justify-center text-gray-400 text-xs">
                          🖼️
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Narration Text Editor */}
              <div className="p-6 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-700">导游词文本</h3>
                  <div className="flex gap-2 items-center">
                    {narrationSuccessMessage && (
                      <span className="text-green-600 text-sm font-medium">
                        ✅ {narrationSuccessMessage}
                      </span>
                    )}
                    {audioSuccessMessage && (
                      <span className="text-green-600 text-sm font-medium">
                        ✅ {audioSuccessMessage}
                      </span>
                    )}
                    <button
                      onClick={handleGenerateNarration}
                      disabled={isGeneratingNarration || !selectedSpot}
                      className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isGeneratingNarration ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          生成中...
                        </>
                      ) : (
                        <>
                          🤖 AI生成导游词
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleGenerateAudio}
                      disabled={isGeneratingAudio || !narrationText.trim()}
                      className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isGeneratingAudio ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          生成中...
                        </>
                      ) : (
                        <>
                          🎤 生成语音
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <textarea
                  value={narrationText}
                  onChange={(e) => handleNarrationChange(e.target.value)}
                  placeholder="请输入导游词文本..."
                  className="w-full h-32 p-3 border border-gray-300 rounded-md resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="mt-2 text-sm text-gray-500">
                  字数: {narrationText.length}
                </div>
              </div>

              {/* Audio Player */}
              {audioFile ? (
                <div className="p-6 border-b">
                  <h3 className="text-lg font-medium text-gray-700 mb-4">音频播放</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {/* Audio Status */}
                    <div className="mb-3 text-sm">
                      <div className="text-gray-600">
                        音频文件: <span className="font-mono text-xs">{audioFile}</span>
                      </div>
                      {error && (
                        <div className="text-red-600 mt-1 flex items-center gap-1">
                          ❌ {error}
                        </div>
                      )}
                      {isLoading && (
                        <div className="text-blue-600 mt-1 flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          加载中...
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={isPlaying ? pause : play}
                          disabled={isLoading || error}
                          className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 disabled:opacity-50"
                        >
                          {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : isPlaying ? (
                            '⏸️'
                          ) : (
                            '▶️'
                          )}
                        </button>
                        <div className="text-sm text-gray-600">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => seekRelative(-10)}
                          disabled={isLoading || error}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          -10s
                        </button>
                        <button
                          onClick={() => seekRelative(10)}
                          disabled={isLoading || error}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          +10s
                        </button>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 border-b">
                  <h3 className="text-lg font-medium text-gray-700 mb-4">音频播放</h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                    <div className="text-4xl mb-2">🎵</div>
                    <div>暂无音频文件</div>
                    <div className="text-sm mt-1">点击"生成语音"按钮创建音频</div>
                  </div>
                </div>
              )}

              {/* Image Sequence Timeline */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-700">图片序列时间轴</h3>
                  <div className="flex gap-2 items-center">
                    {batchImportMessage && (
                      <span className={`text-sm font-medium ${batchImportMessage.includes('❌') ? 'text-red-600' : 'text-green-600'}`}>
                        {batchImportMessage}
                      </span>
                    )}
                    <button
                      onClick={() => setShowBatchImport(true)}
                      className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
                    >
                      📁 批量添加
                    </button>
                    <button
                      onClick={addImageToSequence}
                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    >
                      + 添加图片
                    </button>
                  </div>
                </div>

                {localImageSequence.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    暂无图片序列，点击"添加图片"或"批量添加"开始创建
                  </div>
                ) : (
                  <ImageSequenceTimeline
                    imageSequence={localImageSequence}
                    onUpdateSequence={handleImageSequenceUpdate}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    onSeek={seekToTime}
                    onSetAsCover={handleSetAsCover}
                  />
                )}

                {/* Batch Import Modal */}
                {showBatchImport && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">批量添加图片</h3>
                        <button
                          onClick={() => setShowBatchImport(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            文件夹路径
                          </label>
                          <input
                            type="text"
                            value={batchFolder}
                            onChange={(e) => setBatchFolder(e.target.value)}
                            placeholder={`/spots/${selectedSpot?.name}`}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            例如: /spots/将军柏
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            图片文件列表 (一行一个文件名，或用空格/逗号分隔)
                          </label>
                          <textarea
                            value={batchImageList}
                            onChange={(e) => setBatchImageList(e.target.value)}
                            placeholder={`二将军柏-特写.jpg 二将军柏-门视角.jpg`}
                            rows={8}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            支持格式: jpg, jpeg, png, gif, webp
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 mt-6">
                        <button
                          onClick={() => setShowBatchImport(false)}
                          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleBatchImportImages}
                          className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
                        >
                          批量添加
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              请选择一个景点开始编辑
            </div>
          )}
        </div>

        {/* Right Panel - Area & Spots Selection */}
        <div className="w-80 bg-white m-4 rounded-lg shadow-sm flex flex-col">
          {/* Scenic Area Selector */}
          <div className="p-4 border-b">
            <h3 className="text-lg font-medium text-gray-700 mb-3">景区选择</h3>
            <select
              value={selectedArea?.name || ''}
              onChange={(e) => {
                const area = scenicAreas.find(a => a.name === e.target.value);
                setSelectedArea(area);
              }}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {scenicAreas.map(area => (
                <option key={area.name} value={area.name}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          {/* Spots List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-700 mb-3">景点列表</h3>
              {spots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无景点数据
                </div>
              ) : (
                <div className="space-y-2">
                  {spots.map((spot, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg transition-colors ${
                        selectedSpot?.name === spot.name
                          ? 'bg-blue-100 border-blue-300 border'
                          : 'bg-gray-50 hover:bg-gray-100'
                      } ${spot.display === 'hide' ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedSpot(spot)}
                        >
                          <div className="font-medium text-gray-800 flex items-center gap-2">
                            {spot.name}
                            {spot.display === 'hide' && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                                隐藏
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {spot.description ? `${spot.description.substring(0, 50)}...` : '暂无描述'}
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            {spot.audioFile && (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                🎵 有音频
                              </span>
                            )}
                            {spot.imageSequence && spot.imageSequence.length > 0 && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                🖼️ {spot.imageSequence.length}张图片
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Hide/Show Toggle Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSpotDisplay(spot, index);
                          }}
                          className={`ml-2 px-2 py-1 text-xs rounded transition-colors ${
                            spot.display === 'hide'
                              ? 'bg-red-100 text-red-600 hover:bg-red-200'
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                          }`}
                          title={spot.display === 'hide' ? '点击显示景点' : '点击隐藏景点'}
                        >
                          {spot.display === 'hide' ? '👁️' : '🚫'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NarrationEditor; 