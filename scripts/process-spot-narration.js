#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import { Buffer } from 'buffer';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || '';
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastus';
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';

// Default settings
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_RATE = '-10%';
const DEFAULT_OUTPUT_FORMAT = 'audio-16khz-32kbitrate-mono-mp3';

// Voice mapping
const VOICE_MAPPING = {
  'xiaoxiao': 'zh-CN-XiaoxiaoNeural',    // 旁白 - 女声，温柔
  'yunxi': 'zh-CN-YunxiNeural',          // 男声，温暖
  'yunjian': 'zh-CN-YunjianNeural',      // 男声，稳重
  'xiaoyi': 'zh-CN-XiaoyiNeural',        // 女声，甜美
  'xiaomo': 'zh-CN-XiaomoNeural',        // 女声，成熟
};

function showUsage() {
  console.log(`
🎭 景点解说词生成与音频制作工具

用法:
  node process-spot-narration.js [选项] <spots_file> <output_dir>

参数:
  spots_file    景点数据JSON文件路径 (如: public/data/spots/shaolinsi.json)
  output_dir    输出目录路径 (如: ./public/assets/audio/少林寺/)

选项:
  -k, --key <key>         Azure Speech API密钥
  -g, --region <region>   Azure区域 (默认: eastus)
  -o, --openai <key>      Aliyun AI (DashScope) API密钥
  -v, --voice <voice>     语音选择 (默认: xiaoxiao)
  -r, --rate <rate>       语速调整 (默认: -10%)
  -d, --duration <min>    目标时长分钟数 (默认: 1-2分钟)
  --area-name <name>      指定景区名称（可用于AI提示词）
  --skip-existing         跳过已存在的音频文件
  --dry-run               仅生成文本，不生成音频
  --ai-provider <aliyun|openai>  选择AI提供商 (默认: aliyun)
  --overwrite-existing    覆盖已存在的音频文件，并增加版本号
  --force-regenerate      强制重新生成解说词，即使已存在
  --help                  显示帮助信息

示例:
  node process-spot-narration.js public/data/spots/shaolinsi.json ./public/assets/audio/少林寺/
  node process-spot-narration.js --ai-provider openai public/data/spots/shaolinsi.json ./public/assets/audio/嵩山/
  node process-spot-narration.js --dry-run public/data/spots/shaolinsi.json ./public/assets/audio/少林寺/
  node process-spot-narration.js --force-regenerate public/data/spots/shaolinsi.json ./public/assets/audio/少林寺/
  node process-spot-narration.js --area-name "嵩山少林寺" public/data/spots/shaolinsi.json ./public/assets/audio/少林寺/

环境变量:
  AZURE_SPEECH_KEY     - Azure Speech API密钥
  AZURE_SPEECH_REGION  - Azure区域
  DASHSCOPE_API_KEY    - Aliyun AI (DashScope) API密钥
  OPENAI_API_KEY       - OpenAI API密钥
`);
}

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    spotsFile: null,
    outputDir: null,
    key: AZURE_SPEECH_KEY,
    region: AZURE_SPEECH_REGION,
    openaiKey: DASHSCOPE_API_KEY,
    voice: 'xiaoxiao',
    rate: DEFAULT_RATE,
    duration: '1-2',
    skipExisting: false,
    dryRun: false,
    overwriteExisting: false,
    forceRegenerate: false,
    aiProvider: 'aliyun',
    areaName: null
  };

  let positionalCount = 0;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--help':
        showUsage();
        process.exit(0);
        break;
      case '-k':
      case '--key':
        if (i + 1 < args.length) {
          options.key = args[++i];
        }
        break;
      case '-g':
      case '--region':
        if (i + 1 < args.length) {
          options.region = args[++i];
        }
        break;
      case '-o':
      case '--openai':
        if (i + 1 < args.length) {
          options.openaiKey = args[++i];
        }
        break;
      case '-v':
      case '--voice':
        if (i + 1 < args.length) {
          options.voice = args[++i];
        }
        break;
      case '-r':
      case '--rate':
        if (i + 1 < args.length) {
          options.rate = args[++i];
        }
        break;
      case '-d':
      case '--duration':
        if (i + 1 < args.length) {
          options.duration = args[++i];
        }
        break;
      case '--area-name':
        if (i + 1 < args.length) {
          options.areaName = args[++i];
        }
        break;
      case '--skip-existing':
        options.skipExisting = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--overwrite-existing':
        options.overwriteExisting = true;
        break;
      case '--force-regenerate':
        options.forceRegenerate = true;
        break;
      case '--ai-provider':
        if (i + 1 < args.length) {
          options.aiProvider = args[++i];
        }
        break;
      default:
        if (!arg.startsWith('-')) {
          if (positionalCount === 0) {
            options.spotsFile = arg;
          } else if (positionalCount === 1) {
            options.outputDir = arg;
          }
          positionalCount++;
        }
        break;
    }
  }

  // If areaName is not provided, infer from spotsFile
  if (!options.areaName && options.spotsFile) {
    const fileName = path.basename(options.spotsFile, '.json');
    options.areaName = fileName;
  }

  return options;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 创建目录: ${dirPath}`);
  }
}

function loadSpotsData(spotsFile) {
  try {
    const data = fs.readFileSync(spotsFile, 'utf8');
    const parsed = JSON.parse(data);
    
    let spots;
    if (Array.isArray(parsed)) {
      // Direct array format
      spots = parsed;
    } else if (parsed.results && Array.isArray(parsed.results)) {
      // Metadata + results format
      spots = parsed.results;
      console.log(`📊 文件信息: 搜索类型=${parsed.searchType}, 总数=${parsed.total}, 已获取=${parsed.fetched}`);
    } else {
      throw new Error('景点文件格式不支持，需要是数组或包含results数组的对象');
    }
    
    console.log(`📖 加载景点数据: ${spotsFile}`);
    console.log(`📍 共 ${spots.length} 个景点`);
    
    return spots;
  } catch (error) {
    throw new Error(`加载景点数据失败: ${error.message}`);
  }
}

function validateOptions(options) {
  const errors = [];
  if (!options.spotsFile) {
    errors.push('必须指定景点数据文件路径');
  }
  if (!options.outputDir) {
    errors.push('必须指定输出目录路径');
  }
  if (!options.openaiKey && options.aiProvider === 'aliyun') {
    errors.push('必须设置 Aliyun AI (DashScope) API 密钥 (使用 -o 参数或 DASHSCOPE_API_KEY 环境变量)');
  }
  if (!options.dryRun && !options.key) {
    errors.push('必须设置 Azure Speech API 密钥 (使用 -k 参数或 AZURE_SPEECH_KEY 环境变量)');
  }
  if (!VOICE_MAPPING[options.voice]) {
    errors.push(`未知的语音类型: ${options.voice}`);
  }
  if (errors.length > 0) {
    throw new Error('参数验证失败:\n' + errors.join('\n'));
  }
  console.log('✅ 参数验证通过');
}

async function generateNarrationWithAI(spot, options) {
  const prompt = `请为以下景点生成一段${options.duration}分钟内的解说词。
  要求：\n1. 适合旅游解说，口语化，减少机器味；\n
  2. 如果有名人题字，如匾额、对联，要说出来，但一定要采用真实数据，不可杜撰、编造；\n
  3. 如果真实性无法确定，则不要采用该语料；\n
  5. 长度控制在${options.duration}分钟内；\n
  6. 人已在景点前，不要说“xxx坐落于/位于xxx，现在我们来到xxx，”；\n\n
  景点名称：${options.areaName} ${spot.name} \n
  请直接返回解说词文本，不要包含任何格式标记或额外说明。`;

  let baseUrl, model, apiKey, authHeader, extraHeaders = {};
  if (options.aiProvider === 'aliyun') {
    baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    model = 'qwen-plus';
    apiKey = process.env.DASHSCOPE_API_KEY;
    authHeader = `Bearer ${apiKey}`;
  } else if (options.aiProvider === 'openai') {
    baseUrl = 'https://ai-gateway-intl.eo-edgefunctions7.com/v1/chat/completions';
    model = 'gpt-4o';
    apiKey = process.env.OPENAI_API_KEY;
    authHeader = `Bearer ${apiKey}`;
    extraHeaders = {
      'OE-Key': 'b2bad796a05c4a6dae545936b01eb664',
      'OE-Gateway-Name': 'narrationAI',
      'OE-AI-Provider': 'openai'
    };
  } else {
    throw new Error('未知的 AI 提供商');
  }

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        ...extraHeaders
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: '你是一位专业的旅游解说员，擅长为景点创作生动有趣的解说词。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`${options.aiProvider} API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const narration = data.choices[0].message.content.trim();

    console.log(`✅ 生成解说词: ${spot.name} (${narration.length} 字符)`);
    return narration;

  } catch (error) {
    console.error(`❌ 生成解说词失败 (${spot.name}):`, error.message);
    throw error;
  }
}

