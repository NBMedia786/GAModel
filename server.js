import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import morgan from 'morgan';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import https from 'https';
import { spawn } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { lookup as mimeLookup } from 'mime-types';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from './logger.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import {
  sanitizeFilename,
  sanitizeProjectName,
  isPathSafe,
  isValidVideoType,
  isValidFileSize,
  safeJsonParse
} from './security-utils.js';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate required environment variables
if (!GEMINI_API_KEY) {
  logger.error('❌ Missing GEMINI_API_KEY in .env');
  console.error('❌ Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

logger.info('🚀 Starting Frame AI Hub Server', {
  nodeEnv: NODE_ENV,
  port: PORT
});

const app = express();

// --- SECURITY MIDDLEWARE ---

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now to allow inline scripts in frontend
  crossOriginEmbedderPolicy: false, // Allow embedding
}));

// CORS Configuration
const corsOrigins = process.env.CORS_ORIGINS || '*';
const corsOptions = {
  origin: corsOrigins === '*' ? '*' : corsOrigins.split(',').map(o => o.trim()),
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// --- SESSION & PASSPORT ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true if https
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());


// Rate Limiting Configuration
// Set RATE_LIMIT_DISABLED=true in .env to disable rate limiting entirely
// Set RATE_LIMIT_MAX to a very high number (e.g., 999999) for unlimited requests
const rateLimitDisabled = process.env.RATE_LIMIT_DISABLED === 'true' || process.env.RATE_LIMIT_DISABLED === '1';
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '100');
const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15');

// No-op middleware when rate limiting is disabled
const noOpLimiter = (req, res, next) => next();

if (rateLimitDisabled) {
  logger.info('Rate limiting is DISABLED - unlimited requests allowed');
  // Apply no-op middleware to all API routes
  app.use('/api/', noOpLimiter);
} else {
  // Lenient rate limiter for read-only GET endpoints (like /api/history/list)
  // Use very high limit if RATE_LIMIT_MAX is set high, otherwise use 300
  const lenientMax = rateLimitMax > 10000 ? rateLimitMax : 300;
  const lenientLimiter = rateLimit({
    windowMs: rateLimitWindow * 60 * 1000,
    max: lenientMax,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', { service: 'frame-ai-hub', ip: req.ip, path: req.path });
      res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
  });

  const limiter = rateLimit({
    windowMs: rateLimitWindow * 60 * 1000,
    max: rateLimitMax,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', { service: 'frame-ai-hub', ip: req.ip, path: req.path });
      res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
  });

  // Apply lenient rate limiting to read-only GET endpoints that are frequently polled
  app.use('/api/history/list', lenientLimiter);
  app.use('/api/notifications', lenientLimiter);

  // Apply standard rate limiting to all other API routes
  app.use('/api/', limiter);

  logger.info(`Rate limiting enabled: ${rateLimitMax} requests per ${rateLimitWindow} minutes (lenient: ${lenientMax})`);
}

// Stricter rate limit for expensive operations
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: { error: 'Too many analysis requests, please try again later.' }
});

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging with Winston
app.use(morgan('combined', { stream: logger.stream }));

// Debug middleware for development
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    if (req.path.startsWith('/project') || req.path.startsWith('/api/project') ||
      req.path.startsWith('/history') || req.path.startsWith('/api/history')) {
      logger.debug(`${req.method} ${req.path}`);
    }
    next();
  });
}

// Enhanced Health Check
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  };

  try {
    // Check FFmpeg availability
    const ffmpegCheck = await hasFfmpeg();
    health.ffmpeg = ffmpegCheck.ok ? 'available' : 'not found';

    // Check disk space
    try {
      const stats = await fsp.stat(HISTORY_DIR);
      health.historyDir = 'accessible';
    } catch (e) {
      health.historyDir = 'error';
      health.status = 'degraded';
    }

    // Check Gemini API key
    health.geminiApiKey = GEMINI_API_KEY ? 'configured' : 'missing';

    res.json(health);
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.status(500).json({
      status: 'error',
      timestamp: Date.now(),
      error: 'Health check failed'
    });
  }
});

// --- DIRECTORIES ---
const HISTORY_DIR = path.resolve(process.env.HISTORY_DIR || path.join(__dirname, 'history'));
await fsp.mkdir(HISTORY_DIR, { recursive: true });

// Serve History Files (Videos/JSON)
app.use('/history_static', express.static(HISTORY_DIR));

// Setup Temp Uploads
const uploadDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'uploads-'));
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `${ts}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB limit
}).single('video');

// --- GOOGLE AI SETUP ---
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY, { agent: keepAliveAgent });
const fileManager = new GoogleAIFileManager(GEMINI_API_KEY, { agent: keepAliveAgent });
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

// --- HELPER FUNCTIONS ---
// --- HELPER FUNCTIONS ---
const sendProgress = (res, pct, label, phase) => {
  const payload = { pct, label, phase };
  res.write(`\n[PROGRESS:${JSON.stringify(payload)}]\n`);
};

function secToHMS(total) {
  total = Math.max(0, Math.floor(total || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function getMimeType(filePath) {
  return mimeLookup(path.extname(filePath)) || 'application/octet-stream';
}

async function waitForActive(fileName, { timeoutMs = 25 * 60 * 1000, intervalMs = 3000 } = {}) {
  const start = Date.now();
  while (true) {
    const f = await fileManager.getFile(fileName);
    const state = f?.file?.state || f?.state;
    if (state === 'ACTIVE') return f;
    if (state === 'FAILED' || state === 'DELETED') throw new Error(`Gemini file state is ${state}; cannot proceed.`);
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for Gemini file to become ACTIVE (last state=${state ?? 'unknown'})`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

function isTransientError(err) {
  const msg = (err?.message || '').toLowerCase();
  const code = err?.status || err?.code || '';
  return (
    /503|500|502|504/.test(String(code)) ||
    msg.includes('503') || msg.includes('500') || msg.includes('502') || msg.includes('504') ||
    msg.includes('timed out') || msg.includes('timeout') ||
    msg.includes('ecconnreset') || msg.includes('etimedout') || msg.includes('econnrefused')
  );
}

