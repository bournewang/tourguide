#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import os from 'os';
import process from 'process';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const AZURE_SPEECH_KEY = process.env.VITE_AZURE_SPEECH_KEY || process.env.AZURE_SPEECH_KEY || '';
const AZURE_SPEECH_REGION = process.env.VITE_AZURE_SPEECH_REGION || process.env.AZURE_SPEECH_REGION || 'eastus';

// Default settings
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_RATE = '0%';
const DEFAULT_PITCH = '0%';
const DEFAULT_OUTPUT_FORMAT = 'audio-16khz-32kbitrate-mono-mp3';

// Voice options
const VOICES = {
  'xiaoxiao': 'zh-CN-XiaoxiaoNeural',    // 晓晓 (女声，温柔)
  'yunxi': 'zh-CN-YunxiNeural',          // 云希 (男声，温暖)
  'xiaoyi': 'zh-CN-XiaoyiNeural',        // 晓伊 (女声，甜美)
  'yunjian': 'zh-CN-YunjianNeural',      // 云健 (男声，稳重)
  'xiaomo': 'zh-CN-XiaomoNeural',        // 晓墨 (女声，成熟)
  'xiaoxuan': 'zh-CN-XiaoxuanNeural',    // 晓萱 (女声，活泼)
  'xiaohan': 'zh-CN-XiaohanNeural',      // 晓涵 (女声，温和)
  'xiaorui': 'zh-CN-XiaoruiNeural',      // 晓睿 (女声，知性)
};

function showUsage() {
  console.log(`
🎤 Microsoft Azure TTS Command Line Tool

用法:
  node microsoftTTS.js [选项] "要转换的文本"
  node microsoftTTS.js [选项] --file input.txt

选项:
  -v, --voice <voice>     语音选择 (默认: xiaoxiao)
  -o, --output <file>     输出文件名 (默认: output.mp3)
  -r, --rate <rate>       语速调整 (-50% 到 +200%, 默认: 0%)
  -p, --pitch <pitch>     音调调整 (-50% 到 +50%, 默认: 0%)
  -f, --file <file>       从文件读取文本
  -k, --key <key>         Azure Speech API密钥
  -g, --region <region>   Azure区域 (默认: eastus)
  --play                  直接播放音频，不保存文件
  --list-voices           列出可用语音
  --help                  显示帮助信息

可用语音:
  xiaoxiao - 晓晓 (女声，温柔) [默认]
  yunxi    - 云希 (男声，温暖)
  xiaoyi   - 晓伊 (女声，甜美)
  yunjian  - 云健 (男声，稳重)
  xiaomo   - 晓墨 (女声，成熟)
  xiaoxuan - 晓萱 (女声，活泼)
  xiaohan  - 晓涵 (女声，温和)
  xiaorui  - 晓睿 (女声，知性)

环境变量:
  AZURE_SPEECH_KEY     - Azure Speech API密钥
  AZURE_SPEECH_REGION  - Azure区域

示例:
  node microsoftTTS.js "欢迎来到少林寺"
  node microsoftTTS.js -v yunxi -o welcome.mp3 "欢迎来到少林寺"
  node microsoftTTS.js -v xiaoxiao -r "+20%" -p "+10%" "欢迎来到少林寺"
  node microsoftTTS.js --file script.txt -o narration.mp3
  node microsoftTTS.js --play "直接播放这段文字"
  
环境变量设置:
  export AZURE_SPEECH_KEY="your_api_key_here"
  export AZURE_SPEECH_REGION="eastus"
`);
}

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    voice: DEFAULT_VOICE,
    output: 'output.mp3',
    rate: DEFAULT_RATE,
    pitch: DEFAULT_PITCH,
    key: AZURE_SPEECH_KEY,
    region: AZURE_SPEECH_REGION,
    text: '',
    file: null,
    play: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
        showUsage();
        process.exit(0);
        break;
      case '--list-voices':
        console.log('\n🎵 可用语音列表:');
        Object.entries(VOICES).forEach(([key, value]) => {
          console.log(`  ${key.padEnd(10)} - ${value}`);
        });
        process.exit(0);
        break;
      case '-v':
      case '--voice':
        if (i + 1 < args.length) {
          const voiceKey = args[++i];
          options.voice = VOICES[voiceKey] || voiceKey;
        }
        break;
      case '-o':
      case '--output':
        if (i + 1 < args.length) {
          options.output = args[++i];
        }
        break;
      case '-r':
      case '--rate':
        if (i + 1 < args.length) {
          options.rate = args[++i];
        }
        break;
      case '-p':
      case '--pitch':
        if (i + 1 < args.length) {
          options.pitch = args[++i];
        }
        break;
      case '-f':
      case '--file':
        if (i + 1 < args.length) {
          options.file = args[++i];
        }
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
      case '--play':
        options.play = true;
        options.output = null; // Don't save to file when playing
        break;
      default:
        if (!arg.startsWith('-') && !options.text) {
          options.text = arg;
        }
        break;
    }
  }

  return options;
}

