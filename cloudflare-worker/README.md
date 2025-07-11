# TourGuide Cloudflare Worker Backend

This Cloudflare Worker provides a comprehensive backend API for the TourGuide project, handling:

- 🎤 TTS (Text-to-Speech) generation using Azure Speech API
- 🤖 AI narration generation using QWen API
- 📁 Audio file storage in Cloudflare R2
- 💾 Spot data management in Cloudflare KV
- 🌐 CORS-enabled API endpoints

## 🚀 Quick Setup

### 1. Prerequisites

- Node.js 18+ installed
- Cloudflare account with Workers enabled
- Azure Speech Services API key
- QWen (Dashscope) API key

### 2. Install Dependencies

```bash
cd cloudflare-worker
npm install
```

### 3. Configure Cloudflare Resources

#### Create R2 Bucket
```bash
wrangler r2 bucket create tourguide-audio
wrangler r2 bucket create tourguide-audio-preview
```

#### Create KV Namespace
```bash
wrangler kv:namespace create "SPOT_DATA"
wrangler kv:namespace create "SPOT_DATA" --preview
```

Update the KV namespace IDs in `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "SPOT_DATA"
id = "your-actual-kv-namespace-id"
preview_id = "your-actual-preview-kv-namespace-id"
```

### 4. Set Environment Variables

```bash
# Set API keys as secrets
wrangler secret put AZURE_SPEECH_KEY
wrangler secret put DASHSCOPE_API_KEY

# Azure region is set in wrangler.toml (default: eastus)
```

### 5. Deploy

```bash
npm run deploy
```

## 📋 API Endpoints

### TTS Generation
```http
POST /api/tts
Content-Type: application/json

{
  "text": "欢迎来到少林寺",
  "voice": "xiaoxiao",
  "rate": "-10%",
  "pitch": "0%",
  "spotName": "少林寺",
  "areaName": "嵩山少林寺"
}
```

### AI Narration Generation
```http
POST /api/narration
Content-Type: application/json

{
  "spotInfo": {
    "name": "少林寺",
    "address": "河南省登封市",
    "description": "现有描述..."
  }
}
```

### Audio File Access
```http
GET /api/audio/{filename}
```

### Spot Data Management
```http
GET /api/spots?area={areaName}
POST /api/spots
PUT /api/spot
```

### Scenic Areas Management
```http
GET /api/scenic-areas
POST /api/scenic-areas
```

## 🔧 Development

### Local Development
```bash
npm run dev
```

### View Logs
```bash
npm run tail
```

### Test Deployment
```bash
npm run test
```

## 🎵 Supported Voices

- `xiaoxiao` - 晓晓 (女声，温柔) [默认]
- `yunxi` - 云希 (男声，温暖)
- `xiaoyi` - 晓伊 (女声，甜美)
- `yunjian` - 云健 (男声，稳重)
- `xiaomo` - 晓墨 (女声，成熟)
- `xiaoxuan` - 晓萱 (女声，活泼)
- `xiaohan` - 晓涵 (女声，温和)
- `xiaorui` - 晓睿 (女声，知性)

## 🔒 Security

- All API keys are stored as Cloudflare secrets
- CORS is properly configured
- Input validation on all endpoints
- Error handling with appropriate HTTP status codes

## 📊 Storage

- **Audio Files**: Stored in Cloudflare R2 with 1-year cache
- **Spot Data**: Stored in Cloudflare KV for fast global access
- **File Naming**: Uses Chinese spot names (e.g., `少林寺.mp3`)

## 🌐 Frontend Integration

Update your frontend to use the worker URL:

```javascript
// Replace local API calls with worker URL
const API_BASE = 'https://your-worker.your-subdomain.workers.dev';

// Example TTS call
const response = await fetch(`${API_BASE}/api/tts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: narrationText,
    voice: 'xiaoxiao',
    rate: '-10%',
    spotName: selectedSpot.name,
    areaName: selectedArea.name
  })
});
```

## 🚨 Troubleshooting

### Common Issues

1. **KV Namespace ID not found**
   - Run `wrangler kv:namespace list` to get correct IDs
   - Update `wrangler.toml` with actual IDs

2. **R2 Bucket access denied**
   - Ensure buckets are created: `wrangler r2 bucket list`
   - Check bucket names match `wrangler.toml`

3. **API Key errors**
   - Verify secrets are set: `wrangler secret list`
   - Test keys with Azure/QWen APIs directly

4. **CORS issues**
   - Worker handles CORS automatically
   - Check browser console for specific errors

### Debug Mode

Enable debug logging by adding to your worker:

```javascript
console.log('Debug info:', { request: request.url, method: request.method });
```

View logs with: `npm run tail`

## 📈 Monitoring

- Use Cloudflare dashboard to monitor requests
- Set up alerts for error rates
- Monitor R2 storage usage
- Track KV read/write operations

## 🔄 Updates

To update the worker:

1. Make changes to `src/index.js`
2. Test locally: `npm run dev`
3. Deploy: `npm run deploy`

## 📝 Notes

- Audio files are cached for 1 year in R2
- KV data is eventually consistent globally
- Worker has 128MB memory limit
- CPU time limit is 30 seconds per request 