async function streamWithRetry(model, request, { attempts = 3, initialDelayMs = 2000, onRetry = () => { } } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const resp = await model.generateContentStream(request);
      return resp;
    } catch (err) {
      lastErr = err;
      if (i < attempts && isTransientError(err)) {
        const delay = initialDelayMs * Math.pow(2, i - 1);
        await onRetry(i + 1, delay, err);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function hasFfmpeg() {
  const candidates = process.platform === 'win32'
    ? ['ffmpeg', 'ffmpeg.exe', 'C:\\ffmpeg\\bin\\ffmpeg.exe']
    : ['ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];

  for (const cmd of candidates) {
    try {
      await new Promise((resolve, reject) => {
        const proc = spawn(cmd, ['-version']);
        proc.on('error', reject);
        proc.on('close', code => (code === 0 ? resolve() : reject()));
      });
      return { ok: true, path: cmd };
    } catch { }
  }
  return { ok: false };
}

function spawnPromise(bin, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    if (proc.stderr) proc.stderr.on('data', d => stderr += d.toString());
    proc.on('error', reject);
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Exited with code ${code}: ${stderr}`)));
  });
}

async function splitVideoIntoChunks(inputPath, outputDir) {
  const ffmpeg = await hasFfmpeg();
  if (!ffmpeg.ok) throw new Error('FFmpeg not found. Please install FFmpeg.');

  const outputPattern = path.join(outputDir, 'chunk_%03d.mp4');

  // Try copy first
  const args = [
    '-i', inputPath,
    '-c', 'copy',
    '-map', '0:v', '-map', '0:a',
    '-segment_time', '120',
    '-f', 'segment',
    '-y',
    outputPattern
  ];

  try {
    await spawnPromise(ffmpeg.path, args);
  } catch (e) {
    console.warn('Copy failed, trying re-encode...', e.message);
    // Fallback to re-encode
    const fallbackArgs = [
      '-i', inputPath,
      '-map', '0:v', '-map', '0:a',
      '-segment_time', '120',
      '-f', 'segment',
      '-y',
      outputPattern
    ];
    await spawnPromise(ffmpeg.path, fallbackArgs);
  }

  const files = await fsp.readdir(outputDir);
  return files.filter(f => f.startsWith('chunk_')).map(f => path.join(outputDir, f)).sort();
}

// --- JOB QUEUE SYSTEM ---
const jobQueue = [];
let activeJobs = 0;
const MAX_CONCURRENT_JOBS = 1;

async function processQueue() {
  if (activeJobs >= MAX_CONCURRENT_JOBS || jobQueue.length === 0) return;

  const job = jobQueue.shift();
  activeJobs++;

  try {
    await job();
  } catch (error) {
    console.error('Job failed:', error);
  } finally {
    activeJobs--;
    processQueue();
  }
}

function addToQueue(jobFn) {
  return new Promise((resolve, reject) => {
    jobQueue.push(async () => {
      try {
        await jobFn();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    processQueue();
  });
}

// --- ANALYSIS LOGIC ---
// --- NOTIFICATION HELPER ---
async function addNotification(title, description, type = 'info') {
  const NOTIFICATIONS_FILE = path.join(HISTORY_DIR, 'notifications.json');
  let notifications = [];
  try {
    const data = await fsp.readFile(NOTIFICATIONS_FILE, 'utf8');
    notifications = JSON.parse(data);
  } catch (e) { }

  const newNotification = {
    id: Date.now(),
    title,
    description,
    type,
    read: false,
    timestamp: new Date().toISOString(),
    // Fallback for older frontends if needed
    message: description
  };

  notifications.unshift(newNotification);
  // Keep only last 50
  if (notifications.length > 50) notifications = notifications.slice(0, 50);

  await fsp.writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
}

async function processAnalysisJob(videoPath, prompt, res) {
  let chunkDir = null;
  const uploadedGeminiFiles = [];

  // Prepare analysis file path
  const videoName = path.basename(videoPath);
  const analysisFileName = `${videoName}.analysis.txt`;
  const analysisPath = path.join(path.dirname(videoPath), analysisFileName);

  try {
    // 0. Clear previous analysis file if exists (Start Fresh)
    try { await fsp.unlink(analysisPath); } catch (e) { }

    // 1. Process Video
    sendProgress(res, 10, 'Processing Video...', 'process');
    chunkDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'chunks-'));
    const chunkFiles = await splitVideoIntoChunks(videoPath, chunkDir);

    sendProgress(res, 30, `Video split into ${chunkFiles.length} chunks`, 'process');

    // 2. Analyze Each Chunk
    const totalChunks = chunkFiles.length;
    const CHUNK_SECONDS = 120;

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = chunkFiles[i];
      const chunkNum = i + 1;

      // Calculate progress (30% to 90%)
      const progressStart = 30 + Math.floor((i / totalChunks) * 60);
      sendProgress(res, progressStart, `Analyzing part ${chunkNum}/${totalChunks}...`, 'analyze');

      // Upload
      const chunkMimeType = getMimeType(chunkPath);
      const uploadResponse = await fileManager.uploadFile(chunkPath, {
        mimeType: chunkMimeType,
        displayName: `Chunk ${chunkNum}`
      });
      uploadedGeminiFiles.push(uploadResponse.file.name);

      // Wait for Active
      const readyChunk = await waitForActive(uploadResponse.file.name);
      console.log(`[DEBUG] Chunk ${chunkNum} active. readyChunk keys: ${Object.keys(readyChunk).join(', ')}`);

      // Analyze
      const chunkStartSec = i * CHUNK_SECONDS;
      const chunkStartHMS = secToHMS(chunkStartSec);
      const chunkEndHMS = secToHMS((i + 1) * CHUNK_SECONDS);

      const analysisPrompt = prompt || `
      Analyze this video deeply.
      1. Listen to the audio and transcribe speech.
      2. READ the on-screen subtitles/text frame-by-frame.
      3. COMPARE the Audio Transcription vs. On-Screen Subtitles.
      4. List Every Discrepancy found (e.g., matching errors, typos, missing words).
      5. Also check for spelling/grammar errors in the subtitles themselves.

      Format the output as:
      Timestamp | Audio | Subtitle | Issue/Correction
      `;
      const finalPrompt = `${analysisPrompt}\n\nCONTEXT:\n- Part ${chunkNum} of ${totalChunks}\n- Time range: ${chunkStartHMS}–${chunkEndHMS}\n- Report timestamps relative to the full video (add offset +${chunkStartHMS}).`;

      // Robustly get URI and MimeType
      const fileUri = readyChunk.file?.uri || readyChunk.uri;
      const mimeType = uploadResponse.file.mimeType;

      if (!fileUri) {
        throw new Error(`Failed to get file URI for chunk ${chunkNum}. readyChunk: ${JSON.stringify(readyChunk)}`);
      }

      const requestPayload = {
        contents: [{
          parts: [
            { text: finalPrompt },
            { fileData: { mimeType: mimeType, fileUri: fileUri } }
          ]
        }]
      };

      const result = await streamWithRetry(model, requestPayload, {
        onRetry: (attempt) => res.write(`\n[Notice] Retrying chunk ${chunkNum} (attempt ${attempt})...\n`)
      });

      let fullAnalysisText = '';
      for await (const chunk of result.stream) {
        const text = chunk.text();
        fullAnalysisText += text;
        res.write(text);
      }

      // Save analysis to file
      const analysisFileName = `${path.basename(videoPath)}.analysis.txt`;
      const analysisPath = path.join(path.dirname(videoPath), analysisFileName);
      try {
        // Append if exists (for multi-chunk), or write new? 
        // Since we loop chunks, we should append.
        await fsp.appendFile(analysisPath, fullAnalysisText);
      } catch (e) {
        console.error('Failed to save analysis:', e);
      }
    }

    // Notify Completion
    const videoName = path.basename(videoPath);


    sendProgress(res, 100, 'Analysis Complete', 'complete');
    await addNotification(
      'Analysis Complete',
      `AI Analysis for ${videoName} has successfully completed.`,
      'success'
    );

    res.end();

  } catch (error) {
    console.error('[ANALYSIS JOB] Error:', error);
    res.write(`\n[Error] ${error.message}\n`);
    res.end();
  } finally {
    // Cleanup
    if (chunkDir) {
      try { await fsp.rm(chunkDir, { recursive: true, force: true }); } catch (e) { }
    }
    for (const name of uploadedGeminiFiles) {
      try { await fileManager.deleteFile(name); } catch (e) { }
    }
  }
}

// --- API ROUTES ---

// 0. Create Notification (Manual)
app.post('/api/notifications', async (req, res) => {
  try {
    const { title, description, type } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    await addNotification(title, description, type || 'info');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 1. List History (Projects)

app.get('/api/history/list', async (req, res) => {
  try {
    const entries = [];
    const files = await fsp.readdir(HISTORY_DIR);

    for (const id of files) {
      // Check for metadata.json first, fall back to meta.json
      const possibleFiles = ['metadata.json', 'meta.json'];
      let data = null;

      for (const metaName of possibleFiles) {
        try {
          const metaPath = path.join(HISTORY_DIR, id, metaName);
          const raw = await fsp.readFile(metaPath, 'utf8');
          data = JSON.parse(raw);
          break; // Found one, stop looking
        } catch (e) { }
      }

      if (data) {
        // Calculate total size of project (excluding deleted files)
        try {
          const projectDir = path.join(HISTORY_DIR, id);
          const deletedFilesPath = path.join(projectDir, '.deleted.json');

          // Read deleted files list
          let deletedFiles = {};
          try {
            const deletedData = await fsp.readFile(deletedFilesPath, 'utf8');
            deletedFiles = JSON.parse(deletedData);
          } catch (e) {
            // No deleted files yet
          }

          // Read all files in project directory
          const projectFiles = await fsp.readdir(projectDir);
          let totalSize = 0;
          let fileCount = 0;
          let lastUpdated = data.createdAt; // Default to creation time

          console.log(`[SIZE CALC] Project ${id} (${data.name}): Found ${projectFiles.length} items in directory`);

          for (const fileName of projectFiles) {
            // Skip metadata files and deleted files tracking
            if (fileName === 'metadata.json' || fileName === 'meta.json' || fileName === '.deleted.json') {
              continue;
            }

            // Skip deleted files
            if (deletedFiles[fileName] === true) {
              console.log(`[SIZE CALC] Skipping deleted file: ${fileName}`);
              continue;
            }

            const filePath = path.join(projectDir, fileName);
            try {
              const stats = await fsp.stat(filePath);

              // Update lastUpdated if this file is newer
              if (stats.mtimeMs > lastUpdated) {
                lastUpdated = stats.mtimeMs;
              }

              // Only count files, not directories
              if (stats.isFile()) {
                totalSize += stats.size;
                fileCount++;
                const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`[SIZE CALC] File: ${fileName}, Size: ${sizeMB} MB`);
              } else {
                console.log(`[SIZE CALC] Skipping directory: ${fileName}`);
              }
            } catch (e) {
              // File might not exist, skip it
              console.error(`[SIZE CALC] Error reading file ${fileName} in project ${id}:`, e.message);
            }
          }

          // Add size to project data - ensure these are always set
          data.totalSize = totalSize || 0;
          const sizeInGB = totalSize > 0 ? (totalSize / (1024 * 1024 * 1024)).toFixed(2) : "0.00";
          data.sizeInGB = sizeInGB;
          data.fileCount = fileCount || 0;
          data.lastUpdated = lastUpdated;

          console.log(`[SIZE CALC] Project ${id} (${data.name}): ${fileCount} files, ${sizeInGB} GB (${totalSize} bytes)`);
          console.log(`[SIZE CALC] Final data for ${id}:`, JSON.stringify({ totalSize, sizeInGB, fileCount }));
        } catch (e) {
          console.error(`[SIZE CALC] Error calculating size for project ${id}:`, e);
          console.error(`[SIZE CALC] Error stack:`, e.stack);
          // Ensure defaults are set even on error
          data.totalSize = 0;
          data.sizeInGB = "0.00";
          data.fileCount = 0;
        }

        // Ensure size fields are always present before pushing
        if (typeof data.totalSize === 'undefined') data.totalSize = 0;
        if (typeof data.sizeInGB === 'undefined') data.sizeInGB = "0.00";
        if (typeof data.fileCount === 'undefined') data.fileCount = 0;


        entries.push(data);
      }
    }

    // Sort newest first
    entries.sort((a, b) => b.createdAt - a.createdAt);

    // Log final response for debugging and ensure all size fields are properly set
    console.log(`[HISTORY LIST] Returning ${entries.length} projects`);
    entries.forEach(entry => {
      // Ensure size fields are numbers/strings as expected
      if (typeof entry.totalSize === 'undefined') entry.totalSize = 0;
      if (typeof entry.sizeInGB === 'undefined') entry.sizeInGB = "0.00";
      if (typeof entry.fileCount === 'undefined') entry.fileCount = 0;

      console.log(`[HISTORY LIST] Project ${entry.id} (${entry.name}): sizeInGB = ${entry.sizeInGB}, totalSize = ${entry.totalSize} bytes, fileCount = ${entry.fileCount}`);
    });

    res.json(entries);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 2. Get Project Files
app.get('/api/history/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    const projectDir = path.join(HISTORY_DIR, id);
    const deletedFilesPath = path.join(projectDir, '.deleted.json');

    // Check if project exists
    try {
      await fsp.access(projectDir);
    } catch (e) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Read deleted files list
    let deletedFiles = {};
    try {
      const deletedData = await fsp.readFile(deletedFilesPath, 'utf8');
      deletedFiles = JSON.parse(deletedData);
    } catch (e) {
      // No deleted files yet, that's okay
    }

    // Read all files in the project directory
    const files = await fsp.readdir(projectDir);
    const fileList = [];

    for (const fileName of files) {
      // Skip metadata files and deleted files tracking
      if (fileName === 'metadata.json' || fileName === 'meta.json' || fileName === '.deleted.json') continue;

      // HIDE ANALYSIS FILES
      if (fileName.endsWith('.analysis.txt')) continue;

      const filePath = path.join(projectDir, fileName);
      const stats = await fsp.stat(filePath);

      // Check if file is marked as deleted
      const isDeleted = deletedFiles[fileName] === true;

      // Determine file type
      let fileType = 'document';
      const ext = path.extname(fileName).toLowerCase();
      if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
        fileType = 'video';
      } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
        fileType = 'audio';
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        fileType = 'image';
      }

      fileList.push({
        id: fileName,
        title: fileName,
        owner: 'You',
        date: new Date(stats.mtime).toLocaleDateString(),
        gradient: 'bg-gradient-blue-purple',
        type: fileType,
        size: stats.size,
        deleted: isDeleted,
        deletedAt: isDeleted ? deletedFiles[fileName + '_deletedAt'] : undefined,
        url: `/history_static/${id}/${fileName}`
      });
    }

    res.json(fileList);
  } catch (e) {
    console.error('Error fetching project files:', e);
    res.status(500).json({ error: e.message });
  }
});

// 3. Rename File in Project
app.put('/api/history/:id/files/:fileName', async (req, res) => {
  try {
    const { id, fileName } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'New file name is required' });
    }

    const projectDir = path.join(HISTORY_DIR, id);
    const oldFilePath = path.join(projectDir, decodeURIComponent(fileName));
    const newFilePath = path.join(projectDir, newName.trim());

    // Check if project exists
    try {
      await fsp.access(projectDir);
    } catch (e) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if old file exists
    try {
      await fsp.access(oldFilePath);
    } catch (e) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if new name already exists
    try {
      await fsp.access(newFilePath);
      return res.status(400).json({ error: 'A file with this name already exists' });
    } catch (e) {
      // File doesn't exist, we can rename
    }

    // Rename the file
    await fsp.rename(oldFilePath, newFilePath);

    console.log(`File renamed: ${fileName} -> ${newName}`);

    res.json({
      success: true,
      message: 'File renamed successfully',
      oldName: fileName,
      newName: newName.trim(),
    });
  } catch (e) {
    console.error('Error renaming file:', e);
    res.status(500).json({ error: e.message });
  }
});

// 4. Soft Delete File (Move to Recently Deleted)
app.delete('/api/history/:id/files/:fileName', async (req, res) => {
  console.log(`[DELETE] Route matched: ${req.method} ${req.path}`);
  console.log(`[DELETE] Original URL: ${req.originalUrl}`);
  console.log(`[DELETE] Params:`, req.params);
  console.log(`[DELETE] Query:`, req.query);

  try {
    const { id, fileName } = req.params;
    const { permanent } = req.query; // Check if this is a permanent delete

    // Express automatically decodes URL parameters, but we may need to decode again for special characters
    let decodedFileName = fileName;
    try {
      decodedFileName = decodeURIComponent(fileName);
    } catch (e) {
      // If already decoded, use as is
      decodedFileName = fileName;
    }

    const projectDir = path.join(HISTORY_DIR, id);
    const filePath = path.join(projectDir, decodedFileName);
    const deletedFilesPath = path.join(projectDir, '.deleted.json');

    console.log(`DELETE request for file: ${fileName} (decoded: ${decodedFileName}) in project: ${id}, permanent: ${permanent}`);
    console.log(`File path: ${filePath}`);

    // Check if project exists
    try {
      await fsp.access(projectDir);
    } catch (e) {
      console.error(`Project directory not found: ${projectDir}`);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if file exists
    try {
      await fsp.access(filePath);
      console.log(`File exists: ${filePath}`);
    } catch (e) {
      console.error(`File not found: ${filePath}`);
      // List all files in the directory for debugging
      try {
        const files = await fsp.readdir(projectDir);
        console.log(`Files in project directory:`, files);
      } catch (listError) {
        console.error('Error listing files:', listError);
      }
      return res.status(404).json({ error: `File not found: ${decodedFileName}` });
    }

    // If permanent delete is requested, delete the file permanently
    if (permanent === 'true') {
      await fsp.unlink(filePath);

      // Also try to delete the associated analysis file
      try {
        const analysisPath = path.join(projectDir, `${decodedFileName}.analysis.txt`);
        await fsp.unlink(analysisPath);
        console.log(`Deleted associated analysis file: ${analysisPath}`);
      } catch (e) {
        // Ignore if analysis file doesn't exist
      }

      // Remove from deleted files list
      try {
        let deletedFiles = {};
        try {
          const deletedData = await fsp.readFile(deletedFilesPath, 'utf8');
          deletedFiles = JSON.parse(deletedData);
        } catch (e) {
          // File doesn't exist, that's okay
        }

        delete deletedFiles[decodedFileName];
        delete deletedFiles[decodedFileName + '_deletedAt'];

        await fsp.writeFile(deletedFilesPath, JSON.stringify(deletedFiles, null, 2));
      } catch (e) {
        console.error('Error updating deleted files list:', e);
      }

      console.log(`File permanently deleted: ${decodedFileName} from project ${id}`);

      return res.json({
        success: true,
        message: 'File permanently deleted',
      });
    }

    // Otherwise, soft delete (mark as deleted)
    let deletedFiles = {};
    try {
      const deletedData = await fsp.readFile(deletedFilesPath, 'utf8');
      deletedFiles = JSON.parse(deletedData);
    } catch (e) {
      // File doesn't exist, create new
    }

    deletedFiles[decodedFileName] = true;
    deletedFiles[decodedFileName + '_deletedAt'] = Date.now();

    await fsp.writeFile(deletedFilesPath, JSON.stringify(deletedFiles, null, 2));

    console.log(`File moved to recently deleted: ${decodedFileName} from project ${id}`);

    res.json({
      success: true,
      message: 'File moved to recently deleted',
    });
  } catch (e) {
    console.error('Error deleting file:', e);
    res.status(500).json({ error: e.message || 'Failed to delete file' });
  }
});

// 5. Restore File from Recently Deleted
app.post('/api/history/:id/files/:fileName/restore', async (req, res) => {
  try {
    const { id, fileName } = req.params;
    let decodedFileName = fileName;
    try {
      decodedFileName = decodeURIComponent(fileName);
    } catch (e) {
      decodedFileName = fileName;
    }

    const projectDir = path.join(HISTORY_DIR, id);
    const deletedFilesPath = path.join(projectDir, '.deleted.json');

    console.log(`RESTORE request for file: ${decodedFileName} in project: ${id}`);

    // Check if project exists
    try {
      await fsp.access(projectDir);
    } catch (e) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Read deleted files list
    let deletedFiles = {};
    try {
      const deletedData = await fsp.readFile(deletedFilesPath, 'utf8');
      deletedFiles = JSON.parse(deletedData);
    } catch (e) {
      return res.status(404).json({ error: 'File is not in recently deleted' });
    }

    // Check if file is marked as deleted
    if (!deletedFiles[decodedFileName]) {
      return res.status(404).json({ error: 'File is not in recently deleted' });
    }

    // Remove from deleted files list
    delete deletedFiles[decodedFileName];
    delete deletedFiles[decodedFileName + '_deletedAt'];

    await fsp.writeFile(deletedFilesPath, JSON.stringify(deletedFiles, null, 2));

    console.log(`File restored: ${decodedFileName} from project ${id}`);

    res.json({
      success: true,
      message: 'File restored successfully',
    });
  } catch (e) {
    console.error('Error restoring file:', e);
    res.status(500).json({ error: e.message || 'Failed to restore file' });
  }
});

// 6. Delete Project
app.delete('/api/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`DELETE request for project: ${id}`);
    const projectDir = path.join(HISTORY_DIR, id);

    // Check if project exists
    try {
      await fsp.access(projectDir);
    } catch (e) {
      console.log(`Project directory not found: ${projectDir}`);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete the entire project directory
    await fsp.rm(projectDir, { recursive: true, force: true });
    console.log(`Successfully deleted project: ${id}`);

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (e) {
    console.error('Error deleting project:', e);
    res.status(500).json({ error: e.message });
  }
});

// 3. Settings API
const SETTINGS_FILE = path.join(HISTORY_DIR, 'settings.json');

// Get user settings
app.get('/api/settings', async (req, res) => {
  try {
    // Default settings without hardcoded personal data
    let settings = {
      firstName: "",
      lastName: "",
      email: "",
      emailNotifications: false,
      pushNotifications: false,
      commentNotifications: true,
      darkMode: false,
    };

    try {
      const data = await fsp.readFile(SETTINGS_FILE, 'utf8');
      const savedSettings = safeJsonParse(data, {});
      settings = { ...settings, ...savedSettings };
    } catch (e) {
      // File doesn't exist, return default settings
      logger.debug('Settings file not found, using defaults');
    }

    res.json(settings);
  } catch (e) {
    console.error('Error fetching settings:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update profile settings
app.put('/api/settings/profile', async (req, res) => {
  try {
    let settings = {};
    try {
      const data = await fsp.readFile(SETTINGS_FILE, 'utf8');
      settings = JSON.parse(data);
    } catch (e) {
      // File doesn't exist, create new
    }

    settings.firstName = req.body.firstName || settings.firstName;
    settings.lastName = req.body.lastName || settings.lastName;
    settings.email = req.body.email || settings.email;

    await fsp.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    res.json({ success: true, settings });
  } catch (e) {
    console.error('Error updating profile:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update notification preferences
app.put('/api/settings/notifications', async (req, res) => {
  try {
    let settings = {};
    try {
      const data = await fsp.readFile(SETTINGS_FILE, 'utf8');
      settings = JSON.parse(data);
    } catch (e) {
      // File doesn't exist, create new
    }

    if (req.body.emailNotifications !== undefined) {
      settings.emailNotifications = req.body.emailNotifications;
    }
    if (req.body.pushNotifications !== undefined) {
      settings.pushNotifications = req.body.pushNotifications;
    }
    if (req.body.commentNotifications !== undefined) {
      settings.commentNotifications = req.body.commentNotifications;
    }

    await fsp.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    res.json({ success: true, settings });
  } catch (e) {
    console.error('Error updating notifications:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update appearance preferences
app.put('/api/settings/appearance', async (req, res) => {
  try {
    let settings = {};
    try {
      const data = await fsp.readFile(SETTINGS_FILE, 'utf8');
      settings = JSON.parse(data);
    } catch (e) {
      // File doesn't exist, create new
    }

    if (req.body.darkMode !== undefined) {
      settings.darkMode = req.body.darkMode;
    }

    await fsp.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    res.json({ success: true, settings });
  } catch (e) {
    console.error('Error updating appearance:', e);
    res.status(500).json({ error: e.message });
  }
});

// Change password - DISABLED (requires authentication system)
app.put('/api/settings/password', async (req, res) => {
  // Password management requires authentication system
  // This endpoint is disabled until authentication is implemented
  logger.warn('Password change attempted but authentication not implemented');
  res.status(501).json({
    error: 'Password management requires authentication system. Please implement authentication first.'
  });
});

// Delete account
app.delete('/api/settings/account', async (req, res) => {
  try {
    // In a real app, delete user data, projects, etc.
    // For now, just delete settings file
    try {
      await fsp.unlink(SETTINGS_FILE);
    } catch (e) {
      // File doesn't exist, that's okay
    }

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (e) {
    console.error('Error deleting account:', e);
    res.status(500).json({ error: e.message });
  }
});

// 4. Notifications API
const NOTIFICATIONS_FILE = path.join(HISTORY_DIR, 'notifications.json');

// Get all notifications
app.get('/api/notifications', async (req, res) => {
  try {
    let notifications = [];
    try {
      const data = await fsp.readFile(NOTIFICATIONS_FILE, 'utf8');
      notifications = JSON.parse(data);
    } catch (e) {
      // File doesn't exist yet, return empty array
      notifications = [];
    }
    res.json(notifications);
  } catch (e) {
    console.error('Error fetching notifications:', e);
    res.status(500).json({ error: e.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    let notifications = [];

    try {
      const data = await fsp.readFile(NOTIFICATIONS_FILE, 'utf8');
      notifications = JSON.parse(data);
    } catch (e) {
      return res.status(404).json({ error: 'Notifications file not found' });
    }

    const notification = notifications.find(n => n.id === parseInt(id));
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notification.read = true;
    await fsp.writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));

    res.json({ success: true });
  } catch (e) {
    console.error('Error marking notification as read:', e);
    res.status(500).json({ error: e.message });
  }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    let notifications = [];

    try {
      const data = await fsp.readFile(NOTIFICATIONS_FILE, 'utf8');
      notifications = JSON.parse(data);
    } catch (e) {
      return res.status(404).json({ error: 'Notifications file not found' });
    }

    notifications.forEach(n => n.read = true);
    await fsp.writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));

    res.json({ success: true });
  } catch (e) {
    console.error('Error marking all notifications as read:', e);
    res.status(500).json({ error: e.message });
  }

});

// Delete all notifications
app.delete('/api/notifications', async (req, res) => {
  try {
    // Write empty array to file
    await fsp.writeFile(NOTIFICATIONS_FILE, JSON.stringify([], null, 2));
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting all notifications:', e);
    res.status(500).json({ error: e.message });
  }
});

// 4. Create New Project (Empty Folder)
app.post('/api/project/create', async (req, res) => {
  logger.info('POST /api/project/create received');
  try {
    const { projectName, template } = req.body;

    if (!projectName || !projectName.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Sanitize project name to prevent path traversal
    let sanitizedName;
    try {
      sanitizedName = sanitizeProjectName(projectName);
    } catch (error) {
      logger.warn('Invalid project name attempted', { projectName });
      return res.status(400).json({ error: error.message });
    }

    const projectId = `hist-${Date.now()}`;
    const projectDir = path.join(HISTORY_DIR, projectId);

    // Verify path safety
    if (!isPathSafe(HISTORY_DIR, projectDir)) {
      logger.error('Path traversal attempt detected', { projectDir });
      return res.status(400).json({ error: 'Invalid project path' });
    }

    // Create project directory
    await fsp.mkdir(projectDir, { recursive: true });
    logger.info('Project directory created', { projectId, projectDir });

    // Create metadata file
    const meta = {
      id: projectId,
      name: sanitizedName,
      source: 'manual',
      createdAt: Date.now(),
      template: template || 'blank',
      videoFileName: null
    };

    await fsp.writeFile(
      path.join(projectDir, 'metadata.json'),
      JSON.stringify(meta, null, 2)
    );

    logger.info('Project created successfully', { projectId, name: sanitizedName });

    res.json({
      success: true,
      projectId,
      message: 'Project created successfully'
    });
  } catch (e) {
    logger.error('Error creating project', { error: e.message, stack: e.stack });
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// 5. Upload Video to Project (Save Only)
app.post('/api/project/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      logger.error('Multer error during upload', { error: err.message });
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }

    // Validate file type
    if (!isValidVideoType(req.file.mimetype)) {
      await fsp.unlink(req.file.path).catch(() => { });
      logger.warn('Invalid video type attempted', { mimetype: req.file.mimetype });
      return res.status(400).json({ error: 'Invalid video file type. Supported: MP4, MOV, AVI, MKV, WebM' });
    }

    // Validate file size
    if (!isValidFileSize(req.file.size)) {
      await fsp.unlink(req.file.path).catch(() => { });
      logger.warn('File size exceeded', { size: req.file.size });
      return res.status(400).json({ error: 'File size exceeds 2GB limit' });
    }

    const { projectId } = req.body;
    if (!projectId) {
      await fsp.unlink(req.file.path).catch(() => { });
      return res.status(400).json({ error: 'Project ID is required' });
    }

    logger.info('Uploading video to project', { projectId, filename: req.file.originalname });

    const projectDir = path.join(HISTORY_DIR, projectId);

    // Verify path safety
    if (!isPathSafe(HISTORY_DIR, projectDir)) {
      await fsp.unlink(req.file.path).catch(() => { });
      logger.error('Path traversal attempt in upload', { projectId });
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Check if project exists
    try {
      await fsp.access(projectDir);
    } catch (e) {
      await fsp.unlink(req.file.path).catch(() => { });
      return res.status(404).json({ error: 'Project not found' });
    }

    try {
      // Sanitize filename
      let sanitizedFileName;
      try {
        sanitizedFileName = sanitizeFilename(req.file.originalname || req.file.filename);
      } catch (error) {
        await fsp.unlink(req.file.path).catch(() => { });
        logger.warn('Invalid filename attempted', { filename: req.file.originalname });
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const videoDestPath = path.join(projectDir, sanitizedFileName);

      // Verify final path safety
      if (!isPathSafe(projectDir, videoDestPath)) {
        await fsp.unlink(req.file.path).catch(() => { });
        logger.error('Path traversal attempt in filename', { filename: sanitizedFileName });
        return res.status(400).json({ error: 'Invalid filename' });
      }

      // Check if file already exists and add timestamp if needed
      let finalFileName = sanitizedFileName;
      let finalPath = videoDestPath;
      let counter = 1;
      while (true) {
        try {
          await fsp.access(finalPath);
          // File exists, add counter
          const ext = path.extname(sanitizedFileName);
          const nameWithoutExt = path.basename(sanitizedFileName, ext);
          finalFileName = `${nameWithoutExt}_${counter}${ext}`;
          finalPath = path.join(projectDir, finalFileName);
          counter++;
        } catch (e) {
          // File doesn't exist, we can use this path
          break;
        }
      }

      await fsp.copyFile(req.file.path, finalPath);
      await fsp.unlink(req.file.path).catch(() => { });

      logger.info('Video saved successfully', { projectId, filename: finalFileName });

      // Update metadata
      try {
        const metaPath = path.join(projectDir, 'metadata.json');
        const metaData = await fsp.readFile(metaPath, 'utf8');
        const meta = safeJsonParse(metaData, {});
        meta.videoFileName = finalFileName;
        await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2));
      } catch (e) {
        logger.debug('Metadata update skipped', { error: e.message });
      }

      res.json({
        success: true,
        message: 'Video uploaded successfully',
        fileName: finalFileName,
        projectId: projectId
      });
    } catch (error) {
      logger.error('Error uploading video to project', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Failed to upload video' });
    }
  });
});

// 6. Start Analysis (The Complex Logic) - Rate Limited
app.post('/api/project/:id/analyze', strictLimiter, async (req, res) => {
  const { id } = req.params;
  const { prompt, fileName } = req.body;

  logger.info('Analysis request received', { projectId: id, fileName });

  if (!fileName || !fileName.trim()) {
    return res.status(400).json({ error: 'File name is required' });
  }

  // Sanitize filename
  let sanitizedFileName;
  try {
    sanitizedFileName = sanitizeFilename(fileName.trim());
  } catch (error) {
    logger.warn('Invalid filename in analyze request', { fileName });
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const projectDir = path.join(HISTORY_DIR, id);

  // Check if project exists
  try {
    await fsp.access(projectDir);
  } catch (e) {
    logger.error('Project not found for analysis', { projectId: id, projectDir });
    return res.status(404).json({ error: 'Project not found' });
  }

  // Find video file
  let videoFileName = fileName;

  if (!videoFileName) {
    try {
      const metaPath = path.join(projectDir, 'metadata.json');
      const metaData = await fsp.readFile(metaPath, 'utf8');
      const meta = JSON.parse(metaData);
      videoFileName = meta.videoFileName;
      logger.debug('Found videoFileName in metadata', { videoFileName });
    } catch (e) {
      // Fallback: look for video files in dir
      const files = await fsp.readdir(projectDir);
      videoFileName = files.find(f => ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(path.extname(f).toLowerCase()));
      logger.debug('Auto-detected videoFileName', { videoFileName });
    }
  }

  logger.debug('Resolved videoFileName', { videoFileName });

  if (!videoFileName) {
    logger.warn('No video file found in project');
    return res.status(404).json({ error: 'No video file found in project' });
  }

  const videoPath = path.join(projectDir, videoFileName);
  logger.debug('Checking videoPath', { videoPath });

  // Check if video file exists
  try {
    await fsp.access(videoPath);
    logger.debug('Video file exists (Exact match)', { videoPath });
  } catch (e) {
    logger.debug('Video file NOT found', { videoPath, error: e.message });

    // --- FUZZY MATCHING FALLBACK ---
    logger.debug('Attempting fuzzy match');
    try {
      const files = await fsp.readdir(projectDir);
      logger.debug('Files in directory', { files });

      // Helper to normalize filenames (remove non-alphanumeric, lowercase)
      const normalize = (str) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const targetNormalized = normalize(videoFileName);
      logger.debug('Target normalized', { targetNormalized });

      const fuzzyMatch = files.find(f => {
        const fileNormalized = normalize(f);
        // Check if one contains the other or they are equal
        return fileNormalized === targetNormalized ||
          fileNormalized.includes(targetNormalized) ||
          targetNormalized.includes(fileNormalized);
      });

      if (fuzzyMatch) {
        logger.debug('Fuzzy match FOUND', { fuzzyMatch });
        videoFileName = fuzzyMatch;
        // Update videoPath with the found file
        const newVideoPath = path.join(projectDir, videoFileName);
        // Verify access just in case
        await fsp.access(newVideoPath);

        // Setup Streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.flushHeaders?.();

        // Add to Job Queue with the CORRECT path
        addToQueue(() => processAnalysisJob(newVideoPath, prompt, res));
        return; // Exit this handler, job is queued
      } else {
        logger.debug('No fuzzy match found');
      }
    } catch (err) {
      logger.error('Fuzzy match error', { error: err.message });
    }
    // --- END FUZZY MATCHING ---

    return res.status(404).json({ error: `Video file not found: ${videoFileName}` });
  }

  // Setup Streaming (Exact match case)
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders?.();

  // Add to Job Queue
  addToQueue(() => processAnalysisJob(videoPath, prompt, res));
});

// 7. Convert Video Quality
app.post('/api/project/:id/convert', async (req, res) => {
  const { id } = req.params;
  const { targetHeight } = req.body; // e.g. 480, 720, 1080

  if (!targetHeight || isNaN(targetHeight)) {
    return res.status(400).json({ error: 'Valid targetHeight is required' });
  }

  const projectDir = path.join(HISTORY_DIR, id);

  // Check if project exists
  try {
    await fsp.access(projectDir);
  } catch (e) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    // Find the ORIGINAL video file (source of truth)
    const metaPath = path.join(projectDir, 'metadata.json');
    const metaData = await fsp.readFile(metaPath, 'utf8');
    const meta = JSON.parse(metaData);
    let videoFileName = meta.videoFileName;

    if (!videoFileName) {
      // Fallback: look for video files
      const files = await fsp.readdir(projectDir);
      videoFileName = files.find(f =>
        ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(path.extname(f).toLowerCase()) &&
        !f.includes('_480p') && !f.includes('_720p') && !f.includes('_1080p') && !f.includes('_4k') // Avoid picking already converted ones
      );
    }

    if (!videoFileName) {
      return res.status(404).json({ error: 'Original video file not found' });
    }

    const inputPath = path.join(projectDir, videoFileName);

    // Construct output filename: "video_720p.mp4"
    const ext = path.extname(videoFileName);
    const nameWithoutExt = path.basename(videoFileName, ext);
    // Remove previous quality tags if any, though we derived this from metadata so it should be clean
    const outputFileName = `${nameWithoutExt}_${targetHeight}p${ext}`;
    const outputPath = path.join(projectDir, outputFileName);

    // 1. Check if already exists
    try {
      await fsp.access(outputPath);
      logger.info('Converted video already exists', { outputPath });
      return res.json({ success: true, fileName: outputFileName });
    } catch (e) {
      // Does not exist, proceed to convert
    }

    // 2. Convert using FFmpeg
    // Scale filter: -2 means maintain aspect ratio, calculate from other dimension.
    // Ensure height is divisible by 2 for some codecs.
    const ffmpeg = await hasFfmpeg();
    if (!ffmpeg.ok) {
      return res.status(500).json({ error: 'FFmpeg not found on server' });
    }

    logger.info('Starting transcoding', { inputPath, height: targetHeight });

    const args = [
      '-i', inputPath,
      '-vf', `scale=-2:${targetHeight}`,
      '-c:v', 'libx264',
      '-crf', '23',
      '-preset', 'fast',
      '-c:a', 'copy',
      '-y',
      outputPath
    ];

    await spawnPromise(ffmpeg.path, args);

    logger.info('Transcoding complete', { outputPath });

    res.json({ success: true, fileName: outputFileName });

  } catch (e) {
    logger.error('Conversion failed', { error: e.message });
    res.status(500).json({ error: e.message || 'Conversion failed' });
  }
});

// Get Analysis Results
app.get('/api/project/:id/analysis/:filename', async (req, res) => {
  try {
    const { id, filename } = req.params;
    const projectDir = path.join(HISTORY_DIR, id);

    // Check if project exists
    try {
      await fsp.access(projectDir);
    } catch (e) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Resolve filename (handle URL encoding/decoding issues)
    let videoFileName = filename;
    const analysisFileName = `${videoFileName}.analysis.txt`;
    const analysisPath = path.join(projectDir, analysisFileName);

    try {
      const content = await fsp.readFile(analysisPath, 'utf8');
      res.json({ success: true, content });
    } catch (e) {
      // It's okay if analysis doesn't exist yet
      res.status(404).json({ error: 'Analysis not found' });
    }
  } catch (e) {
    console.error('Error fetching analysis:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- AUTH & ADMIN ROUTES ---

const USERS_FILE = path.join(HISTORY_DIR, 'users.json');

// Helper to get users
async function getUsers() {
  try {
    const data = await fsp.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {}; // Return empty object if file doesn't exist
  }
}

// Helper to save users
async function saveUsers(users) {
  await fsp.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// --- PASSPORT CONFIGURATION ---

passport.serializeUser((user, done) => {
  done(null, user.email);
});

passport.deserializeUser(async (email, done) => {
  const users = await getUsers();
  const user = users[email];
  done(null, user || null);
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'MISSING_ID',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'MISSING_SECRET',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
},
  async function (accessToken, refreshToken, profile, cb) {
    try {
      const email = profile.emails[0].value;
      const firstName = profile.name.givenName;
      const lastName = profile.name.familyName;
      const photoURL = profile.photos[0].value;

      // Domain Restriction
      if (!email.endsWith('@nbmediaproductions.com')) {
        return cb(null, false, { message: 'Unauthorized domain' });
      }

      const users = await getUsers();
      const now = new Date().toISOString();
      const isAdmin = email === process.env.ADMIN_EMAIL;

      // Update or Create User
      users[email] = {
        email,
        firstName,
        lastName,
        photoURL,
        lastLogin: now,
        isAdmin,
        joinedAt: users[email]?.joinedAt || now,
        loginCount: (users[email]?.loginCount || 0) + 1
      };

      await saveUsers(users);
      logger.info(`Passport Login: ${email} (Admin: ${isAdmin})`);

      return cb(null, users[email]);
    } catch (err) {
      return cb(err);
    }
  }
));

// --- AUTH ROUTES ---

// 1. Trigger Google Login
app.get('/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 2. Callback
app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
  function (req, res) {
    // Successful authentication, redirect to Frontend
    const frontendUrl = process.env.CORS_ORIGINS && process.env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGINS.split(',')[0]
      : 'http://localhost:8080/';

    res.redirect(frontendUrl);
  }
);
// NOTE: I'll hardcode localhost:8080 for callback redirect for now as per user env.
// Correction: User env says dev. I should check CORS origin or just redirect to / which express might handle if serving static, 
// BUT currently npm run dev is separate.
// Safest: Redirect to request origin or hardcoded frontend.
// I'll update the callback to: `res.redirect('http://localhost:5173');` or `8080` depending on Vite.
// Log indicates server on 3000. Notification request came from 8080. So redirect to 8080.

// 3. Get Current User (Session)
app.get('/api/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ isAuthenticated: true, user: req.user });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// 4. Logout
app.get('/api/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});


app.get('/api/admin/users', async (req, res) => {
  try {
    const adminEmail = req.headers['x-user-email'];
    if (adminEmail !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const users = await getUsers();
    res.json(Object.values(users));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const adminEmail = req.headers['x-user-email'];
    if (adminEmail !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // 1. User Count
    const users = await getUsers();
    const userCount = Object.keys(users).length;

    // 2. Project Stats
    const files = await fsp.readdir(HISTORY_DIR);
    let projectCount = 0;
    let totalStorage = 0;

    for (const file of files) {
      // Skip system files
      if (file === 'users.json' || file === 'notifications.json') continue;

      const filePath = path.join(HISTORY_DIR, file);
      try {
        const stats = await fsp.stat(filePath);
        if (stats.isDirectory()) {
          projectCount++;
          // Calculate directory size (deep) - simplified for now to just readdir
          const subFiles = await fsp.readdir(filePath);
          for (const sub of subFiles) {
            const subPath = path.join(filePath, sub);
            const subStats = await fsp.stat(subPath);
            totalStorage += subStats.size;
          }
        }
      } catch (e) { }
    }

    const storageGB = (totalStorage / (1024 * 1024 * 1024)).toFixed(2);

    res.json({
      users: userCount,
      projects: projectCount,
      storageGB: storageGB,
      storageBytes: totalStorage
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- FAIL-SAFE ROUTING (The Fix) ---

// 1. Serve Static Assets (Images, JS, CSS) - but exclude API routes
const staticMiddleware = express.static(path.join(__dirname, 'dist'));
app.use((req, res, next) => {
  // Skip static file serving for API routes
  if (req.path.startsWith('/api')) {
    return next(); // Skip static serving, go to next middleware
  }
  // For non-API routes, try to serve static files
  staticMiddleware(req, res, next);
});

// --- ERROR HANDLING MIDDLEWARE ---
// Global error handler - must be after all routes
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Don't expose internal error details in production
  const errorMessage = NODE_ENV === 'production'
    ? 'An internal server error occurred'
    : err.message;

  res.status(err.status || 500).json({
    error: errorMessage,
    ...(NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 2. Catch-All Middleware
// This should only run if no previous route matched
// Express route handlers (app.get, app.post, app.delete, etc.) are matched first
// So this middleware only runs for routes that weren't matched above
app.use((req, res) => {
  // Check if this is an API route that should return JSON 404
  const isApiRoute = req.path.startsWith('/api');

  if (isApiRoute) {
    logger.warn('API route not found', { method: req.method, path: req.path });
    return res.status(404).json({ error: 'API route not found' });
  }

  // For all other routes (non-API), serve the React app
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- START SERVER ---
app.listen(PORT, () => {
  logger.info(`✅ Server listening on http://localhost:${PORT}`);
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});
