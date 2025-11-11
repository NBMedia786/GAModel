# Deep Project Analysis: QA Video Analysis Tool

## Project Overview

**Name:** video-analysis-tool  
**Version:** 1.4.0  
**Description:** Web-based video analysis tool using Google Gemini 2.5 Pro for subtitle quality assurance (QA). The tool analyzes video subtitles by comparing them against audio transcriptions, identifying errors, and providing corrections with precise timestamps.

---

## Architecture Overview

### Technology Stack

**Backend:**
- Node.js (ES Modules)
- Express.js (web server)
- Google Generative AI (Gemini 2.5 Pro)
- Multer (file upload handling)
- yt-dlp (YouTube video downloader)
- FFmpeg/FFprobe (video processing)

**Frontend:**
- Vanilla JavaScript (ES Modules)
- HTML5/CSS3
- XMLHttpRequest (for streaming)
- docx library (for .docx export)

**Key Features:**
1. Video upload (local file or YouTube URL)
2. Video splitting into 2-minute chunks
3. AI-powered subtitle QA analysis
4. Real-time streaming results
5. History tracking with persistent storage
6. Interactive error cards with video playback
7. Export capabilities (.txt, .docx)

---

## Backend Analysis (`server.js`)

### Core Configuration

```javascript
PORT: 3000 (default, configurable via env)
GEMINI_API_KEY: Required environment variable
HISTORY_ROUTE: '/history_static' (configurable)
HISTORY_DIR: './history' (configurable, max 20GB cap)
```

### Key Functions & Logic

#### 1. **Video Input Processing**

**Function: `isYouTubeUrl(url)`**
- Validates YouTube URLs (youtube.com or youtu.be domains)
- Returns boolean

**Function: `downloadYouTube(url)`**
- **Logic Flow:**
  1. Ensures yt-dlp binary exists (downloads if missing)
  2. Detects FFmpeg availability
  3. Constructs format arguments (prefers MP4, falls back if needed)
  4. Spawns yt-dlp process to download video
  5. Returns path to downloaded video file
- **Format Selection:**
  - If FFmpeg available: `bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best` with merge
  - If no FFmpeg: `b[ext=mp4]/best` (progressive only)
- **Error Handling:** Specific messages for FFmpeg needs, age restrictions, etc.

#### 2. **yt-dlp Binary Management**

**Function: `ensureYtDlp()`**
- **Self-bootstrapping:** Downloads yt-dlp binary if not in PATH
- **Platform Detection:**
  - Windows: `yt-dlp.exe`
  - macOS: `yt-dlp_macos`
  - Linux: `yt-dlp`
- **Storage:** Caches binary in OS temp directory (`os.tmpdir()/yt-dlp-bin/`)
- **Download Source:** GitHub releases (latest)

#### 3. **Video Splitting Logic**

**Function: `splitVideoIntoChunks(inputPath, outputDir, outputPattern)`**
- **Purpose:** Splits video into 2-minute (120-second) chunks for analysis
- **Method:**
  - Uses FFmpeg `segment` format with `-segment_time 120`
  - Tries fast copy first (`-c copy`), falls back to re-encoding if needed
  - Maps both video (`-map 0:v`) and audio (`-map 0:a`) streams
- **Output:** Array of chunk file paths, sorted alphabetically
- **Pattern:** `output_chunk_%03d.mp4` (creates chunk_000.mp4, chunk_001.mp4, etc.)

**Why Split?**
- Gemini API has limits on video length
- Allows parallel processing of chunks
- Enables granular error reporting by time range

#### 4. **Duration Detection**

**Function: `getDurationSec(localPath)`**
- Uses FFprobe to extract video duration
- **FFprobe Detection:** Checks common paths:
  - `ffprobe`, `ffprobe.exe`
  - `C:\Program Files\ffmpeg\bin\ffprobe.exe`
  - `C:\ffmpeg\bin\ffprobe.exe`
- Returns duration in seconds (float) or `null` if unavailable

**Function: `secToHMS(total)`**
- Converts seconds to `HH:MM:SS` format
- Used for timestamp display and range specification