function generateSSML(text, voice, rate) {
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
    <voice name="${voice}">
      <prosody rate="${rate}">
        ${text}
      </prosody>
    </voice>
  </speak>`;
}

function synthesizeSpeech(text, voice, rate, key, region) {
  return new Promise((resolve, reject) => {
    if (!key) {
      reject(new Error('❌ Azure Speech API密钥未设置'));
      return;
    }

    const ssml = generateSSML(text, voice, rate);
    const hostname = `${region}.tts.speech.microsoft.com`;
    const path = '/cognitiveservices/v1';
    
    const requestOptions = {
      hostname: hostname,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
        'User-Agent': 'TourGuide-TTS'
      }
    };

    const req = https.request(requestOptions, (res) => {
      if (res.statusCode === 200) {
        const audioChunks = [];
        res.on('data', (chunk) => {
          audioChunks.push(chunk);
        });
        
        res.on('end', () => {
          const audioBuffer = Buffer.concat(audioChunks);
          resolve(audioBuffer);
        });
      } else {
        let errorData = '';
        res.on('data', (chunk) => {
          errorData += chunk;
        });
        res.on('end', () => {
          reject(new Error(`❌ Azure TTS 请求失败 (${res.statusCode}): ${errorData}`));
        });
      }
    });

    req.on('error', (error) => {
      reject(new Error(`❌ 网络请求失败: ${error.message}`));
    });

    req.write(ssml);
    req.end();
  });
}



async function processSpot(spot, options) {
  let version = 1;
  let audioFileName;
  let audioFile;
  let audioPath;
  const safeName = spot.name.replace(/[^-\u007F\u4e00-\u9fff]/g, '_');
  // If overwriting and audioFile exists, increment version
  if (options.overwriteExisting && spot.audioFile) {
    // Try to extract version from previous audioFile
    const match = spot.audioFile.match(/-(\d+)\.mp3$/);
    if (match) {
      version = parseInt(match[1], 10) + 1;
    } else {
      version = spot.version ? spot.version + 1 : 2;
    }
    audioFileName = `${safeName}-${version}.mp3`;
  } else {
    audioFileName = `${safeName}.mp3`;
  }
  audioFile = path.join(options.outputDir, audioFileName);
  // Compute the relative path from the public directory
  const relPath = path.relative(path.resolve(__dirname, '../public'), audioFile);
  audioPath = '/' + relPath.replace(/\\/g, '/');
  // Check if files already exist
  if (!options.overwriteExisting && options.skipExisting && fs.existsSync(audioFile)) {
    console.log(`⏭️  跳过已存在的文件: ${safeName}`);
    return { spot, updated: false };
  }
  try {
    // Generate narration text
    console.log(`🎯 处理景点: ${spot.name}`);
    let narration = await generateNarrationWithAI(spot, options);
    // Ensure audio directory exists
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
      console.log(`📁 创建音频目录: ${options.outputDir}`);
    }
    if (options.dryRun) {
      console.log(`✅ 仅生成文本完成: ${spot.name}`);
      return {
        spot: { ...spot, description: narration },
        updated: true
      };
    }
    // Generate audio
    const voice = VOICE_MAPPING[options.voice];
    const audioBuffer = await synthesizeSpeech(narration, voice, options.rate, options.key, options.region);
    // Save audio file
    fs.writeFileSync(audioFile, audioBuffer);
    console.log(`🎵 保存音频: ${audioFile}`);
    // Update spot with new description, audio file path, and version if needed
    const updatedSpot = {
      ...spot,
      description: narration,
      audioFile: audioPath
    };
    if (options.overwriteExisting && spot.audioFile) {
      updatedSpot.version = version;
    }
    console.log(`✅ 处理完成: ${spot.name}`);
    return { spot: updatedSpot, updated: true };
  } catch (error) {
    console.error(`❌ 处理失败 (${spot.name}):`, error.message);
    throw error;
  }
}

async function processSpots(options) {
  console.log('🎭 开始处理景点解说词生成与音频制作...');
  console.log(`📁 景点文件: ${options.spotsFile}`);
  console.log(`📁 输出目录: ${options.outputDir}`);
  console.log(`🎤 语音类型: ${options.voice}`);
  console.log(`⏱️  目标时长: ${options.duration} 分钟`);
  if (options.dryRun) {
    console.log('🔍 仅生成文本模式');
  }
  // Load spots data
  let originalData = JSON.parse(fs.readFileSync(options.spotsFile, 'utf8'));
  let spots = loadSpotsData(options.spotsFile);
  // Get scenic area name from file path
  const fileName = path.basename(options.spotsFile, '.json');
  console.log(`🏞️  景区名称: ${fileName}`);
  console.log(`📍 共 ${spots.length} 个景点`);
  // Ensure output directory exists
  ensureDirectoryExists(options.outputDir);
  let successCount = 0;
  let errorCount = 0;
  // Process each spot
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    // Skip if already has description or audioFile, unless forceRegenerate or overwriteExisting is set
    if (!options.forceRegenerate && !options.overwriteExisting && ((spot.description && spot.description.trim()) || (spot.audioFile && spot.audioFile.trim()))) {
      console.log(`⏭️  已有解说词或音频，跳过: ${spot.name}`);
      continue;
    }
    try {
      const result = await processSpot(spot, options);
      spots[i] = result.spot;
      // Update the original data structure
      if (Array.isArray(originalData)) {
        originalData[i] = result.spot;
      } else if (originalData.results && Array.isArray(originalData.results)) {
        originalData.results[i] = result.spot;
      }
      // Write back to file after each spot
      fs.writeFileSync(options.spotsFile, JSON.stringify(originalData, null, 2), 'utf8');
      if (result.updated) {
        successCount++;
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ 处理景点失败: ${spot.name}`, error.message);
      // Still update the file to record progress
      if (Array.isArray(originalData)) {
        originalData[i] = spot;
      } else if (originalData.results && Array.isArray(originalData.results)) {
        originalData.results[i] = spot;
      }
      fs.writeFileSync(options.spotsFile, JSON.stringify(originalData, null, 2), 'utf8');
    }
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log('\n📊 处理完成统计:');
  console.log(`✅ 成功处理: ${successCount} 个景点`);
  if (errorCount > 0) {
    console.log(`❌ 处理失败: ${errorCount} 个景点`);
  }
  console.log(`📁 音频输出目录: ${options.outputDir}`);
  console.log(` 已更新景点文件: ${options.spotsFile}`);
}

async function main() {
  try {
    const options = parseArguments();
    validateOptions(options);
    await processSpots(options);
  } catch (error) {
    console.error('❌ 程序执行失败:', error.message);
    process.exit(1);
  }
}

// Run the script
main(); 