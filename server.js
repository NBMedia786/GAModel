







import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import morgan from 'morgan';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { lookup as mimeLookup } from 'mime-types';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY in .env');
  console.error('   Please set GEMINI_API_KEY environment variable');
  process.exit(1);
}

// Log platform info for debugging
console.log(`🌍 Platform: ${process.platform}`);
console.log(`📁 Working directory: ${__dirname}`);
console.log(`🔑 GEMINI_API_KEY: ${GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);

const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// History static serving (videos/results) - configurable for VPS/local
const HISTORY_ROUTE = process.env.HISTORY_ROUTE || '/history_static';
const HISTORY_DIR = path.resolve(process.env.HISTORY_DIR || path.join(__dirname, 'history'));
await fsp.mkdir(HISTORY_DIR, { recursive: true });
app.use(HISTORY_ROUTE, express.static(HISTORY_DIR));

const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

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
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
}).single('video');

// ---------- helpers ----------

/**
 * Sends a structured progress update to the client.
 * Progress is divided into 4 sections of 25% each:
 * - Section 1 (0-25%): Upload/Download
 * - Section 2 (25-50%): Process/Split
 * - Section 3 (50-75%): Analyze
 * - Section 4 (75-100%): Complete
 * @param {import('express').Response} res The Express response object.
 * @param {number} sectionProgress Progress within current section (0-100, will map to 0-25% of total).
 * @param {string} label The text to display.
 * @param {string} section Which section (1-4) we're currently in.
 * @param {string} [step] Optional step key for the UI stepper.
 */
const sendProgress = (res, sectionProgress, label, section, step) => {
  // Clamp sectionProgress to 0-100
  sectionProgress = Math.max(0, Math.min(100, sectionProgress));
  
  // Calculate total percentage based on section
  let totalPct = 0;
  const sectionSize = 25; // Each section is 25%
  
  if (section === 1) {
    // Section 1: 0-25%
    totalPct = (sectionProgress / 100) * sectionSize;
  } else if (section === 2) {
    // Section 2: 25-50%
    totalPct = 25 + ((sectionProgress / 100) * sectionSize);
  } else if (section === 3) {
    // Section 3: 50-75%
    totalPct = 50 + ((sectionProgress / 100) * sectionSize);
  } else if (section === 4) {
    // Section 4: 75-100%
    totalPct = 75 + ((sectionProgress / 100) * sectionSize);
  }
  
  totalPct = Math.round(totalPct);
  
  const payload = { pct: totalPct, label };
  if (step) payload.step = step;
  res.write(`\n[PROGRESS:${JSON.stringify(payload)}]\n`);
};

const isYouTubeUrl = (url) => {
  try {
    const u = new URL(url);
    return /(^|\.)youtube\.com$/.test(u.hostname) || u.hostname === 'youtu.be';
  } catch {
    return false;
  }
};
const deleteIfExists = async (p) => { if (p) { try { await fsp.unlink(p); } catch {} } };
function getMimeType(filePath) { return mimeLookup(path.extname(filePath)) || 'application/octet-stream'; }

function spawnPromise(bin, args, { collectStderr = true } = {}) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', collectStderr ? 'pipe' : 'inherit'] });
    if (collectStderr && proc.stderr) {
      proc.stderr.on('data', d => { stderr += d.toString(); });
    }
    proc.on('error', reject);
    proc.on('close', code => code === 0 ? resolve({ code, stderr }) : reject(new Error(`${bin} exited with code ${code}${stderr ? `\n${stderr}` : ''}`)));
  });
}

// ---------- History helpers ----------
async function getDirectorySizeBytes(rootDir) {
  let total = 0;
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = await fsp.readdir(current, { withFileTypes: true }); }
    catch { continue; }
    for (const ent of entries) {
      const p = path.join(current, ent.name);
      try {
        const st = await fsp.stat(p);
        if (st.isDirectory()) stack.push(p); else total += st.size;
      } catch {}
    }
  }
  return total;
}

async function getHistoryEntries() {
  let entries = [];
  let ids;
  try { ids = await fsp.readdir(HISTORY_DIR, { withFileTypes: true }); } catch { ids = []; }
  for (const dirent of ids) {
    if (!dirent.isDirectory()) continue;
    const id = dirent.name;
    const entryDir = path.join(HISTORY_DIR, id);
    try {
      const metaPath = path.join(entryDir, 'meta.json');
      const metaRaw = await fsp.readFile(metaPath, 'utf8');
      const meta = JSON.parse(metaRaw);
      // Attach URLs for client
      const videoUrl = meta.videoFileName ? `/history_static/${id}/${meta.videoFileName}` : null;
      const resultsUrl = `/history_static/${id}/results.txt`;
      entries.push({ id, ...meta, videoUrl, resultsUrl });
    } catch {}
  }
  entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return entries;
}

async function enforceHistoryCapBytes(capBytes = 20 * 1024 * 1024 * 1024) {
  let total = await getDirectorySizeBytes(HISTORY_DIR);
  if (total <= capBytes) return;
  const entries = await getHistoryEntries();
  for (let i = entries.length - 1; i >= 0 && total > capBytes; i--) {
    const e = entries[i];
    const dir = path.join(HISTORY_DIR, e.id);
    try {
      await fsp.rm(dir, { recursive: true, force: true });
      total = await getDirectorySizeBytes(HISTORY_DIR);
    } catch {}
  }
}

async function hasFfmpeg() {
  // Platform-specific candidates
  const candidates = process.platform === 'win32' 
    ? [
        'ffmpeg', 'ffmpeg.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\ffmpeg\\bin\\ffmpeg.exe'
      ]
    : [
        'ffmpeg', // Standard Linux/Unix path
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg'
      ];
  
  for (const cmd of candidates) {
    try {
      await new Promise((resolve, reject) => {
        const proc = spawn(cmd, ['-version']);
        proc.on('error', reject);
        proc.on('close', code => (code === 0 ? resolve() : reject()));
      });
      return { ok: true, path: cmd };
    } catch {}
  }
  return { ok: false };
}

async function whichFirst(candidates) {
  for (const cmd of candidates) {
    try {
      await new Promise((resolve, reject) => {
        const p = spawn(cmd, ['-version']);
        p.on('error', reject);
        p.on('close', code => code === 0 ? resolve() : reject(new Error('not found')));
      });
      return cmd;
    } catch {}
  }
  return null;
}
async function findFfprobe() {
  // Platform-specific candidates
  const candidates = process.platform === 'win32'
    ? [
        'ffprobe', 'ffprobe.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
        'C:\\ffmpeg\\bin\\ffprobe.exe'
      ]
    : [
        'ffprobe', // Standard Linux/Unix path
        '/usr/bin/ffprobe',
        '/usr/local/bin/ffprobe'
      ];
  return whichFirst(candidates);
}

async function getDurationSec(localPath) {
  const ffprobe = await findFfprobe();
  if (!ffprobe) return null;
  return await new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nokey=1:noprint_wrappers=1',
      localPath
    ];
    let out = '';
    const p = spawn(ffprobe, args);
    p.stdout.on('data', d => out += d.toString());
    p.on('close', () => {
      const sec = parseFloat((out || '').trim());
      if (isFinite(sec)) resolve(sec); else resolve(null);
    });
    p.on('error', () => resolve(null));
  });
}
function secToHMS(total) {
  total = Math.max(0, Math.floor(total || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => n.toString().padStart(2,'0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ---- yt-dlp presence (self-download if missing) ----
const YTDLP_BIN_DIR = path.join(os.tmpdir(), 'yt-dlp-bin');
await fsp.mkdir(YTDLP_BIN_DIR, { recursive: true });
const YTDLP_BIN_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : (process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp');
const YTDLP_BIN_PATH = path.join(YTDLP_BIN_DIR, YTDLP_BIN_NAME);

const YTDLP_RELEASE_URLS = {
  win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
};

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (resp) => {
      if (resp.statusCode && resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        return downloadToFile(resp.headers.location, destPath).then(resolve).catch(reject);
      }
      if (resp.statusCode !== 200) {
        file.close(() => fs.unlink(destPath, () => {}));
        return reject(new Error(`Failed to download yt-dlp (HTTP ${resp.statusCode})`));
      }
      resp.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close(() => fs.unlink(destPath, () => {}));
      reject(err);
    });
  });
}

async function which(cmd) {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const d of dirs) {
    for (const e of exts) {
      const p = path.join(d, cmd + e);
      try { await fsp.access(p, fs.constants.X_OK); return p; } catch {}
    }
  }
  return null;
}

async function ensureYtDlp() {
  // PATH first
  let bin = await which(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (bin) return bin;

  // Local cached binary
  if (!fs.existsSync(YTDLP_BIN_PATH)) {
    const url = YTDLP_RELEASE_URLS[process.platform] || YTDLP_RELEASE_URLS.linux;
    await downloadToFile(url, YTDLP_BIN_PATH);
    if (process.platform !== 'win32') {
      await fsp.chmod(YTDLP_BIN_PATH, 0o755);
    }
  }
  return YTDLP_BIN_PATH;
}

// Prefer progressive MP4; fallback to separate streams merge (needs ffmpeg)
function ytFormatArgs(ffmpegOk) {
  const args = [
    '--no-playlist',
    '--no-check-certificate',
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best',
    '-S', 'ext:mp4:m4a,res,codec:avc1:acodec:aac'
  ];
  if (ffmpegOk) {
    args.push('--merge-output-format', 'mp4');
  } else {
    args[3] = 'b[ext=mp4]/best'; // progressive only if possible
  }
  return args;
}

// Robust YouTube download (returns created file path, whatever ext)
async function downloadYouTube(url) {
  const bin = await ensureYtDlp();
  const ff = await hasFfmpeg();

  const outBase = path.join(os.tmpdir(), `yt-${Date.now()}`);
  const outTpl = `${outBase}.%(ext)s`;
  const args = [ url, ...ytFormatArgs(ff.ok), '-o', outTpl ];

  await spawnPromise(bin, args);

  const created = (await fsp.readdir(path.dirname(outBase)))
    .map(name => path.join(path.dirname(outBase), name))
    .filter(p => p.startsWith(outBase + '.'));
  if (!created.length) throw new Error('yt-dlp finished but no output file was found.');

  return created[0]; // could be .mp4/.webm etc.
}

/**
 * Splits a video into 2-minute (120-second) chunks using FFmpeg segment format.
 * @param {string} inputPath Path to the full video.
 * @param {string} outputDir Directory where chunks will be saved.
 * @param {string} outputPattern Output pattern (e.g., "chunk_%03d.mp4")
 * @returns {Promise<string[]>} Array of paths to created chunk files, sorted.
 */
async function splitVideoIntoChunks(inputPath, outputDir, outputPattern = 'chunk_%03d.mp4') {
  const ffmpegInfo = await hasFfmpeg();
  if (!ffmpegInfo.ok) throw new Error('ffmpeg not found, cannot split video.');

  const outputPath = path.join(outputDir, outputPattern);
  
  const args = [
    '-i', inputPath,
    '-c', 'copy',              // Copy codecs (fast, no re-encoding)
    '-map', '0:v',             // Map video stream
    '-map', '0:a',             // Map audio stream
    '-segment_time', '120',    // 2 minutes per chunk
    '-f', 'segment',           // Use segment format
    '-y',                      // Overwrite output files
    outputPath
  ];

  try {
    await spawnPromise(ffmpegInfo.path, args, { collectStderr: true });
  } catch (e) {
    // Fallback: If -c copy fails, try re-encoding (slower but more robust)
    console.warn(`ffmpeg -c copy failed for splitting, retrying with re-encoding. Error: ${e.message}`);
    const fallbackArgs = [
      '-i', inputPath,
      '-map', '0:v',
      '-map', '0:a',
      '-segment_time', '120',
      '-f', 'segment',
      '-y',
      outputPath
    ];
    await spawnPromise(ffmpegInfo.path, fallbackArgs, { collectStderr: true });
  }

  // Get list of created chunk files
  // FFmpeg segment with %03d creates files like output_chunk_000.mp4, output_chunk_001.mp4, etc.
  const baseName = outputPattern.split('%')[0]; // "output_chunk_"
  const ext = path.extname(outputPattern); // ".mp4"
  const files = await fsp.readdir(outputDir);
  const chunkFiles = files
    .filter(f => {
      const name = path.basename(f);
      // Match pattern: baseName + 3 digits + extension
      // Escape special regex characters in baseName, then match 3 digits and extension
      const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^${escapedBase}\\d{3}\\.${ext.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
      return pattern.test(name);
    })
    .map(f => path.join(outputDir, f))
    .sort(); // Sort alphabetically to maintain order (000, 001, 002, ...)

  if (chunkFiles.length === 0) {
    throw new Error('No chunk files were created. FFmpeg may have failed silently.');
  }

  return chunkFiles;
}


// ---------- Gemini ----------

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY, { agent: keepAliveAgent });
const fileManager = new GoogleAIFileManager(GEMINI_API_KEY, { agent: keepAliveAgent });

// ---------- Job Queue for Concurrency Control ----------
const jobQueue = [];
let activeJobs = 0;
const MAX_CONCURRENT_JOBS = 3;

// ---------- Session Tracking for Recovery ----------
// Maps sessionId -> { historyId, status: 'active'|'completed'|'failed', createdAt }
const activeSessions = new Map();

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

async function streamWithRetry(model, request, { attempts = 3, initialDelayMs = 2000, onRetry = () => {} } = {}) {
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

// ---------- Job Queue Functions ----------

/**
 * Processes a single analysis job. Contains all the video analysis logic.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} sessionId - Session ID for recovery
 * @param {string} providedHistoryId - Pre-generated history ID (optional)
 */
async function processAnalysisJob(req, res, sessionId, providedHistoryId) {
  let localPath = null;
  let cleanupPath = null;
  let chunkFiles = []; // Declare outside try so we can clean up in finally
  let chunkDir = null; // Unique temp directory for this job's chunks
  const uploadedGeminiFiles = []; // Track for cleanup
  // History bookkeeping
  let historyId = providedHistoryId || null;
  let historyEntryDir = null;
  let resultsWrite = null;
  let videoFileName = null;

  const { url, prompt } = req.body || {};
  const hasFile = !!req.file;
  const hasUrl = !!url;
  
  // Update session status to active
  if (sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.status = 'active';
      if (historyId) session.historyId = historyId;
      activeSessions.set(sessionId, session);
    }
  }

  try {
      // 1) Resolve ONE local video path (either from upload or YT)
      // Section 1: Upload/Download (0-25%)
      if (hasFile) {
        localPath = req.file.path;
        cleanupPath = localPath;
        // File upload is handled by browser XHR, server just confirms completion
        // Don't send progress here - let client-side upload progress handle it
        // Only send when we're ready to move to next phase
        sendProgress(res, 90, 'Uploading…', 1, 'upload');
      } else {
        sendProgress(res, 5, 'Downloading YouTube video…', 1, 'upload');
        try {
          localPath = await downloadYouTube(url);
          sendProgress(res, 50, 'Downloading YouTube video…', 1, 'upload');
          sendProgress(res, 90, 'Downloading YouTube video…', 1, 'upload');
        } catch (e) {
          const msg = e?.message || String(e);
          if (/ffmpeg/i.test(msg)) {
            throw new Error('YouTube download needs ffmpeg for merging. Install it and try again.\n' + msg);
          }
          if (/HTTP Error 410|unavailable|age|signin|restricted/i.test(msg)) {
            throw new Error('This YouTube video cannot be downloaded (private, age-restricted, etc).\n' + msg);
          }
          throw new Error('YouTube download failed:\n' + msg);
        }
        cleanupPath = localPath;
        sendProgress(res, 100, 'Download complete', 1, 'upload');
      }

      // 2) Create history entry and move/copy original video into it
      // Use provided historyId if available, otherwise generate new one
      if (!historyId) {
        historyId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      }
      historyEntryDir = path.join(HISTORY_DIR, historyId);
      await fsp.mkdir(historyEntryDir, { recursive: true });
      
      // Update session with historyId if not already set
      if (sessionId) {
        const session = activeSessions.get(sessionId);
        if (session) {
          session.historyId = historyId;
          activeSessions.set(sessionId, session);
        }
      }
      
      // Create unique temporary directory for this job's chunks
      chunkDir = await fsp.mkdtemp(path.join(os.tmpdir(), `chunks-${historyId}-`));
      
      videoFileName = path.basename(localPath);
      const historyVideoPath = path.join(historyEntryDir, videoFileName);
      try {
        await fsp.rename(localPath, historyVideoPath);
        localPath = historyVideoPath;
        cleanupPath = null; // preserved in history
      } catch (e) {
        try { await fsp.copyFile(localPath, historyVideoPath); } catch {}
      }
      const meta = {
        id: historyId,
        name: (req.file?.originalname) || (url || videoFileName),
        source: hasFile ? 'file' : 'youtube',
        videoFileName,
        createdAt: Date.now()
      };
      try { await fsp.writeFile(path.join(historyEntryDir, 'meta.json'), JSON.stringify(meta, null, 2)); } catch {}
      const resultsPath = path.join(historyEntryDir, 'results.txt');
      try { resultsWrite = fs.createWriteStream(resultsPath, { flags: 'a' }); } catch {}

      // 3) Split video into 2-minute chunks
      // Section 2: Process/Split (25-50%)
      sendProgress(res, 10, 'Processing…', 2, 'process');
      sendProgress(res, 30, 'Processing… Splitting video into chunks…', 2, 'process');
      const chunkOutputPattern = 'output_chunk_%03d.mp4';
      try {
        chunkFiles = await splitVideoIntoChunks(localPath, chunkDir, chunkOutputPattern);
        sendProgress(res, 70, 'Processing… Chunks created', 2, 'process');
        sendProgress(res, 100, `Processing… Created ${chunkFiles.length} chunk(s)`, 2, 'process');
        res.write(`\n[Info] Video split into ${chunkFiles.length} chunk(s)\n`);
      } catch (e) {
        throw new Error(`Failed to split video into chunks: ${e.message}`);
      }

      if (chunkFiles.length === 0) {
        throw new Error('No chunks were created from the video.');
      }
      
      // 4) Initialize Model
      const model = genAI.getGenerativeModel(
        { model: 'gemini-2.5-pro' },
        { timeout: 30 * 60 * 1000 } // 30 minutes per chunk (increased for VPS latency)
      );

      // Section 3: Analyze (50-75%)
      const analysisSectionSize = 100; // 0-100% within section 3
      const CHUNK_SECONDS = 120; // must match splitVideoIntoChunks segment_time

      // 5) === MAIN LOOP: UPLOAD AND ANALYZE EACH CHUNK ===
      for (let i = 0; i < chunkFiles.length; i++) {
        const chunkPath = chunkFiles[i];
        let uploadedChunk = null;
        
        const chunkNum = i + 1;
        const totalChunks = chunkFiles.length;
        const chunkLabel = `(Chunk ${chunkNum}/${totalChunks})`;
        const chunkStartSec = i * CHUNK_SECONDS;
        const chunkStartHMS = secToHMS(chunkStartSec);
        const chunkEndHMS = secToHMS((i + 1) * CHUNK_SECONDS);
        
        // Calculate progress within section 3 (50-75%)
        // Each chunk gets an equal portion of section 3
        const chunkSizeInSection = analysisSectionSize / totalChunks;
        const chunkStartInSection = (i / totalChunks) * analysisSectionSize;
        let chunkProgressInSection = chunkStartInSection;
        
        try {
          // A. Upload the CHUNK (10% of chunk's portion)
          const chunkMimeType = getMimeType(chunkPath);
          chunkProgressInSection = chunkStartInSection + (chunkSizeInSection * 0.05);
          sendProgress(res, chunkProgressInSection, `Analyzing… Preparing chunk ${chunkNum}`, 3, 'analyze');
          
          uploadedChunk = await fileManager.uploadFile(chunkPath, {
            mimeType: chunkMimeType,
            displayName: path.basename(chunkPath),
          });
          if (!uploadedChunk?.file?.name) throw new Error('Failed to upload chunk to Gemini.');
          uploadedGeminiFiles.push(uploadedChunk.file.name);

          // B. Wait for CHUNK to be active (20% of chunk's portion)
          chunkProgressInSection = chunkStartInSection + (chunkSizeInSection * 0.15);
          sendProgress(res, chunkProgressInSection, `Analyzing… Processing chunk ${chunkNum}`, 3, 'analyze');
          const readyChunk = await waitForActive(uploadedChunk.file.name);
          const chunkFileUri = readyChunk.file?.uri || uploadedChunk.file?.uri;
          if (!chunkFileUri) throw new Error('Gemini did not return a file URI for the chunk.');

          // C. Analyze the CHUNK (30% of chunk's portion, will fill to 100% during streaming)
          chunkProgressInSection = chunkStartInSection + (chunkSizeInSection * 0.25);
          sendProgress(res, chunkProgressInSection, `Analyzing… Chunk ${chunkNum}/${totalChunks}`, 3, 'analyze');
          
          // We write this header for the client parser with an explicit offset marker
          const hdr = `\n### Chunk ${chunkNum}/${totalChunks} (range ${chunkStartHMS}–${chunkEndHMS})\n`;
          res.write(hdr);
          try { resultsWrite?.write(hdr); } catch {}
          const off = `[OFFSET_SECONDS:${chunkStartSec}]\n`;
          res.write(off);
          
          // Build a prompt that forces absolute timestamps aligned to the original full video
          const finalPrompt = `${prompt.trim()}\n\nCONTEXT (very important):\n- You are analyzing chunk ${chunkNum} of ${totalChunks} of the original video.\n- This chunk corresponds to the original time range ${chunkStartHMS}–${chunkEndHMS}.\n\nTIMESTAMP INSTRUCTION (strict):\n- Report ALL timestamps in the ORIGINAL full-video timeline.\n- Add an offset of +${chunkStartHMS} to any positions detected within this chunk.\n- Always format timestamps as HH:MM:SS.\n`;

          const requestPayload = {
            contents: [{
              parts: [
                { text: finalPrompt },
                { fileData: { mimeType: chunkMimeType, fileUri: chunkFileUri } }
              ]
            }]
          };

          // Update progress as we stream analysis
          // Progress will fill from 30% to 100% of this chunk's portion during streaming
          const chunkProgressStart = chunkProgressInSection;
          const chunkProgressEnd = chunkStartInSection + chunkSizeInSection;
          let streamChunkCount = 0;
          
          const streamResp = await streamWithRetry(model, requestPayload, {
            onRetry: async (nextAttempt, delayMs, e) => {
              res.write(`\n[Notice] Transient error in chunk ${chunkNum}. Retrying attempt ${nextAttempt}…\n`);
            }
          });

          for await (const chunk of streamResp.stream) {
            const text = chunk?.text?.() || '';
            if (text) {
              res.write(text);
              const clean = text
                .replace(/\[PROGRESS:({.*?})\]/g,'')
                .replace(/\[OFFSET_SECONDS:\\d+\]/g,'');
              if (clean) { try { resultsWrite?.write(clean); } catch {} }
              
              // Slowly fill progress from 25% to 95% of chunk's portion as we receive chunks
              streamChunkCount++;
              const progressRatio = Math.min(0.95, 0.25 + (streamChunkCount / 150)); // Fill from 25% to 95% over ~150 chunks
              chunkProgressInSection = chunkProgressStart + ((chunkProgressEnd - chunkProgressStart) * progressRatio);
              sendProgress(res, chunkProgressInSection, `Analyzing… Chunk ${chunkNum}/${totalChunks}`, 3, 'analyze');
            }
          }
          
          // Mark chunk as complete (100% of chunk's portion)
          chunkProgressInSection = chunkProgressEnd;
          sendProgress(res, chunkProgressInSection, `Analyzing… Chunk ${chunkNum}/${totalChunks} complete`, 3, 'analyze');
          res.write('\n');
          try { resultsWrite?.write('\n'); } catch {}

        } catch (e) {
          // Log the error for this chunk but continue the loop
          console.error(`Error processing chunk ${chunkNum}:`, e);
          const errLine = `\n[Error] Chunk ${chunkNum} ${chunkLabel} failed: ${e?.message || e}\n`;
          res.write(errLine);
          try { resultsWrite?.write(errLine); } catch {}
        }
        // Note: We don't clean up chunk files or Gemini files here - we do it all at the end
      }
      
      // 6) Analysis complete - Section 4: Complete (75-100%)
      sendProgress(res, 10, 'Complete… Finalizing results', 4, 'complete');
      sendProgress(res, 50, 'Complete… Finalizing results', 4, 'complete');
      sendProgress(res, 100, 'Complete!', 4, 'complete');
      res.write('\n');
    } catch (e) {
     	const msg = e?.message || String(e);
      if (!res.headersSent) return res.status(500).send(msg);
      else res.write(`\n[Error] ${msg}\n`);
    } finally {
      // Cleanup: Delete all chunk files and Gemini files
      for (const chunkPath of chunkFiles) {
        await deleteIfExists(chunkPath);
      }
      // Delete the chunk directory and all its contents
      if (chunkDir) {
        try {
          await fsp.rm(chunkDir, { recursive: true, force: true });
        } catch (e) {
          console.warn(`Failed to delete chunk directory ${chunkDir}: ${e.message}`);
        }
      }
      for (const geminiFileName of uploadedGeminiFiles) {
        try {
          await fileManager.deleteFile(geminiFileName);
        } catch (e) {
          console.warn(`Failed to delete Gemini file ${geminiFileName}: ${e.message}`);
        }
      }
      // Clean up the ORIGINAL full-length video file (if any temp)
      await deleteIfExists(cleanupPath);
      try { resultsWrite?.end(); } catch {}
      try { await enforceHistoryCapBytes(); } catch {}
      
      // Update session status to completed
      if (sessionId) {
        const session = activeSessions.get(sessionId);
        if (session) {
          session.status = 'completed';
          activeSessions.set(sessionId, session);
        }
      }
      
      if (!res.writableEnded) res.end();
      
      // Decrement active jobs and process next job in queue
      activeJobs--;
      processQueue();
  	}
}