#### 5. **Gemini API Integration**

**Function: `waitForActive(fileName, options)`**
- **Purpose:** Waits for uploaded file to become "ACTIVE" in Gemini
- **Polling Logic:**
  - Checks file state every 3 seconds (default)
  - Timeout: 10 minutes (default)
  - States: `ACTIVE`, `FAILED`, `DELETED`
  - Returns file object when ACTIVE

**Function: `isTransientError(err)`**
- Detects retryable errors:
  - HTTP 5xx (500, 502, 503, 504)
  - Network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED)
  - Returns boolean

**Function: `streamWithRetry(model, request, options)`**
- **Retry Logic:**
  - Attempts: 3 (default)
  - Initial delay: 2000ms
  - Exponential backoff: `initialDelayMs * 2^(attempt-1)`
- Only retries transient errors; throws on permanent failures

#### 6. **Progress Tracking**

**Function: `sendProgress(res, pct, label, step)`**
- **Format:** `[PROGRESS:{"pct":number,"label":"string","step":"string"}]`
- Injected into response stream
- Frontend parses and updates UI accordingly

#### 7. **History Management**

**Function: `getHistoryEntries()`**
- Reads all history directories
- Parses `meta.json` from each entry
- Attaches URLs for video and results files
- Sorts by `createdAt` (newest first)
- Returns array of entry objects

**Function: `enforceHistoryCapBytes(capBytes)`**
- **Default Cap:** 20 GB (configurable)
- **Logic:**
  1. Calculates total history directory size recursively
  2. If over cap, deletes oldest entries until under cap
  3. Uses `getHistoryEntries()` to get sorted list (oldest last)

**Function: `getDirectorySizeBytes(rootDir)`**
- Recursively calculates directory size
- Uses stack-based traversal (avoids recursion limits)

#### 8. **Main Upload Endpoint (`POST /upload`)**

**Complete Flow:**

1. **Input Validation:**
   - Checks for prompt
   - Validates file OR URL (not both)
   - Validates YouTube URL format

2. **Video Acquisition:**
   - **File Upload:** Uses Multer (2GB max) → stored in temp dir
   - **YouTube:** Downloads via yt-dlp → stored in temp dir

3. **History Entry Creation:**
   - Generates unique ID: `{timestamp}-{random6chars}`
   - Creates directory in `HISTORY_DIR`
   - Moves/copies original video to history
   - Creates `meta.json` with metadata
   - Creates `results.txt` write stream

4. **Video Splitting:**
   - Splits into 2-minute chunks
   - Chunks stored in temp upload directory

5. **Chunk Processing Loop:**
   For each chunk:
   - **Upload to Gemini:** Via `fileManager.uploadFile()`
   - **Wait for ACTIVE:** Polls until ready
   - **Build Prompt:** Includes chunk context and offset instructions
   - **Analysis:** Streams Gemini response with retry logic
   - **Write Results:** Both to response stream and `results.txt`
   - **Cleanup:** Tracks uploaded files for later deletion

6. **Prompt Enhancement:**
   - Base prompt from user input
   - Adds chunk context (chunk N of M)
   - Adds time range context
   - **Critical:** Instructs model to report timestamps in ORIGINAL video timeline (adds offset)

7. **Offset Markers:**
   - Sends `[OFFSET_SECONDS:{seconds}]` marker before each chunk analysis
   - Frontend can parse for absolute timestamp calculation

8. **Cleanup (Finally Block):**
   - Deletes all chunk files
   - Deletes all Gemini uploaded files
   - Deletes original temp file (if exists)
   - Closes results write stream
   - Enforces history cap

---

## Frontend Analysis

### Main File: `public/script.js` (Active Version)

#### Core State Management

- `videoObjectURL`: Blob URL for local video playback
- `CURRENT_MODE`: 'idle' | 'file' | 'url'
- Theme preference stored in `localStorage` ('vat-theme')

#### Default Prompt

