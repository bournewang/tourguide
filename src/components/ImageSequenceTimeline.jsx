import { useState, useRef, useEffect, useCallback } from 'react';

function ImageSequenceTimeline({ 
  imageSequence = [], 
  onUpdateSequence, 
  onSetAsCover, // Add this new prop
  currentTime = 0, 
  duration = 0, 
  isPlaying = false,
  onSeek 
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const timelineRef = useRef(null);
  const [timelineWidth, setTimelineWidth] = useState(800);

  // Update timeline width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Convert time to pixel position
  const timeToPixel = (time) => {
    if (duration === 0) return 0;
    return (time / duration) * timelineWidth;
  };

  // Convert pixel position to time
  const pixelToTime = (pixel) => {
    if (timelineWidth === 0) return 0;
    return Math.max(0, Math.min(duration, (pixel / timelineWidth) * duration));
  };

  // Handle mouse down on image block
  const handleMouseDown = useCallback((e, index, edge = null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!timelineRef.current) return;
    
    setDraggedIndex(index);
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    let offset;
    if (edge === 'start') {
      offset = clickX - timeToPixel(imageSequence[index].start);
    } else if (edge === 'end') {
      offset = clickX - timeToPixel(imageSequence[index].start + imageSequence[index].duration);
    } else {
      offset = clickX - timeToPixel(imageSequence[index].start);
    }

    // Create handlers for this specific drag session
    const handleMouseMoveForDrag = (moveEvent) => {
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const currentX = moveEvent.clientX - rect.left - offset;
      const newTime = pixelToTime(currentX);
      
      const updatedSequence = [...imageSequence];
      const item = updatedSequence[index];

      if (edge === 'start') {
        // Dragging start edge
        const maxStart = item.start + item.duration - 0.1;
        const newStart = Math.max(0, Math.min(maxStart, newTime));
        const newDuration = item.duration + (item.start - newStart);
        
        updatedSequence[index] = {
          ...item,
          start: Math.round(newStart * 10) / 10,
          duration: Math.max(0.1, Math.round(newDuration * 10) / 10)
        };
      } else if (edge === 'end') {
        // Dragging end edge
        const newEnd = Math.max(item.start + 0.1, Math.min(duration, newTime));
        const newDuration = newEnd - item.start;
        
        updatedSequence[index] = {
          ...item,
          duration: Math.max(0.1, Math.round(newDuration * 10) / 10)
        };
      } else {
        // Dragging entire block
        const newStart = Math.max(0, Math.min(duration - item.duration, newTime));
        updatedSequence[index] = {
          ...item,
          start: Math.round(newStart * 10) / 10
        };
      }

      onUpdateSequence(updatedSequence);
    };

    const handleMouseUpForDrag = () => {
      setDraggedIndex(null);
      document.removeEventListener('mousemove', handleMouseMoveForDrag);
      document.removeEventListener('mouseup', handleMouseUpForDrag);
    };

    document.addEventListener('mousemove', handleMouseMoveForDrag);
    document.addEventListener('mouseup', handleMouseUpForDrag);
  }, [imageSequence, duration, onUpdateSequence, timeToPixel, pixelToTime]);



  // Handle timeline click to seek
  const handleTimelineClick = (e) => {
    // Don't seek if we're dragging or if click was on an image block
    if (draggedIndex !== null || e.target.closest('.image-block')) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekTime = pixelToTime(clickX);
    
    if (onSeek) {
      onSeek(seekTime);
    }
  };

  // Generate time markers
  const generateTimeMarkers = () => {
    const markers = [];
    const interval = duration > 60 ? 10 : duration > 30 ? 5 : 1; // Dynamic interval
    
    for (let time = 0; time <= duration; time += interval) {
      markers.push(
        <div
          key={time}
          className="absolute top-0 h-full border-l border-gray-300"
          style={{ left: `${timeToPixel(time)}px` }}
        >
          <span className="absolute -top-5 -left-4 text-xs text-gray-500 bg-white px-1">
            {Math.round(time)}s
          </span>
        </div>
      );
    }
    
    return markers;
  };

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get color for image block
  const getImageBlockColor = (index) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 
      'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="w-full">
      {/* Timeline Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-700">图片序列时间轴</h3>
        <div className="text-sm text-gray-600">
          总时长: {formatTime(duration)} | 当前: {formatTime(currentTime)}
        </div>
      </div>

      {/* Current Image Preview - Player Style */}
      <div className="mb-6">
        {(() => {
          const currentImage = imageSequence.find(img => 
            currentTime >= img.start && currentTime < (img.start + img.duration)
          );
          
          if (currentImage) {
            const progress = ((currentTime - currentImage.start) / currentImage.duration) * 100;
            
            return (
              <div className="bg-black rounded-lg shadow-xl overflow-hidden">
                {/* Image Display Area */}
                <div className="relative bg-black flex items-center justify-center" style={{ height: '240px' }}>
                  {currentImage.img ? (
                    <img
                      src={currentImage.img}
                      alt={currentImage.notes || '图片'}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="text-white text-center hidden items-center justify-center w-full h-full bg-gray-800">
                    <div>
                      <div className="text-4xl mb-2">🖼️</div>
                      <div className="text-lg">无图片</div>
                    </div>
                  </div>
                  
                  {/* Image Info Overlay */}
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4">
                    <div className="text-white">
                      <div className="text-lg font-medium truncate">
                        {currentImage.notes || '当前图片'}
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        图片路径: {currentImage.img || '未设置'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Player Controls */}
                <div className="bg-gray-900 p-4">
                  <div className="flex items-center justify-between text-white text-sm mb-2">
                    <span>图片播放进度</span>
                    <span>
                      {formatTime(currentTime - currentImage.start)} / {formatTime(currentImage.duration)}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>开始: {currentImage.start}s</span>
                    <span>结束: {(currentImage.start + currentImage.duration).toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center" style={{ height: '240px' }}>
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-2">⏸️</div>
                  <div className="text-lg font-medium">暂无图片显示</div>
                  <div className="text-sm mt-1">播放音频时将显示对应的图片</div>
                </div>
              </div>
            );
          }
        })()}
      </div>

      {/* Timeline Container */}
      <div className="bg-gray-100 rounded-lg p-4">
        {/* Timeline */}
        <div 
          ref={timelineRef}
          className="relative h-20 bg-white rounded border cursor-pointer select-none"
          onClick={handleTimelineClick}
        >
          {/* Time markers */}
          {generateTimeMarkers()}
          
          {/* Current time indicator */}
          <div
            className="absolute top-0 h-full w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{ left: `${timeToPixel(currentTime)}px` }}
          >
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full"></div>
          </div>

          {/* Image blocks */}
          {imageSequence.map((image, index) => {
            const left = timeToPixel(image.start);
            const width = timeToPixel(image.duration);
            const colorClass = getImageBlockColor(index);
            
            return (
              <div
                key={index}
                className={`image-block absolute top-2 h-16 ${colorClass} bg-opacity-80 border-2 border-white rounded cursor-move z-10 flex items-center justify-center text-white text-xs font-medium shadow-md ${
                  draggedIndex === index ? 'ring-2 ring-blue-400 shadow-lg' : ''
                }`}
                style={{ 
                  left: `${left}px`, 
                  width: `${Math.max(width, 20)}px` // Minimum width for visibility
                }}
                onMouseDown={(e) => handleMouseDown(e, index)}
                title={`${image.notes || `图片 ${index + 1}`} (${image.start}s - ${(image.start + image.duration).toFixed(1)}s)`}
              >
                {/* Start resize handle */}
                <div
                  className="absolute left-0 top-0 w-3 h-full bg-black bg-opacity-40 cursor-w-resize hover:bg-opacity-60 flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, index, 'start');
                  }}
                  title="拖拽调整开始时间"
                >
                  <div className="w-0.5 h-8 bg-white bg-opacity-60"></div>
                </div>
                
                {/* Content */}
                <div className="px-1 text-center truncate flex items-center justify-center pointer-events-none">
                  {width > 60 ? (
                    <div className="flex items-center gap-1">
                      {image.img && (
                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded border border-white border-opacity-30 flex items-center justify-center overflow-hidden">
                          <img
                            src={image.img}
                            alt={image.notes || '图片'}
                            className="max-w-full max-h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                          <div className="text-xs text-white hidden">🖼️</div>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">#{index + 1}</div>
                        {image.notes && width > 100 && (
                          <div className="text-xs opacity-80 truncate">
                            {image.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-medium">#{index + 1}</div>
                  )}
                </div>
                
                {/* End resize handle */}
                <div
                  className="absolute right-0 top-0 w-3 h-full bg-black bg-opacity-40 cursor-e-resize hover:bg-opacity-60 flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, index, 'end');
                  }}
                  title="拖拽调整结束时间"
                >
                  <div className="w-0.5 h-8 bg-white bg-opacity-60"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline Controls */}
        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
          <div>
            💡 提示: 点击时间轴跳转，拖拽图片块调整位置，拖拽边缘调整时长
          </div>
          <div className="flex items-center gap-4">
            <span>图片数量: {imageSequence.length}</span>
            {isPlaying && (
              <span className="text-green-600 flex items-center">
                ▶️ 播放中
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Image Sequence List */}
      <div className="mt-6">
        <h4 className="text-md font-medium text-gray-700 mb-3">图片详情</h4>
        <div className="space-y-2">
          {imageSequence.map((image, index) => (
            <div
              key={index}
              className={`p-3 border rounded-lg ${
                Math.floor(currentTime) >= Math.floor(image.start) && 
                Math.floor(currentTime) < Math.floor(image.start + image.duration)
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 ${getImageBlockColor(index)} rounded`}></div>
                    <span className="font-medium">图片 #{index + 1}</span>
                    {Math.floor(currentTime) >= Math.floor(image.start) && 
                     Math.floor(currentTime) < Math.floor(image.start + image.duration) && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">当前显示</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="block text-gray-600 mb-1">图片路径</label>
                      <input
                        type="text"
                        value={image.img}
                        onChange={(e) => {
                          const updated = [...imageSequence];
                          updated[index] = { ...updated[index], img: e.target.value };
                          onUpdateSequence(updated);
                        }}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="/spots/景点名/图片名.jpg"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1">说明</label>
                      <input
                        type="text"
                        value={image.notes}
                        onChange={(e) => {
                          const updated = [...imageSequence];
                          updated[index] = { ...updated[index], notes: e.target.value };
                          onUpdateSequence(updated);
                        }}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="图片说明"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-gray-600">
                      开始: {image.start}s ({formatTime(image.start)})
                    </span>
                    <span className="text-gray-600">
                      时长: {image.duration}s ({formatTime(image.duration)})
                    </span>
                    <span className="text-gray-600">
                      结束: {(image.start + image.duration).toFixed(1)}s ({formatTime(image.start + image.duration)})
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    const updated = imageSequence.filter((_, i) => i !== index);
                    onUpdateSequence(updated);
                  }}
                  className="ml-4 text-red-500 hover:text-red-700 p-1"
                  title="删除图片"
                >
                  🗑️
                </button>
                {onSetAsCover && (
                  <button
                    onClick={() => onSetAsCover(index)}
                    className="ml-2 text-blue-500 hover:text-blue-700 p-1"
                    title="设为封面"
                  >
                    📸
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ImageSequenceTimeline; 