function generateSSML(text, voice, rate, pitch) {
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
    <voice name="${voice}">
      <prosody rate="${rate}" pitch="${pitch}">
        ${text}
      </prosody>
    </voice>
  </speak>`;
}

function playAudio(audioBuffer) {
  return new Promise((resolve, reject) => {
    // Create a temporary file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `tts_temp_${Date.now()}.mp3`);
    
    // Write audio buffer to temp file
    fs.writeFileSync(tempFile, audioBuffer);
    
    // Determine the appropriate audio player command based on OS
    let command;
    const platform = os.platform();
    
    if (platform === 'darwin') {
      // macOS
      command = `afplay "${tempFile}"`;
    } else if (platform === 'win32') {
      // Windows
      command = `powershell -c "(New-Object Media.SoundPlayer '${tempFile}').PlaySync()"`;
    } else {
      // Linux
      command = `aplay "${tempFile}" || paplay "${tempFile}" || mpg123 "${tempFile}"`;
    }
    
    console.log('🔊 正在播放音频...');
    
    exec(command, (error) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
      }
      
      if (error) {
        reject(new Error(`❌ 播放失败: ${error.message}`));
      } else {
        console.log('✅ 播放完成');
        resolve();
      }
    });
  });
}

function synthesizeSpeech(options) {
  return new Promise((resolve, reject) => {
    if (!options.key) {
      reject(new Error('❌ Azure Speech API密钥未设置。请设置环境变量 AZURE_SPEECH_KEY 或使用 -k 参数'));
      return;
    }

    let text = options.text;
    
    // Read from file if specified
    if (options.file) {
      try {
        text = fs.readFileSync(options.file, 'utf8');
        console.log(`📖 从文件读取文本: ${options.file}`);
      } catch (error) {
        reject(new Error(`❌ 无法读取文件: ${error.message}`));
        return;
      }
    }

    if (!text.trim()) {
      reject(new Error('❌ 没有要转换的文本'));
      return;
    }

    const ssml = generateSSML(text, options.voice, options.rate, options.pitch);
    
    const postData = ssml;
    const hostname = `${options.region}.tts.speech.microsoft.com`;
    const path = '/cognitiveservices/v1';
    
    const requestOptions = {
      hostname: hostname,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': options.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': DEFAULT_OUTPUT_FORMAT,
        'User-Agent': 'TourGuide-TTS-Tool'
      }
    };

    console.log(`🎤 正在合成语音...`);
    console.log(`📝 文本: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    console.log(`🎵 语音: ${options.voice}`);
    console.log(`⚡ 语速: ${options.rate}`);
    console.log(`🎶 音调: ${options.pitch}`);
    console.log(`💾 输出: ${options.output}`);

    const req = https.request(requestOptions, (res) => {
      if (res.statusCode === 200) {
        if (options.play) {
          // Collect audio data for direct playback
          const audioChunks = [];
          res.on('data', (chunk) => {
            audioChunks.push(chunk);
          });
          
          res.on('end', async () => {
            try {
              const audioBuffer = Buffer.concat(audioChunks);
              const fileSizeInKB = (audioBuffer.length / 1024).toFixed(2);
              
              console.log(`✅ 语音合成完成`);
              console.log(`📊 音频大小: ${fileSizeInKB} KB`);
              console.log(`⏱️  文本长度: ${text.length} 字符`);
              
              await playAudio(audioBuffer);
              resolve('播放完成');
            } catch (playError) {
              reject(playError);
            }
          });
        } else {
          // Save to file
          const writeStream = fs.createWriteStream(options.output);
          res.pipe(writeStream);
          
          writeStream.on('finish', () => {
            console.log(`✅ 语音合成完成: ${options.output}`);
            
            // Get file size
            const stats = fs.statSync(options.output);
            const fileSizeInBytes = stats.size;
            const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);
            
            console.log(`📊 文件大小: ${fileSizeInKB} KB`);
            console.log(`⏱️  文本长度: ${text.length} 字符`);
            
            resolve(options.output);
          });
          
          writeStream.on('error', (error) => {
            reject(new Error(`❌ 写入文件失败: ${error.message}`));
          });
        }
      } else {
        let errorData = '';
        res.on('data', (chunk) => {
          errorData += chunk;
        });
        res.on('end', () => {
          reject(new Error(`❌ API请求失败 (${res.statusCode}): ${errorData}`));
        });
      }
    });

    req.on('error', (error) => {
      reject(new Error(`❌ 网络请求失败: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// Main execution
async function main() {
  try {
    const options = parseArguments();
    
    if (process.argv.length < 3) {
      showUsage();
      process.exit(1);
    }

    await synthesizeSpeech(options);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { synthesizeSpeech, generateSSML, VOICES };