The default prompt is a comprehensive QA instruction set:
- Extracts and compares subtitles vs. audio
- Detects 9 error categories:
  1. Punctuation Errors
  2. Grammatical Errors
  3. Missing Subtitles
  4. Missing Words
  5. Spelling Errors
  6. Capitalization Errors
  7. Extra Words
  8. Abusive Language
  9. Graphic Content
- Temporal tolerance: 1-second sync tolerance
- Output format: Structured "Error #N" format with timestamps

#### Key Functions

**Function: `renderFormatted(text)`**
- **Purpose:** Parses analysis text and creates interactive error cards
- **Logic:**
  1. Splits by server headers (`### Window X...`)
  2. Extracts content (ignoring server status messages)
  3. Splits by "Error #N" pattern
  4. For each error:
     - Extracts timestamp from "Timestamp:" line
     - Parses to seconds (HH:MM:SS or MM:SS)
     - Creates error card with `data-timestamp` attribute
  5. Attaches click handlers to cards → seeks video to timestamp
- **Filtering:** Removes chatter/markdown from model output

**Function: `parseTimestampToSeconds(ts)`**
- Parses timestamps in formats:
  - `HH:MM:SS`
  - `MM:SS`
  - `H:MM`
- Returns seconds (number) or `NaN`

**Function: `seekTo(seconds)`**
- Seeks video without reloading
- Uses `fastSeek()` if available, else `currentTime`
- Waits for metadata if needed
- Auto-plays after seek

**XHR Progress Handler:**
- **Streaming Logic:**
  1. Reads new chunk from response text
  2. Extracts progress markers: `[PROGRESS:{...}]`
  3. Updates progress bar and stepper UI
  4. Strips progress markers from content
  5. Appends clean content to results
  6. Calls `renderFormatted()` to update cards

#### Export Functions

**Function: `exportAsDocFromHTML()`**
- Fallback: Creates .doc file from HTML
- Uses MIME type `application/msword`

**Function: `.docx Export`**
- Uses `docx` library (CDN loaded)
- Creates structured Word document:
  - Title: "Subtitle QA — Discrepancy Report"
  - Generation timestamp
  - Error cards as headings and paragraphs
- Falls back to `.doc` if library unavailable

#### Form Submission Flow

1. **Validation:**
   - Checks for prompt
   - Ensures file OR URL (not both)

2. **Video Setup:**
   - For file uploads: Sets video `src` to `videoObjectURL` blob
   - For YouTube: Hides video player (no local file)

3. **XHR Configuration:**
   - POST to `/upload`
   - Upload progress: 0-30% (if file upload)
   - Response streaming: Parses progress + content

4. **Stream Processing:**
   - Real-time parsing of server responses
   - Updates UI incrementally
   - Final render on completion

---

## Data Structures

### History Entry (`meta.json`)

```json
{
  "id": "timestamp-randomid",
  "name": "original_filename_or_url",
  "source": "file" | "youtube",
  "videoFileName": "actual_filename_in_history",
  "createdAt": 1234567890123
}
```

### Results File (`results.txt`)

- Plain text format
- Contains chunk headers: `### Chunk N/M (range HH:MM:SS–HH:MM:SS)`
- Contains error blocks in structured format:
  ```
  Error #N
  Timestamp: HH:MM:SS
  Error: Error Type
  Subtitle Text: ...
  Correction: ...
  ```

### Progress Marker Format

```
[PROGRESS:{"pct":45,"label":"Analyzing chunk 1/5...","step":"stream"}]
```

### Offset Marker Format

```
[OFFSET_SECONDS:120]
```

---

## UI Components

### Progress Stepper

Five states tracked:
1. `yt` - YouTube download (if URL)
2. `upload` - Uploading to Gemini
3. `waiting` - Waiting for file to become ACTIVE
4. `active` - File is ACTIVE
5. `stream` - Streaming analysis

### Results Display

**Two-Column Layout:**
- Left: Video player (controls)
- Right: Scrollable error cards sidebar

**Error Cards:**
- Clickable to seek video
- Shows error number, timestamp, details
- Hover effect for interactivity

---

## Error Handling

### Backend

