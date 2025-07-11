#!/bin/bash

# Setup script for local development environment

echo "🚀 Setting up TourGuide Cloudflare Worker for local development"
echo ""

# Check if .dev.vars exists
if [ ! -f ".dev.vars" ]; then
    echo "❌ .dev.vars file not found!"
    echo "Please create .dev.vars file with your API keys:"
    echo ""
    echo "AZURE_SPEECH_KEY=your_azure_speech_key_here"
    echo "DASHSCOPE_API_KEY=your_dashscope_api_key_here"
    echo ""
    exit 1
fi

# Check if API keys are set
if grep -q "your_azure_speech_key_here" .dev.vars; then
    echo "⚠️  Please update AZURE_SPEECH_KEY in .dev.vars file"
    echo "Replace 'your_azure_speech_key_here' with your actual Azure Speech API key"
    echo ""
fi

if grep -q "your_dashscope_api_key_here" .dev.vars; then
    echo "⚠️  Please update DASHSCOPE_API_KEY in .dev.vars file"
    echo "Replace 'your_dashscope_api_key_here' with your actual Dashscope API key"
    echo ""
fi

# Check if both keys are properly set
if ! grep -q "your_azure_speech_key_here" .dev.vars && ! grep -q "your_dashscope_api_key_here" .dev.vars; then
    echo "✅ API keys appear to be configured in .dev.vars"
    echo ""
    echo "🔧 Starting local development server..."
    echo "Run: npm run dev"
    echo ""
    echo "📝 Test endpoints:"
    echo "  - POST http://localhost:8787/api/narration"
    echo "  - POST http://localhost:8787/api/tts"
    echo "  - GET  http://localhost:8787/api/scenic-areas"
    echo ""
else
    echo "❌ Please update the API keys in .dev.vars before running the worker"
    echo ""
    echo "Steps:"
    echo "1. Edit .dev.vars file"
    echo "2. Replace placeholder values with actual API keys"
    echo "3. Run: npm run dev"
    echo ""
fi 