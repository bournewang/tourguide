# Audio Generation Setup Guide

This guide will help you generate high-quality audio files for each tourist spot using Microsoft Cognitive Services Speech SDK.

## Prerequisites

1. **Azure Speech Services Account**
   - Sign up for Azure: https://azure.microsoft.com/
   - Create a Speech Services resource
   - Get your Speech Services key and region

## Setup Steps

### 1. Set Environment Variables

You need to set your Azure Speech Services credentials:

```bash
# Replace with your actual Speech Services key
export SPEECH_KEY="your-speech-services-key-here"

# Replace with your Speech Services region (e.g., eastus, westus2, etc.)
export SPEECH_REGION="eastus"
```

**For Windows (Command Prompt):**
```cmd
set SPEECH_KEY=your-speech-services-key-here
set SPEECH_REGION=eastus
```

**For Windows (PowerShell):**
```powershell
$env:SPEECH_KEY="your-speech-services-key-here"
$env:SPEECH_REGION="eastus"
```

### 2. Generate Audio Files

Run the audio generation script:

```bash
npm run generate-audio
```

This will:
- Generate MP3 files for each spot's narration
- Save files to `public/audio/` directory
- Add `audioFile` field directly to each spot in `shaolin.json`
- Use high-quality Chinese neural voices

### 3. Voice Options

The script uses `zh-CN-XiaoxiaoNeural` (female voice) by default. You can modify the script to use other voices:

- `zh-CN-XiaoxiaoNeural` - Female, warm and friendly
- `zh-CN-YunxiNeural` - Male, calm and professional
- `zh-CN-YunyangNeural` - Male, young and energetic
- `zh-CN-XiaochenNeural` - Female, gentle and clear

### 4. Output

After successful generation, you'll have:
- Audio files in `public/audio/spot_01.mp3`, `spot_02.mp3`, etc.
- Updated `shaolin.json` with `audioFile` field for each spot

## Troubleshooting

### Common Issues:

1. **"SPEECH_KEY is not set" error**
   - Make sure you've set the environment variables correctly
   - Restart your terminal after setting them

2. **"Subscription key is invalid" error**
   - Check your Azure Speech Services key
   - Verify your region is correct

3. **Network errors**
   - Check your internet connection
   - Verify Azure service status

4. **Rate limiting**
   - The script includes delays between requests
   - If you hit limits, wait and try again

### Getting Azure Speech Services Key:

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new "Speech Services" resource
3. Go to "Keys and Endpoint" section
4. Copy "Key 1" and "Region"

## Cost Information

- Azure Speech Services pricing: ~$4 per 1 million characters
- Your 14 spots (~500 characters each) = ~7,000 characters
- Estimated cost: Less than $0.03 total

## Next Steps

Once audio files are generated, the app will automatically use them instead of browser text-to-speech for much better quality narration. 