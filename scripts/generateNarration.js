#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { createHash } from 'crypto';
import process from 'process';
import { synthesizeSpeech } from './microsoftTTS.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || '';
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastus';
const DEFAULT_OUTPUT_FORMAT = 'audio-16khz-32kbitrate-mono-mp3';

// Voice mapping for characters
const VOICE_MAPPING = {
  'xiaoxiao': 'zh-CN-XiaoxiaoNeural',    // 旁白 - 女声，温柔
  'yunxi': 'zh-CN-YunxiNeural',          // 神光 - 男声，温暖
  'yunjian': 'zh-CN-YunjianNeural',      // 达摩/宝静/护法神 - 男声，稳重
  'xiaoyi': 'zh-CN-XiaoyiNeural',        // 备用女声
  'xiaomo': 'zh-CN-XiaomoNeural',        // 备用女声，成熟
};

function showUsage() {
  console.log(`
🎭 少林寺景点剧本语音生成工具

用法:
  node generateNarration.js [选项] <script.json> <output_dir>

参数:
  script.json    剧本JSON文件路径
  output_dir     输出目录路径

选项:
  -k, --key <key>         Azure Speech API密钥
  -g, --region <region>   Azure区域 (默认: eastus)
  --no-combine            不合并音频文件，只生成单独的片段
  --rate <rate>           语速调整 (默认: -10%)
  --pause <seconds>       段落间停顿时间 (默认: 1.0秒)
  --help                  显示帮助信息

示例:
  node generateNarration.js lixueting-script.json ./audio/lixueting/
  node generateNarration.js --rate "-15%" --pause 1.5 script.json ./output/
  node generateNarration.js --no-combine script.json ./segments/

环境变量:
  SPEECH_KEY     - Azure Speech API密钥
  SPEECH_REGION  - Azure区域

剧本格式:
  [
    {
      "character": "旁白",
      "voice": "xiaoxiao", 
      "line": "文本内容"
    },
    {
      "character": "音效",
      "voice": "sound_effect",
      "line": "音效描述"
    }
  ]

注意:
  - voice为"sound_effect"的行会被跳过
  - 最终会生成合并的完整音频文件
  - 支持多角色语音切换
`);
}

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    scriptFile: null,
    outputDir: null,
    key: AZURE_SPEECH_KEY,
    region: AZURE_SPEECH_REGION,
    combine: true,
    rate: '-10%',
    pause: 1.0
  };

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
      case '--no-combine':
        options.combine = false;
        break;
      case '--rate':
        if (i + 1 < args.length) {
          options.rate = args[++i];
        }
        break;
      case '--pause':
        if (i + 1 < args.length) {
          options.pause = parseFloat(args[++i]);
        }
        break;
      default:
        if (!arg.startsWith('-')) {
          if (!options.scriptFile) {
            options.scriptFile = arg;
          } else if (!options.outputDir) {
            options.outputDir = arg;
          }
        }
        break;
    }
  }

  return options;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 创建目录: ${dirPath}`);
  }
}

function loadScript(scriptPath) {
  try {
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    const script = JSON.parse(scriptContent);
    
    if (!Array.isArray(script)) {
      throw new Error('剧本文件必须是JSON数组格式');
    }
    
    console.log(`📖 加载剧本: ${scriptPath}`);
    console.log(`📝 共 ${script.length} 行对话`);
    
    return script;
  } catch (error) {
    throw new Error(`加载剧本失败: ${error.message}`);
  }
}

function validateScript(script) {
  const requiredFields = ['character', 'voice', 'line'];
  const errors = [];
  
  script.forEach((item, index) => {
    requiredFields.forEach(field => {
      if (!item[field]) {
        errors.push(`第 ${index + 1} 行缺少字段: ${field}`);
      }
    });
    
    if (item.voice && item.voice !== 'sound_effect' && !VOICE_MAPPING[item.voice]) {
      errors.push(`第 ${index + 1} 行未知语音: ${item.voice}`);
    }
  });
  
  if (errors.length > 0) {
    throw new Error('剧本验证失败:\n' + errors.join('\n'));
  }
  
  console.log('✅ 剧本格式验证通过');
}

function generateFileHash(voice, line) {
  const content = `${voice}:${line}`;
  return createHash('md5').update(content, 'utf8').digest('hex').substring(0, 8);
}

async function generateAudioSegment(item, index, options, outputDir) {
  if (item.voice === 'sound_effect') {
    console.log(`⏭️  跳过音效 ${index + 1}: ${item.line.slice(0, 30)}...`);
    return null;
  }
  
  const voice = VOICE_MAPPING[item.voice];
  const fileHash = generateFileHash(item.voice, item.line);
  const filename = `segment_${String(index + 1).padStart(3, '0')}_${item.character}-${fileHash}.mp3`;
  const outputPath = path.join(outputDir, filename);
  
  // Check if file already exists
  if (fs.existsSync(outputPath)) {
    console.log(`⏭️  跳过已存在 ${index + 1}/${item.character}: ${item.line.slice(0, 50)}...`);
    return outputPath;
  }
  
  const ttsOptions = {
    voice: voice,
    output: outputPath,
    rate: options.rate,
    pitch: '0%',
    key: options.key,
    region: options.region,
    text: item.line,
    file: null,
    play: false
  };
  
  try {
    console.log(`🎤 生成 ${index + 1}/${item.character}: ${item.line.slice(0, 50)}...`);
    await synthesizeSpeech(ttsOptions);
    return outputPath;
  } catch (error) {
    console.error(`❌ 生成失败 ${index + 1}: ${error.message}`);
    return null;
  }
}

function createSilence(duration, outputPath) {
  return new Promise((resolve, reject) => {
    // Generate silence using ffmpeg
    const command = `ffmpeg -f lavfi -i anullsrc=channel_layout=mono:sample_rate=16000 -t ${duration} -acodec mp3 -y "${outputPath}"`;
    
    exec(command, (error) => {
      if (error) {
        reject(new Error(`生成静音失败: ${error.message}`));
      } else {
        resolve(outputPath);
      }
    });
  });
}

function combineAudioFiles(audioFiles, outputPath, pauseDuration) {
  return new Promise((resolve, reject) => {
    console.log('🔗 合并音频文件...');
    
    // Create a temporary file list for ffmpeg
    const fileListPath = path.join(path.dirname(outputPath), 'filelist.txt');
    const silencePath = path.join(path.dirname(outputPath), 'silence.mp3');
    
    // Generate silence file
    createSilence(pauseDuration, silencePath)
      .then(() => {
        // Create file list with silence between segments
        const fileList = [];
        audioFiles.forEach((file, index) => {
          if (file) {
            fileList.push(`file '${path.resolve(file)}'`);
            if (index < audioFiles.length - 1) {
              fileList.push(`file '${path.resolve(silencePath)}'`);
            }
          }
        });
        
        fs.writeFileSync(fileListPath, fileList.join('\n'));
        
        // Use ffmpeg to concatenate files
        const command = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy -y "${outputPath}"`;
        
        exec(command, (error) => {
          // Clean up temporary files
          try {
            fs.unlinkSync(fileListPath);
            fs.unlinkSync(silencePath);
          } catch {
            console.warn('⚠️ 清理临时文件失败');
          }
          
          if (error) {
            reject(new Error(`合并音频失败: ${error.message}`));
          } else {
            console.log('✅ 音频合并完成');
            resolve(outputPath);
          }
        });
      })
      .catch(reject);
  });
}