1. **YouTube Download Errors:**
   - FFmpeg missing: Clear message with installation instructions
   - Age-restricted/private: Specific error message
   - Network errors: Generic download failed message

2. **Gemini API Errors:**
   - Transient errors: Auto-retry with exponential backoff
   - Permanent errors: Logged and streamed to client

3. **File Operations:**
   - All file deletions wrapped in try-catch (graceful)
   - History cap enforcement: Deletes oldest if needed

### Frontend

1. **Network Errors:**
   - Shows toast notification
   - Resets UI state

2. **Video Playback:**
   - Handles metadata loading
   - Graceful seek failures

---

## Performance Considerations

1. **Video Splitting:**
   - Uses FFmpeg copy mode (fast, no re-encoding) when possible
   - Falls back to re-encoding if needed

2. **Streaming:**
   - Server streams responses immediately (no buffering)
   - Frontend processes incrementally

3. **History:**
   - Automatic cleanup prevents disk overflow
   - Sorted lists enable efficient oldest-first deletion

4. **Gemini API:**
   - Keep-alive agent for connection reuse
   - Timeout: 15 minutes per chunk
   - Retry logic reduces transient failures

---

## Security Considerations

1. **File Upload:**
   - Max size: 2GB
   - Filename sanitization: Replaces special chars with underscores

2. **YouTube Downloads:**
   - Validates URL format
   - No arbitrary URL execution

3. **History:**
   - Served as static files (read-only access)
   - No authentication (assumes trusted environment)

---

## Configuration Options

**Environment Variables:**
- `PORT`: Server port (default: 3000)
- `GEMINI_API_KEY`: Required API key
- `HISTORY_ROUTE`: Static file route (default: '/history_static')
- `HISTORY_DIR`: History directory path (default: './history')
- `WINDOW_MINUTES`: Window size for analysis (not used in current chunk-based approach)

---

## Known Limitations

1. **Video Format:**
   - Dependent on FFmpeg/FFprobe for splitting
   - Some formats may require re-encoding (slower)

2. **Gemini API:**
   - Rate limits not explicitly handled
   - Large videos = many chunks = many API calls

3. **Browser:**
   - Video player requires local file blob for file uploads
   - YouTube URLs don't have local playback

4. **History:**
   - No user authentication
   - No per-user isolation

---

## Future Enhancement Opportunities

1. **Parallel Processing:**
   - Process multiple chunks simultaneously
   - Queue management for API rate limits

2. **Authentication:**
   - User accounts
   - Per-user history

3. **Advanced Filtering:**
   - Filter errors by category
   - Search functionality

4. **Batch Processing:**
   - Multiple video upload
   - Queue system

5. **Real-time Collaboration:**
   - Share analysis results
   - Comments/annotations

---

## File Structure Summary

```
project-root/
├── server.js              # Main Express backend (ACTIVE)
├── package.json            # Dependencies and scripts
├── public/                 # Frontend files (ACTIVE)
│   ├── index.html         # Main HTML
│   ├── script.js          # Main JavaScript (ACTIVE)
│   ├── style.css          # Styles
│   ├── scri.js            # (OLD VERSION)
│   └── script_trying.js   # (OLD VERSION)
├── public_last/            # Backup/old version
│   ├── index.html
│   ├── script.js
│   ├── server.js
│   └── style.css
└── history/                # Persistent storage
    └── {id}/               # Per-analysis entry
        ├── meta.json       # Metadata
        ├── results.txt     # Analysis results
        └── {video_file}    # Original video
```

---

## Summary

This is a **production-ready video QA analysis tool** with:

✅ **Robust backend:** Self-bootstrapping, error handling, retry logic  
✅ **Streaming architecture:** Real-time results, progress tracking  
✅ **User-friendly UI:** Interactive error cards, video playback integration  
✅ **Persistent history:** Automatic cleanup, metadata tracking  
✅ **Export capabilities:** Multiple formats (txt, docx)  
✅ **Cross-platform:** Works on Windows, macOS, Linux  

The system is designed for **subtitle quality assurance workflows**, automatically identifying discrepancies between visual subtitles and audio transcriptions with precise timestamp reporting.