/**
 * Processes the job queue, starting jobs up to MAX_CONCURRENT_JOBS limit.
 */
function processQueue() {
  if (activeJobs < MAX_CONCURRENT_JOBS && jobQueue.length > 0) {
    activeJobs++;
    const job = jobQueue.shift();
    processAnalysisJob(job.req, job.res, job.sessionId, job.historyId).catch((err) => {
      console.error('Error processing job:', err);
      // Update session status to failed
      if (job.sessionId) {
        const session = activeSessions.get(job.sessionId);
        if (session) {
          session.status = 'failed';
          activeSessions.set(job.sessionId, session);
        }
      }
      if (!job.res.writableEnded) {
        job.res.write(`\n[Error] Job processing failed: ${err?.message || err}\n`);
        job.res.end();
      }
      activeJobs--;
      processQueue();
    });
  }
}

// ---------- endpoint ----------

app.post('/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).send(err.message || 'File upload error');
    }

    const { url, prompt, sessionId } = req.body || {};
    const hasFile = !!req.file;
    const hasUrl = !!url;

    if (!prompt || !prompt.trim()) {
      return res.status(400).send('Missing prompt.');
    }
    if (hasFile && hasUrl) {
      return res.status(400).send('Provide either a video file OR a YouTube URL, not both.');
    }
    if (!hasFile && !hasUrl) {
      return res.status(400).send('Upload a video or provide a YouTube URL.');
    }
    if (hasUrl && !isYouTubeUrl(url)) {
      return res.status(400).send('URL must be a valid YouTube link.');
    }

    // Generate or use provided sessionId
    const finalSessionId = sessionId || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    
    // Generate historyId early (before processing starts)
    const historyId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    
    // Track session as active
    activeSessions.set(finalSessionId, {
      historyId,
      status: 'queued',
      createdAt: Date.now()
    });

    // streaming headers
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Send sessionId and historyId back immediately for recovery
    res.write(`[SESSION_ID:${finalSessionId}]\n[HISTORY_ID:${historyId}]\n`);
    
    // Send initial status with queue position
    const queuePosition = jobQueue.length + 1; // Position in queue (1 = next)
    res.write(`Queued...\n[QUEUE_POSITION:${queuePosition}]\n`);
    jobQueue.push({ req, res, sessionId: finalSessionId, historyId });
    processQueue();
  });
});

