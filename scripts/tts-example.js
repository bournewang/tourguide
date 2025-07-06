// Example usage of Microsoft TTS script
// Run this after setting up your Azure Speech API key

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Example texts for tour guide
var examples = [
  {
    text: "欢迎来到少林寺，这里是中国佛教禅宗的发源地。",
    voice: "xiaoxiao",
    output: "welcome.mp3"
  },
  {
    text: "这里是大雄宝殿，是少林寺的主要建筑，供奉着释迦牟尼佛。",
    voice: "yunxi", 
    output: "daxiongbaodian.mp3"
  },
  {
    text: "塔林是少林寺历代高僧的墓地，现存古塔两百多座。",
    voice: "xiaoyi",
    output: "talin.mp3"
  }
];

function runTTSExample(example, callback) {
  var scriptPath = path.join(__dirname, 'microsoftTTS.js');
  var command = 'node "' + scriptPath + '" -v ' + example.voice + ' -o "' + example.output + '" "' + example.text + '"';
  
  console.log('执行命令:', command);
  
  exec(command, function(error, stdout, stderr) {
    if (error) {
      console.error('错误:', error);
      return callback(error);
    }
    
    console.log('输出:', stdout);
    if (stderr) {
      console.error('警告:', stderr);
    }
    
    callback(null, example.output);
  });
}

// Run examples
function runAllExamples() {
  console.log('🎤 Microsoft TTS 示例脚本');
  console.log('请确保已设置环境变量 SPEECH_KEY 和 SPEECH_REGION\n');
  
  var currentIndex = 0;
  
  function runNext() {
    if (currentIndex >= examples.length) {
      console.log('✅ 所有示例完成！');
      return;
    }
    
    var example = examples[currentIndex];
    console.log('\n📝 示例 ' + (currentIndex + 1) + ':');
    console.log('文本:', example.text);
    console.log('语音:', example.voice);
    console.log('输出:', example.output);
    
    runTTSExample(example, function(error, output) {
      if (error) {
        console.error('❌ 示例失败:', error.message);
      } else {
        console.log('✅ 生成完成:', output);
      }
      
      currentIndex++;
      setTimeout(runNext, 1000); // Wait 1 second between requests
    });
  }
  
  runNext();
}

// Check if API key is set
if (!process.env.SPEECH_KEY) {
  console.log('❌ 请先设置 Azure Speech API 密钥:');
  console.log('export SPEECH_KEY="your_api_key_here"');
  console.log('export SPEECH_REGION="eastus"');
  console.log('');
  console.log('然后运行: node tts-example.js');
  process.exit(1);
}

// Run examples
runAllExamples(); 