#!/usr/bin/env node

// 立雪亭剧本语音生成示例
// 使用方法示例

console.log('🎭 立雪亭剧本语音生成示例');
console.log('');

// 示例1: 基本用法
console.log('示例1: 基本用法');
console.log('node generateNarration.js lixueting-script.json ./audio/lixueting/');
console.log('');

// 示例2: 自定义语速和停顿
console.log('示例2: 自定义语速和停顿');
console.log('node generateNarration.js --rate "-15%" --pause 1.5 lixueting-script.json ./audio/lixueting/');
console.log('');

// 示例3: 只生成片段，不合并
console.log('示例3: 只生成片段，不合并');
console.log('node generateNarration.js --no-combine lixueting-script.json ./audio/segments/');
console.log('');

// 示例4: 指定API密钥
console.log('示例4: 指定API密钥');
console.log('node generateNarration.js -k "your-api-key" lixueting-script.json ./audio/lixueting/');
console.log('');

console.log('💡 提示:');
console.log('1. 确保已设置环境变量 SPEECH_KEY 和 SPEECH_REGION');
console.log('2. 需要安装 ffmpeg 才能合并音频文件');
console.log('3. 音效行(voice: "sound_effect")会自动跳过');
console.log('4. 支持的语音角色: xiaoxiao, yunxi, yunjian, xiaoyi, xiaomo');
console.log('');

console.log('🎵 你的剧本包含以下角色:');
console.log('- 旁白 (xiaoxiao): 温柔女声');
console.log('- 神光 (yunxi): 温暖男声');
console.log('- 达摩/宝静/护法神 (yunjian): 稳重男声');
console.log('- 音效 (sound_effect): 自动跳过'); 