// History API: list entries
app.get('/history/list', async (req, res) => {
  try {
    const list = await getHistoryEntries();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to list history' });
  }
});

// History API: get storage info
app.get('/history/storage', async (req, res) => {
  try {
    const usedBytes = await getDirectorySizeBytes(HISTORY_DIR);
    const totalBytes = 20 * 1024 * 1024 * 1024; // 20 GB
    res.json({ used: usedBytes, total: totalBytes });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to get storage info' });
  }
});

// History API: delete entry
app.delete('/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entryDir = path.join(HISTORY_DIR, id);
    try {
      await fsp.rm(entryDir, { recursive: true, force: true });
      res.json({ success: true, message: 'History entry deleted' });
    } catch (e) {
      if (e.code === 'ENOENT') {
        res.status(404).json({ error: 'History entry not found' });
      } else {
        throw e;
      }
    }
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to delete history entry' });
  }
});

// Session API: check session status and get partial results
app.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const result = {
      sessionId,
      status: session.status,
      historyId: session.historyId,
      createdAt: session.createdAt
    };
    
    // If session has a historyId and results file exists, include it
    if (session.historyId) {
      const resultsPath = path.join(HISTORY_DIR, session.historyId, 'results.txt');
      try {
        const resultsText = await fsp.readFile(resultsPath, 'utf8');
        result.resultsText = resultsText;
        // Also try to get meta.json for video URL
        try {
          const metaPath = path.join(HISTORY_DIR, session.historyId, 'meta.json');
          const meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
          result.meta = {
            name: meta.name,
            source: meta.source,
            videoFileName: meta.videoFileName,
            videoUrl: meta.videoFileName ? `/history_static/${session.historyId}/${meta.videoFileName}` : null
          };
        } catch {}
      } catch (e) {
        // Results file doesn't exist yet (analysis hasn't started writing)
        result.resultsText = '';
      }
    }
    
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Failed to get session status' });
  }
});

// Root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});
server.headersTimeout = 0;
server.requestTimeout = 0; // No request timeout