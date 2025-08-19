import 'dotenv/config';
import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import https from 'https';
import { createServer } from 'http';
import { Server } from 'socket.io';
import adminRoutes, { setupWebSocket } from './routes/admin.js';
import searchSpotsRoutes from './routes/search-spots-in-scenic-area.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;
const httpsPort = 3443;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Admin routes
app.use('/api/admin', adminRoutes);

// Search spots routes
app.use('/api', searchSpotsRoutes);

// TTS API endpoint
app.post('/api/tts', (req, res) => {
  const { text, voice = 'xiaoxiao', rate = '-10%', pitch = '0%', output, spotName } = req.body;
  
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  // Create safe filename
  const safeName = (spotName || 'narration').replace(/[^\w\u4e00-\u9fff]/g, '_');
  const fileName = output || `${safeName}_${Date.now()}.mp3`;
  const outputPath = path.join(__dirname, 'public', 'audio', fileName);
  
  // Ensure audio directory exists
  const audioDir = path.dirname(outputPath);
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  // Execute the TTS script
  const scriptPath = path.join(__dirname, 'scripts', 'microsoftTTS.js');
  const command = `node "${scriptPath}" -v ${voice} -r "${rate}" -p "${pitch}" -o "${outputPath}" "${text}"`;
  
  console.log('Executing TTS command:', command);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('TTS execution error:', error);
      return res.status(500).json({ 
        error: 'TTS generation failed', 
        details: error.message 
      });
    }
    
    if (stderr) {
      console.warn('TTS stderr:', stderr);
    }
    
    console.log('TTS stdout:', stdout);
    
    // Check if file was created
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      
      res.json({
        success: true,
        message: 'TTS generation completed',
        audioFile: `/audio/${fileName}`,
        fileName,
        fileSizeKB: parseFloat(fileSizeKB),
        textLength: text.length,
        output: stdout
      });
    } else {
      res.status(500).json({ 
        error: 'TTS file was not created',
        output: stdout 
      });
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'TTS API Server is running' 
  });
});

// Create HTTP server with WebSocket support
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Setup WebSocket for real-time task updates
setupWebSocket(io);

// Start HTTP server (for development)
httpServer.listen(port, () => {
  console.log(`🎤 TTS API Server running on http://localhost:${port}`);
  console.log(`📁 Audio files will be saved to: ${path.join(__dirname, 'public', 'audio')}`);
  console.log(`🔧 Using TTS script: ${path.join(__dirname, 'scripts', 'microsoftTTS.js')}`);
  console.log(`🔌 WebSocket server ready for real-time updates`);
});

// Start HTTPS server (for production)
const tryHTTPS = () => {
  try {
    // Look for SSL certificates
    const sslOptions = {
      key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key')),
      cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.crt'))
    };
    
    https.createServer(sslOptions, app).listen(httpsPort, () => {
      console.log(`🔒 HTTPS TTS API Server running on https://localhost:${httpsPort}`);
      console.log(`📱 iPhone Safari will work with HTTPS!`);
    });
  } catch (error) {
    console.log(`ℹ️  HTTPS not available (missing SSL certificates): ${error.message}`);
    console.log(`📝 To enable HTTPS for iPhone Safari compatibility:`);
    console.log(`   1. Generate SSL certificates in ssl/ directory`);
    console.log(`   2. Or use a reverse proxy like nginx with Let's Encrypt`);
    console.log(`   3. Or deploy to a hosting service with HTTPS support`);
  }
};

tryHTTPS();

export default app;