async function generateNarration(options) {
  if (!options.key) {
    throw new Error('❌ Azure Speech API密钥未设置。请设置环境变量 SPEECH_KEY 或使用 -k 参数');
  }
  
  if (!options.scriptFile || !options.outputDir) {
    throw new Error('❌ 请指定剧本文件和输出目录');
  }
  
  // Load and validate script
  const script = loadScript(options.scriptFile);
  validateScript(script);
  
  // Ensure output directory exists
  ensureDirectoryExists(options.outputDir);
  
  // Generate audio segments
  console.log('\n🎭 开始生成语音片段...');
  const audioFiles = [];
  
  for (let i = 0; i < script.length; i++) {
    const audioPath = await generateAudioSegment(script[i], i, options, options.outputDir);
    audioFiles.push(audioPath);
    
    // Add small delay between requests to avoid rate limiting
    if (i < script.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Count successful generations and skipped files
  const successfulFiles = audioFiles.filter(file => file !== null);
  const totalLines = script.length;
  const soundEffectCount = script.filter(item => item.voice === 'sound_effect').length;
  const generatedCount = successfulFiles.length;
  const skippedExistingCount = script.filter((item, index) => {
    if (item.voice === 'sound_effect') return false;
    const fileHash = generateFileHash(item.voice, item.line);
    const filename = `segment_${String(index + 1).padStart(3, '0')}_${item.character}-${fileHash}.mp3`;
    const outputPath = path.join(options.outputDir, filename);
    return fs.existsSync(outputPath);
  }).length;
  
  console.log(`\n📊 生成统计:`);
  console.log(`📝 总行数: ${totalLines}`);
  console.log(`✅ 音频文件: ${generatedCount} 个`);
  console.log(`⏭️  跳过音效: ${soundEffectCount} 个`);
  if (skippedExistingCount > 0) {
    console.log(`🔄 跳过已存在: ${skippedExistingCount} 个`);
  }
  
  // Combine audio files if requested
  if (options.combine && successfulFiles.length > 0) {
    const scriptName = path.basename(options.scriptFile, '.json');
    const combinedPath = path.join(options.outputDir, `${scriptName}_complete.mp3`);
    
    try {
      await combineAudioFiles(audioFiles, combinedPath, options.pause);
      console.log(`🎵 完整音频: ${combinedPath}`);
      
      // Get file size
      const stats = fs.statSync(combinedPath);
      const fileSizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`📊 文件大小: ${fileSizeInMB} MB`);
    } catch (error) {
      console.error(`❌ 合并失败: ${error.message}`);
      console.log('💡 提示: 请确保已安装 ffmpeg');
    }
  }
  
  console.log('\n🎉 语音生成完成!');
}

// Main execution
async function main() {
  try {
    const options = parseArguments();
    
    if (process.argv.length < 4) {
      showUsage();
      process.exit(1);
    }
    
    await generateNarration(options);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateNarration, VOICE_MAPPING }; 