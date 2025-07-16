// Cloudflare Worker for TourGuide Backend
// Handles TTS generation, audio storage, and spot data management

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Voice options for Azure TTS
const VOICES = {
  'xiaoxiao': 'zh-CN-XiaoxiaoNeural',
  'yunxi': 'zh-CN-YunxiNeural',
  'xiaoyi': 'zh-CN-XiaoyiNeural',
  'yunjian': 'zh-CN-YunjianNeural',
  'xiaomo': 'zh-CN-XiaomoNeural',
  'xiaoxuan': 'zh-CN-XiaoxuanNeural',
  'xiaohan': 'zh-CN-XiaohanNeural',
  'xiaorui': 'zh-CN-XiaoruiNeural',
};

// Generate SSML for Azure TTS
function generateSSML(text, voice, rate, pitch) {
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
    <voice name="${voice}">
      <prosody rate="${rate}" pitch="${pitch}">
        ${text}
      </prosody>
    </voice>
  </speak>`;
}

// Generate TTS audio using Azure Speech API
async function generateTTS(text, options = {}, env) {
  const {
    voice = 'xiaoxiao',
    rate = '-10%',
    pitch = '0%',
    spotName = 'narration'
  } = options;

  const apiKey = env.AZURE_SPEECH_KEY;
  const region = env.AZURE_SPEECH_REGION || 'eastus';

  if (!apiKey) {
    throw new Error('Azure Speech API key not configured');
  }

  // Map voice name to Azure voice
  const azureVoice = VOICES[voice] || voice;
  
  // Generate SSML
  const ssml = generateSSML(text, azureVoice, rate, pitch);
  
  // Call Azure TTS API
  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
      'User-Agent': 'TourGuide-CF-Worker'
    },
    body: ssml
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure TTS API error (${response.status}): ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const fileName = `${spotName}.mp3`;
  
  return {
    audioBuffer,
    fileName,
    fileSizeKB: (audioBuffer.byteLength / 1024).toFixed(2),
    textLength: text.length,
    voice: azureVoice,
    rate,
    pitch
  };
}

// Store audio file in R2 storage
async function storeAudioFile(audioBuffer, fileName, env) {
  const key = `audio/${fileName}`;
  
  try {
    console.log(`Storing audio file: ${fileName}, size: ${audioBuffer.byteLength} bytes`);
    console.log(`R2 key: ${key}`);
    console.log(`AUDIO_BUCKET binding available: ${!!env.AUDIO_BUCKET}`);
    
    await env.AUDIO_BUCKET.put(key, audioBuffer, {
      httpMetadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000', // 1 year cache
      },
    });
    
    console.log(`Successfully stored audio file: ${fileName}`);
    
    return {
      url: `/api/audio/${fileName}`,
      key,
      size: audioBuffer.byteLength
    };
  } catch (error) {
    console.error(`Failed to store audio file ${fileName}:`, error);
    throw new Error(`Failed to store audio file: ${error.message}`);
  }
}

// Get audio file from R2 storage
async function getAudioFile(fileName, env) {
  const key = `audio/${fileName}`;
  
  try {
    console.log(`Retrieving audio file: ${fileName}`);
    console.log(`R2 key: ${key}`);
    console.log(`AUDIO_BUCKET binding available: ${!!env.AUDIO_BUCKET}`);
    
    const object = await env.AUDIO_BUCKET.get(key);
    
    if (!object) {
      console.log(`Audio file not found in R2: ${fileName}`);
      return null;
    }
    
    console.log(`Successfully retrieved audio file: ${fileName}, size: ${object.size}`);
    
    return {
      body: object.body,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000',
        'Content-Length': object.size.toString(),
      }
    };
  } catch (error) {
    console.error(`Failed to retrieve audio file ${fileName}:`, error);
    return null;
  }
}

// Store spot data in KV storage
async function storeSpotData(areaName, spotData, env) {
  const key = `spots:${areaName}`;
  await env.SPOT_DATA.put(key, JSON.stringify(spotData));
  return true;
}

// Get spot data from KV storage
async function getSpotData(areaName, env) {
  const key = `spots:${areaName}`;
  const data = await env.SPOT_DATA.get(key);
  return data ? JSON.parse(data) : null;
}

// Store scenic area data in KV storage
async function storeScenicAreaData(areaData, env) {
  const key = 'scenic-areas';
  await env.SPOT_DATA.put(key, JSON.stringify(areaData));
  return true;
}

// Get scenic area data from KV storage
async function getScenicAreaData(env) {
  const key = 'scenic-areas';
  const data = await env.SPOT_DATA.get(key);
  return data ? JSON.parse(data) : [];
}

// NFC Device Access Management Functions

// Store device fingerprint for a UID
async function storeDeviceAccess(uid, deviceFingerprint, env) {
  const key = `nfc_devices:${uid}`;
  
  // Get existing device list
  const existingData = await env.SPOT_DATA.get(key);
  const devices = existingData ? JSON.parse(existingData) : [];
  
  // Check if device already exists
  const existingDevice = devices.find(d => d.fingerprint === deviceFingerprint);
  
  if (existingDevice) {
    // Update last access time
    existingDevice.lastAccess = Date.now();
    existingDevice.accessCount = (existingDevice.accessCount || 0) + 1;
  } else {
    // Add new device
    devices.push({
      fingerprint: deviceFingerprint,
      firstAccess: Date.now(),
      lastAccess: Date.now(),
      accessCount: 1
    });
  }
  
  // Store updated device list
  await env.SPOT_DATA.put(key, JSON.stringify(devices));
  
  return {
    success: true,
    deviceCount: devices.length,
    isNewDevice: !existingDevice
  };
}

// Get device access info for a UID
async function getDeviceAccess(uid, env) {
  const key = `nfc_devices:${uid}`;
  const data = await env.SPOT_DATA.get(key);
  return data ? JSON.parse(data) : [];
}

// Check if device can access UID (within device limit)
async function checkDeviceLimit(uid, deviceFingerprint, maxDevices = 3, env) {
  const devices = await getDeviceAccess(uid, env);
  
  // Check if this device is already registered
  const existingDevice = devices.find(d => d.fingerprint === deviceFingerprint);
  
  if (existingDevice) {
    return {
      allowed: true,
      reason: 'existing_device',
      deviceCount: devices.length
    };
  }
  
  // Check if we're under the device limit
  if (devices.length < maxDevices) {
    return {
      allowed: true,
      reason: 'under_limit',
      deviceCount: devices.length
    };
  }
  
  return {
    allowed: false,
    reason: 'device_limit_exceeded',
    deviceCount: devices.length,
    maxDevices: maxDevices
  };
}

// Clean up old device access records (optional maintenance)
async function cleanupOldDevices(uid, maxAge = 30 * 24 * 60 * 60 * 1000, env) {
  const devices = await getDeviceAccess(uid, env);
  const cutoffTime = Date.now() - maxAge; // 30 days ago
  
  const activeDevices = devices.filter(d => d.lastAccess > cutoffTime);
  
  if (activeDevices.length !== devices.length) {
    const key = `nfc_devices:${uid}`;
    await env.SPOT_DATA.put(key, JSON.stringify(activeDevices));
    
    return {
      cleaned: true,
      removedCount: devices.length - activeDevices.length,
      remainingCount: activeDevices.length
    };
  }
  
  return {
    cleaned: false,
    remainingCount: devices.length
  };
}

// Generate narration using QWen AI
async function generateNarration(spotInfo, env) {
  const apiKey = env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('Dashscope API key not configured');
  }

  const prompt = `请为以下景点生成一段生动详细的导游解说词，要求：
1. 语言生动有趣，富有感染力
2. 包含历史文化背景，如果有名人题字/对联，请注重讲解
3. 突出景点特色和亮点
4. 适合口语化表达
5. 长度约200-300字

景点信息：
名称：${spotInfo.name}
地址：${spotInfo.address || '暂无'}
现有描述：${spotInfo.description || '暂无'}

请生成导游解说词, 输出纯文本供给tts使用（不要带有markdown符号，不要带有其他说明文字）：`;

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-v3', // 'qwen-plus',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    throw new Error(`QWen API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

// Handle API requests
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API Routes
    if (path.startsWith('/api/')) {
      
      // TTS Generation API - Only generates and returns audio URL, doesn't update spot data
      if (path === '/api/tts' && method === 'POST') {
        const body = await request.json();
        const { text, voice, rate, pitch, spotName, areaName } = body;
        
        if (!text || !spotName || !areaName) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get current spot data to determine next audio version
        const spotData = await getSpotData(areaName, env) || [];
        const spotIndex = spotData.findIndex(spot => spot.name === spotName);
        
        let currentSpot = spotIndex !== -1 ? spotData[spotIndex] : { name: spotName };
        const nextAudioVersion = (currentSpot.audioVersion || 0) + 1;
        
        // Create versioned filename
        const versionedFileName = `${spotName}-v${nextAudioVersion}.mp3`;
        
        // Generate TTS audio with versioned filename
        const ttsResult = await generateTTS(text, { voice, rate, pitch, spotName: versionedFileName.replace('.mp3', '') }, env);
        
        // Store audio file in R2 with versioned filename
        const audioFile = await storeAudioFile(ttsResult.audioBuffer, versionedFileName, env);
        
        // NOTE: Spot data update removed - audio info will be saved when user clicks "Save"
        // This provides better UX and atomic updates

        return new Response(JSON.stringify({
          success: true,
          audioFile: audioFile.url,
          fileName: versionedFileName,
          audioVersion: nextAudioVersion,
          fileSizeKB: parseFloat(ttsResult.fileSizeKB),
          textLength: ttsResult.textLength,
          voice: ttsResult.voice,
          rate: ttsResult.rate,
          pitch: ttsResult.pitch
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Narration Generation API
      if (path === '/api/narration' && method === 'POST') {
        const body = await request.json();
        const { spotInfo } = body;
        
        if (!spotInfo || !spotInfo.name) {
          return new Response(JSON.stringify({ error: 'Missing spot information' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const narration = await generateNarration(spotInfo, env);
        
        return new Response(JSON.stringify({
          success: true,
          narration
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Audio File Serving API
      if (path.startsWith('/api/audio/') && method === 'GET') {
        const encodedFileName = path.replace('/api/audio/', '');
        // Decode URL-encoded filename
        const fileName = decodeURIComponent(encodedFileName);
        console.log(`Audio request - encoded: ${encodedFileName}, decoded: ${fileName}`);
        
        const audioFile = await getAudioFile(fileName, env);
        
        if (!audioFile) {
          return new Response('Audio file not found', {
            status: 404,
            headers: corsHeaders
          });
        }
        
        return new Response(audioFile.body, {
          headers: { ...corsHeaders, ...audioFile.headers }
        });
      }

      // Spot Data Management API
      if (path === '/api/spots' && method === 'GET') {
        const areaName = url.searchParams.get('area');
        if (!areaName) {
          return new Response(JSON.stringify({ error: 'Area name required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const spotData = await getSpotData(areaName, env);
        return new Response(JSON.stringify(spotData || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path === '/api/spots' && method === 'POST') {
        const body = await request.json();
        const { areaName, spotData } = body;
        
        if (!areaName || !spotData) {
          return new Response(JSON.stringify({ error: 'Missing area name or spot data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await storeSpotData(areaName, spotData, env);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update single spot - Enhanced to handle all spot data including audio info
      if (path === '/api/spot' && method === 'PUT') {
        const body = await request.json();
        const { areaName, spotName, spotUpdate } = body;
        
        if (!areaName || !spotName || !spotUpdate) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const spotData = await getSpotData(areaName, env) || [];
        const spotIndex = spotData.findIndex(spot => spot.name === spotName);
        
        if (spotIndex !== -1) {
          // Prepare update with automatic timestamps
          const updateWithTimestamp = {
            ...spotUpdate,
            lastUpdated: new Date().toISOString()
          };
          
          // Add audio-specific timestamp if audio info is being updated
          if (spotUpdate.audioFile || spotUpdate.audioVersion) {
            updateWithTimestamp.lastAudioGenerated = new Date().toISOString();
          }
          
          // Merge with existing spot data
          spotData[spotIndex] = { ...spotData[spotIndex], ...updateWithTimestamp };
          await storeSpotData(areaName, spotData, env);
          
          console.log(`Spot updated: ${spotName}`, {
            hasAudio: !!spotUpdate.audioFile,
            hasImageSequence: !!spotUpdate.imageSequence,
            hasCoverImage: !!spotUpdate.image_thumb,
            hasDescription: !!spotUpdate.description
          });
        } else {
          return new Response(JSON.stringify({ error: 'Spot not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Scenic Areas API
      if (path === '/api/scenic-areas' && method === 'GET') {
        const areaData = await getScenicAreaData(env);
        return new Response(JSON.stringify(areaData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path === '/api/scenic-areas' && method === 'POST') {
        const body = await request.json();
        const { areaData } = body;
        
        if (!areaData) {
          return new Response(JSON.stringify({ error: 'Missing area data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await storeScenicAreaData(areaData, env);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // NFC Device Access API
      if (path === '/api/nfc/validate' && method === 'POST') {
        const body = await request.json();
        const { uid, deviceFingerprint, maxDevices = 3 } = body;
        
        if (!uid || !deviceFingerprint) {
          return new Response(JSON.stringify({ error: 'Missing uid or deviceFingerprint' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check device limit
        const limitCheck = await checkDeviceLimit(uid, deviceFingerprint, maxDevices, env);
        
        if (!limitCheck.allowed) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Device limit exceeded',
            reason: limitCheck.reason,
            deviceCount: limitCheck.deviceCount,
            maxDevices: limitCheck.maxDevices
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Store device access
        const storeResult = await storeDeviceAccess(uid, deviceFingerprint, env);
        
        return new Response(JSON.stringify({
          success: true,
          deviceCount: storeResult.deviceCount,
          isNewDevice: storeResult.isNewDevice,
          reason: limitCheck.reason
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get device access info for debugging/analytics
      if (path === '/api/nfc/devices' && method === 'GET') {
        const uid = url.searchParams.get('uid');
        
        if (!uid) {
          return new Response(JSON.stringify({ error: 'Missing uid parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const devices = await getDeviceAccess(uid, env);
        
        return new Response(JSON.stringify({
          uid: uid,
          deviceCount: devices.length,
          devices: devices.map(d => ({
            fingerprint: d.fingerprint.substring(0, 8) + '...', // Mask for privacy
            firstAccess: d.firstAccess,
            lastAccess: d.lastAccess,
            accessCount: d.accessCount
          }))
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Cleanup old devices (maintenance endpoint)
      if (path === '/api/nfc/cleanup' && method === 'POST') {
        const body = await request.json();
        const { uid, maxAge } = body;
        
        if (!uid) {
          return new Response(JSON.stringify({ error: 'Missing uid parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const cleanupResult = await cleanupOldDevices(uid, maxAge, env);
        
        return new Response(JSON.stringify(cleanupResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Default response for unknown routes
    return new Response(JSON.stringify({ error: 'Route not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error handling request:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Export the worker
export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
}; 