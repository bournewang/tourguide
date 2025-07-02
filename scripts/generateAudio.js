import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import speechSdk from 'microsoft-cognitiveservices-speech-sdk';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// You need to set these environment variables or replace with your actual values
const subscriptionKey = process.env.SPEECH_KEY || 'YOUR_SPEECH_KEY';
const serviceRegion = process.env.SPEECH_REGION || 'eastus';

if (subscriptionKey === 'YOUR_SPEECH_KEY') {
    console.error('❌ Please set your Azure Speech Services credentials!');
    console.log('Set environment variables:');
    console.log('export SPEECH_KEY="your-key"');
    console.log('export SPEECH_REGION="your-region"');
    process.exit(1);
}

async function generateAudioFiles() {
    try {
        // Load spots data
        const spotsDataPath = path.join(__dirname, '../src/shaolin.json');
        const spotsData = JSON.parse(fs.readFileSync(spotsDataPath, 'utf8'));
        
        // Create audio output directory if it doesn't exist
        const audioDir = path.join(__dirname, '../public/audio');
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }
        
        console.log(`🎵 Starting audio generation for ${spotsData.length} spots...`);
        
        const results = [];
        
        for (let index = 0; index < spotsData.length; index++) {
            const spot = spotsData[index];
            console.log(`\n📍 Processing spot ${index + 1}/${spotsData.length}: ${spot.name}`);
            
            try {
                // Configure speech synthesis
                const speechConfig = speechSdk.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
                speechConfig.speechSynthesisLanguage = 'zh-CN';
                speechConfig.speechSynthesisVoiceName = 'zh-CN-XiaoxiaoNeural';
                speechConfig.speechSynthesisOutputFormat = speechSdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
                
                // Create simple filename
                const filename = `spot_${String(index + 1).padStart(2, '0')}.mp3`;
                const filepath = path.join(audioDir, filename);
                
                // Create audio config
                const audioConfig = speechSdk.AudioConfig.fromAudioFileOutput(filepath);
                
                // Create synthesizer
                const synthesizer = new speechSdk.SpeechSynthesizer(speechConfig, audioConfig);
                
                // Generate speech
                await new Promise((resolve, reject) => {
                    synthesizer.speakTextAsync(
                        spot.audio_script,
                        result => {
                            if (result.reason === speechSdk.ResultReason.SynthesizingAudioCompleted) {
                                console.log(`✅ Audio generated: ${filename}`);
                                synthesizer.close();
                                resolve(result);
                            } else {
                                console.error(`❌ Speech synthesis failed for ${spot.name}:`, result.errorDetails);
                                synthesizer.close();
                                reject(new Error(result.errorDetails));
                            }
                        },
                        error => {
                            console.error(`❌ Speech synthesis error for ${spot.name}:`, error);
                            synthesizer.close();
                            reject(error);
                        }
                    );
                });
                
                // Add audioFile field to the spot data
                spot.audioFile = filename;
                
                results.push({
                    success: true,
                    filename: filename,
                    spotName: spot.name
                });
                
            } catch (error) {
                console.error(`❌ Error processing ${spot.name}:`, error.message);
                results.push({
                    success: false,
                    filename: null,
                    spotName: spot.name,
                    error: error.message
                });
            }
        }
        
        // Save updated spots data back to file
        fs.writeFileSync(spotsDataPath, JSON.stringify(spotsData, null, 2), 'utf8');
        console.log(`\n📄 Updated shaolin.json with audioFile fields`);
        
        // Print summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`\n📊 Generation Summary:`);
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        
        if (failed > 0) {
            console.log('\n❌ Failed files:');
            results.filter(r => !r.success).forEach(result => {
                console.log(`  - ${result.spotName}: ${result.error}`);
            });
        }
        
        console.log('\n📁 Generated audio files:');
        results.filter(r => r.success).forEach((result, index) => {
            console.log(`  ${result.filename} - ${result.spotName}`);
        });
        
    } catch (error) {
        console.error('❌ Fatal error during audio generation:', error);
        process.exit(1);
    }
}

// Run the script
generateAudioFiles().then(() => {
    console.log('\n🎉 Audio generation completed!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
}); 