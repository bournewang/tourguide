#!/usr/bin/env node

// Azure TTS API Test Script
// This script helps diagnose Azure Speech API authentication issues

import fs from 'fs';

// Load environment variables from .dev.vars
function loadDevVars() {
  try {
    const content = fs.readFileSync('.dev.vars', 'utf8');
    const vars = {};
    content.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        vars[key.trim()] = value.trim();
      }
    });
    return vars;
  } catch (error) {
    console.error('❌ Error loading .dev.vars:', error.message);
    return {};
  }
}

// Test Azure TTS API
async function testAzureTTS() {
  const vars = loadDevVars();
  const apiKey = vars.AZURE_SPEECH_KEY;
  const region = vars.AZURE_SPEECH_REGION || 'eastus';
  
  console.log('🔍 Testing Azure TTS API Configuration');
  console.log('=====================================');
  console.log(`🔑 API Key: ${apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET'}`);
  console.log(`🌍 Region: ${region}`);
  console.log('');
  
  if (!apiKey) {
    console.error('❌ AZURE_SPEECH_KEY not found in .dev.vars');
    console.log('Please add your Azure Speech API key to .dev.vars:');
    console.log('AZURE_SPEECH_KEY=your_actual_key_here');
    return;
  }
  
  // Test SSML content
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
    <voice name="zh-CN-XiaoxiaoNeural">
      <prosody rate="-10%" pitch="0%">
        测试语音合成
      </prosody>
    </voice>
  </speak>`;
  
  console.log('🎤 Testing TTS API call...');
  
  try {
    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
        'User-Agent': 'TourGuide-Test'
      },
      body: ssml
    });
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📏 Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      const sizeKB = (audioBuffer.byteLength / 1024).toFixed(2);
      console.log(`✅ Success! Generated ${sizeKB}KB audio file`);
      console.log('🎉 Azure TTS API is working correctly!');
    } else {
      const errorText = await response.text();
      console.error(`❌ Error Response: ${errorText}`);
      
      // Common error diagnostics
      if (response.status === 401) {
        console.log('');
        console.log('🔧 401 Unauthorized - Possible Issues:');
        console.log('1. Invalid API key');
        console.log('2. API key expired');
        console.log('3. Wrong region specified');
        console.log('4. API key not activated for Speech Services');
        console.log('');
        console.log('💡 Solutions:');
        console.log('- Verify your API key in Azure Portal');
        console.log('- Check if the key is for Speech Services (not Cognitive Services)');
        console.log('- Ensure the region matches your Azure resource');
        console.log('- Try regenerating the API key');
      } else if (response.status === 403) {
        console.log('');
        console.log('🔧 403 Forbidden - Possible Issues:');
        console.log('1. API key lacks necessary permissions');
        console.log('2. Quota exceeded');
        console.log('3. Service not enabled');
      }
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message);
    console.log('');
    console.log('🔧 Network Issues - Possible Solutions:');
    console.log('1. Check internet connection');
    console.log('2. Verify region endpoint is correct');
    console.log('3. Check firewall settings');
  }
}

// Test region endpoints
async function testRegionEndpoints() {
  const vars = loadDevVars();
  const apiKey = vars.AZURE_SPEECH_KEY;
  
  if (!apiKey) return;
  
  console.log('\n🌍 Testing Different Region Endpoints');
  console.log('=====================================');
  
  const regions = ['eastus', 'westus', 'westus2', 'eastus2', 'southeastasia', 'westeurope'];
  
  for (const region of regions) {
    try {
      console.log(`Testing ${region}...`);
      const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
          'User-Agent': 'TourGuide-Test'
        },
        body: '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="zh-CN-XiaoxiaoNeural">测试</voice></speak>'
      });
      
      if (response.ok) {
        console.log(`✅ ${region}: Working!`);
        break;
      } else {
        console.log(`❌ ${region}: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${region}: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  await testAzureTTS();
  await testRegionEndpoints();
}

main().catch(console.error); 