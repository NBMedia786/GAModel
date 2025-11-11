
class PointerParticle {
  constructor(spread, speed, component) {
    const { ctx, pointer, hue } = component;

    this.ctx = ctx;
    this.x = pointer.x;
    this.y = pointer.y;
    this.mx = pointer.mx * 0.1;
    this.my = pointer.my * 0.1;
    this.size = Math.random() + 1;
    this.decay = 0.01;
    this.speed = speed * 0.08;
    this.spread = spread * this.speed;
    this.spreadX = (Math.random() - 0.5) * this.spread - this.mx;
    this.spreadY = (Math.random() - 0.5) * this.spread - this.my;
    this.color = `hsl(${hue}deg 90% 60%)`;
  }

  draw() {
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  collapse() {
    this.size -= this.decay;
  }

  trail() {
    this.x += this.spreadX * this.size;
    this.y += this.spreadY * this.size;
  }

  update() {
    this.draw();
    this.trail();
    this.collapse();
  }
}

class PointerParticles extends HTMLElement {
  static register(tag = "pointer-particles") {
    if ("customElements" in window) {
      customElements.define(tag, this);
    }
  }

  static css = `
    :host {
      display: grid;
      width: 100%;
      height: 100%;
      pointer-events: none;
      position: fixed;
      top: 0;
      left: 0;
      z-index: 9999;
    }
  `;

  constructor() {
    super();

    this.canvas;
    this.ctx;
    this.fps = 60;
    this.msPerFrame = 1000 / this.fps;
    this.timePrevious;
    this.particles = [];
    this.pointer = {
      x: 0,
      y: 0,
      mx: 0,
      my: 0
    };
    this.hue = 0;
  }

  connectedCallback() {
    const canvas = document.createElement("canvas");
    const sheet = new CSSStyleSheet();

    this.shadowroot = this.attachShadow({ mode: "open" });

    sheet.replaceSync(PointerParticles.css);
    this.shadowroot.adoptedStyleSheets = [sheet];

    this.shadowroot.append(canvas);

    this.canvas = this.shadowroot.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.setCanvasDimensions();
    this.setupEvents();
    this.timePrevious = performance.now();
    this.animateParticles();
  }

  createParticles(event, { count, speed, spread }) {
    this.setPointerValues(event);

    for (let i = 0; i < count; i++) {
      this.particles.push(new PointerParticle(spread, speed, this));
    }
  }

  setPointerValues(event) {
    this.pointer.x = event.x;
    this.pointer.y = event.y;
    this.pointer.mx = event.movementX;
    this.pointer.my = event.movementY;
  }

  setupEvents() {
    document.addEventListener("click", (event) => {
      this.createParticles(event, {
        count: 300,
        speed: Math.random() + 1,
        spread: Math.random() + 50
      });
    });

    document.addEventListener("pointermove", (event) => {
      this.createParticles(event, {
        count: 20,
        speed: this.getPointerVelocity(event),
        spread: 1
      });
    });

    window.addEventListener("resize", () => this.setCanvasDimensions());
  }

  getPointerVelocity(event) {
    const a = event.movementX;
    const b = event.movementY;
    const c = Math.floor(Math.sqrt(a * a + b * b));

    return c;
  }

  handleParticles() {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].update();

      if (this.particles[i].size <= 0.1) {
        this.particles.splice(i, 1);
        i--;
      }
    }
  }

  setCanvasDimensions() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  animateParticles() {
    requestAnimationFrame(() => this.animateParticles());

    const timeNow = performance.now();
    const timePassed = timeNow - this.timePrevious;

    if (timePassed < this.msPerFrame) return;

    const excessTime = timePassed % this.msPerFrame;

    this.timePrevious = timeNow - excessTime;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hue = this.hue > 360 ? 0 : (this.hue += 3);

    this.handleParticles();
  }
}

PointerParticles.register();

const form = document.getElementById('form');
const videoInput = document.getElementById('video');
// const urlInput = document.getElementById('url');
const promptInput = document.getElementById('prompt');
const dropZone = document.getElementById('dropZone');
const browseBtn = document.getElementById('browseBtn');
const fileInfo = document.getElementById('fileInfo');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const uploadBar = document.getElementById('uploadBar');
const uploadText = document.getElementById('uploadText');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');
const themeToggle = document.getElementById('themeToggle');
const historyToggle = document.getElementById('historyToggle');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');
const toast = document.getElementById('toast');
// New UI elements
const resultsSection = document.getElementById('resultsSection');
const resultVideo = document.getElementById('resultVideo');
const summaryDiv = document.getElementById('summary');
const resultsPre = document.getElementById('results');
const downloadDocxBtn = document.getElementById('downloadDocxBtn');
const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');
const historyCloseBtn = document.getElementById('historyCloseBtn');
const particlesToggle = document.getElementById('particlesToggle');
const pointerParticlesElement = document.querySelector('pointer-particles');
const progressModal = document.getElementById('progressModal');
const stepper = document.getElementById('stepper');
const progressTitle = document.getElementById('progressTitle');
const queueInfo = document.getElementById('queueInfo');
const queueNumber = document.getElementById('queueNumber');
const statusMessage = document.getElementById('statusMessage');
const progressModalCloseBtn = document.getElementById('progressModalCloseBtn');
const transferStatsCard = document.getElementById('transferStatsCard');
const transferSpeedEl = document.getElementById('transferSpeed');
const transferProgressEl = document.getElementById('transferProgress');
const transferRemainingEl = document.getElementById('transferRemaining');

// Store current XHR request so it can be aborted
let currentXhr = null;

// Tab elements
const tabButtons = document.querySelectorAll('.tab');
const analysisTab = document.getElementById('analysisTab');
const resultsTab = document.getElementById('resultsTab');

let videoObjectURL = null; // To hold the video file reference
let uploadStatsState = { start: null, lastTime: null, lastLoaded: 0 };
const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB limit
let toastHideTimer = null;
let toastRemoveTimer = null;

// Tab switching functionality
function switchTab(tabName) {
  // Update tab buttons
  tabButtons.forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update tab content
  if (tabName === 'analysis') {
    analysisTab.classList.add('active');
    resultsTab.classList.remove('active');
  } else if (tabName === 'results') {
    analysisTab.classList.remove('active');
    resultsTab.classList.add('active');
  }
}

// Tab button click handlers
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// --- Default embedded prompt (your spec) ---
// const DEFAULT_PROMPT = `You are a video quality control expert tasked with deeply analyzing the subtitles in a video by comparing them against the audio transcription. Your goal is to identify each and every error and provide precise corrections with exact timestamps.

// Analysis Instructions

// 1. Extract and Compare: analyze the video deeply & carefully and extract the visible subtitles at each timestamp. then Compare these subtitles with the audio transcription to identify the errors.

// 2. Error Categories to Detect:
//     - Punctuation Errors: Missing or incorrect punctuation marks (periods, commas, question marks, etc.)
//     - Grammatical Errors: Incorrect grammar, tense, or sentence structure
//     - Missing Subtitles: Audio content that has no corresponding subtitle displayed
//     - Missing Words: Words present in audio but absent from subtitles
//     - Spelling Errors: Incorrectly spelled words in subtitles
//     - Capitalization Errors: Names and proper nouns that don't start with capital letters
//     - Extra Words: Words appearing in subtitles but not spoken in audio
//     - Abusive Language: Identify any profanity or abusive words that need censoring (mark with asterisks: f***)
//     - **Graphic Content**: Flag any scenes showing blood or gore that are not blurred

// 3. Output Format:
// You MUST format EACH error you find starting with "Error #[number]" followed by the details.
// If no errors are found in a time range, say so clearly.

// Example of your required output:

// Error #1
// Timestamp: 00:01:23
// Error: Puntuation Error
// Subtitle: Hello world
// Correction: Hello, world

// Error #2
// Timestamp: 00:01:45
// Error: Missing Word
// Subtitle: It's nice day   
// Correction: It's a nice day

// Deeply Analyze the entire video systematically and report ALL discrepancies found.`;














// --- Default embedded prompt (your spec) ---
// const DEFAULT_PROMPT = `You are a video quality control expert tasked with deeply analyzing the subtitles in a video by comparing them against the audio transcription. Your goal is to identify each and every error and provide precise corrections with exact timestamps.

// Analysis Instructions

// 1. Extract and Compare: analyze the video deeply & carefully and extract the visible subtitles at each timestamp. then Compare these subtitles with the audio transcription to identify the errors.

// 2. Error Categories to Detect:
//     - Punctuation Errors: Missing or incorrect punctuation marks
//     - Grammatical Errors: Incorrect grammar, tense, or sentence structure
//     - Missing Subtitles: Audio content that has no corresponding subtitle displayed
//     - Missing Words: Words present in audio but absent from subtitles
//     - Spelling Errors: Incorrectly spelled words in subtitles
//     - Capitalization Errors: Names and proper nouns that don't start with capital letters
//     - Extra Words: Words appearing in subtitles but not spoken in audio
//     - Abusive Language: Identify any profanity or abusive words
//     - Graphic Content: Flag any scenes showing blood or gore without blur 

// 3. Temporal Tolerance:
//     Subtitles and audio are not always perfectly synced. Allow a small tolerance (about 1 frame) for words spoken *just before* or *just after* a subtitle card appears. Do NOT flag "Missing Words" or "Extra Words" if the audio is just slightly out of sync (e.g., "Target!" is spoken, then "Target in the vehicle!" appears on screen).

// 4. Output Format:
// You MUST format EACH error you find starting with "Error #[number]" followed by the details.
// Your response for this time range MUST ONLY be the list of errors or a single line stating "No issues in [timestamp range]" if none are found.

// DO NOT add any other text, conversation, introductions, summaries, or markdown like '***' or '### **Analysis...**'.

// Example of your required output:

// Error #1
// Timestamp: 00:01:23
// Error: Puntuation Error
// Subtitle Text: Hello world
// Correction: Hello, world

// Error #2
// Timestamp: 00:01:45
// Error: Capitalization Error
// Subtitle Text: it's a nice day
// Correction: It's a nice day

// Deeply Analyze the entire video systematically and report ALL discrepancies found.`;







const DEFAULT_PROMPT = `You are a video quality control expert tasked with deeply analyzing the subtitles in a video by comparing them against the audio transcription. Your goal is to identify each and every error and provide precise corrections with exact timestamps.

Analysis Instructions

1. Extract and Compare: analyze the video deeply & carefully and extract the visible subtitles at each timestamp. then Compare these subtitles with the audio transcription to identify the errors.

2. Error Categories to Detect: 
    - Punctuation Errors: Missing or incorrect punctuation marks
    - Grammatical Errors: Incorrect grammar, tense, or sentence structure
    - Missing Subtitles: Audio content that has no corresponding subtitle displayed
    - Missing Words: Words present in audio but absent from subtitles
    - Spelling Errors: Incorrectly spelled words in subtitles
    - Capitalization Errors: Names and proper nouns that don't start with capital letters
    - Extra Words: Words appearing in subtitles but not spoken in audio
    - Abusive Language: Identify any profanity or abusive words and check is it censored correctly
    - Graphic Content: Flag any scenes showing blood or gore without blur 

3. Temporal Tolerance (important check):
    Subtitles and audio are not always perfectly synced. Allow a small tolerance (about 1 second) for words spoken *just before* or *just after* a subtitle card appears. Do NOT flag "Missing Words" or "Extra Words" if the audio is just slightly out of sync (e.g., "Target!" is spoken, then "Target in the vehicle!" appears on screen).

4. Output Format:
You MUST format EACH error you find starting with "Error #[number]" followed by the details.
Your response for this time range MUST ONLY be the list of errors or a single line stating "No issues in [timestamp range]" if none are found.

DO NOT add any other text, conversation, introductions, summaries, or markdown like '***' or '### **Analysis...**'.

Example of your required output:

Error #1
Timestamp: 00:01:23
Error: Puntuation Error
Subtitle Text: Hello world
Correction: Hello, world

Error #2
Timestamp: 00:01:45
Error: Capitalization Error
Subtitle Text: it's a nice day
Correction: It's a nice day 

Deeply Analyze the entire video systematically and report ALL discrepancies found.`;







// Autofill default prompt
(function initDefaultPrompt() {
  if (!promptInput.value.trim()) promptInput.value = DEFAULT_PROMPT;
})();

// Session recovery on page load
async function recoverSession() {
  const sessionId = localStorage.getItem('activeSessionId');
  const sessionStatus = localStorage.getItem('sessionStatus');
  
  if (!sessionId || sessionStatus === 'completed' || sessionStatus === 'failed') {
    // No active session or session already completed/failed
    if (sessionId) {
      // Clean up completed/failed session
      localStorage.removeItem('activeSessionId');
      localStorage.removeItem('activeHistoryId');
      localStorage.removeItem('sessionStatus');
    }
    return;
  }
  
  // Session is active, try to recover
  try {
    const resp = await fetch(`/session/${sessionId}`);
    if (!resp.ok) {
      // Session not found on server, clear local storage
      localStorage.removeItem('activeSessionId');
      localStorage.removeItem('activeHistoryId');
      localStorage.removeItem('sessionStatus');
      return;
    }
    
    const data = await resp.json();
    
    // If session has results, load them
    if (data.resultsText && data.resultsText.length > 0) {
      resultsPre.textContent = data.resultsText;
      renderFormatted(data.resultsText);
      
      // Load video if available
      if (data.meta && data.meta.videoUrl) {
        resultVideo.src = data.meta.videoUrl;
        resultVideo.load();
        resultVideo.parentElement.classList.remove('hidden');
      } else {
        // Try to get video from historyId
        const historyId = localStorage.getItem('activeHistoryId') || data.historyId;
        if (historyId) {
          try {
            const historyResp = await fetch('/history/list');
            const historyItems = await historyResp.json();
            const entry = historyItems.find(item => item.id === historyId);
            if (entry && entry.videoUrl) {
              resultVideo.src = entry.videoUrl;
              resultVideo.load();
              resultVideo.parentElement.classList.remove('hidden');
            }
          } catch (e) {
            console.error('Failed to load video from history:', e);
          }
        }
      }
      
      // Switch to results tab
      switchTab('results');
      showToast('Session recovered. Viewing partial results...');
      
      // Show progress modal if still processing
      if (data.status === 'active' || data.status === 'queued') {
        showProgressModal();
      }
    }
    
    // If session is still active, continue polling
    if (data.status === 'active' || data.status === 'queued') {
      // Poll for updates every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          const pollResp = await fetch(`/session/${sessionId}`);
          if (!pollResp.ok) {
            clearInterval(pollInterval);
            localStorage.removeItem('activeSessionId');
            localStorage.removeItem('activeHistoryId');
            localStorage.removeItem('sessionStatus');
            return;
          }
          
          const pollData = await pollResp.json();
          
          // Update results if new content available
          if (pollData.resultsText && pollData.resultsText.length > 0) {
            resultsPre.textContent = pollData.resultsText;
            renderFormatted(pollData.resultsText);
          }
          
          // If completed, stop polling and clean up
          if (pollData.status === 'completed') {
            clearInterval(pollInterval);
            localStorage.setItem('sessionStatus', 'completed');
            hideProgressModal();
            showToast('Analysis completed!');
          } else if (pollData.status === 'failed') {
            clearInterval(pollInterval);
            localStorage.setItem('sessionStatus', 'failed');
            hideProgressModal();
            showToast('Analysis failed.');
          }
        } catch (e) {
          console.error('Error polling session:', e);
          clearInterval(pollInterval);
        }
      }, 2000);
      
      // Stop polling after 10 minutes to avoid infinite polling
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 10 * 60 * 1000);
    } else if (data.status === 'completed') {
      localStorage.setItem('sessionStatus', 'completed');
      hideProgressModal();
    } else if (data.status === 'failed') {
      localStorage.setItem('sessionStatus', 'failed');
      hideProgressModal();
    }
  } catch (e) {
    console.error('Failed to recover session:', e);
    // Clear session on error
    localStorage.removeItem('activeSessionId');
    localStorage.removeItem('activeHistoryId');
    localStorage.removeItem('sessionStatus');
  }
}

// Run session recovery on page load
document.addEventListener('DOMContentLoaded', () => {
  recoverSession();
});

// --- Helpers ---
function showToast(msg,type='info',duration=3200){
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden','toast-error','toast-show');
  if (type === 'error') {
    toast.classList.add('toast-error');
  }
  void toast.offsetWidth;
  toast.classList.add('toast-show');
  if (toastHideTimer) clearTimeout(toastHideTimer);
  if (toastRemoveTimer) clearTimeout(toastRemoveTimer);
  toastHideTimer = setTimeout(() => {
    toast.classList.remove('toast-show');
    toastRemoveTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 320);
  }, duration || 3200);
}
function bytesToSize(b){
  if(b===null||b===undefined||isNaN(b)||b<0)return'0 B';
  if(b===0)return'0 B';
  const u=['B','KB','MB','GB','TB'];
  const i=Math.floor(Math.log(b)/Math.log(1024));
  const size=Math.min(i,u.length-1);
  return`${(b/Math.pow(1024,size)).toFixed(1)} ${u[size]}`;
}
function formatSpeed(bytesPerSecond){
  if(!bytesPerSecond||!isFinite(bytesPerSecond)||bytesPerSecond<=0)return'0 MB/s';
  const units=['B/s','KB/s','MB/s','GB/s','TB/s'];
  const idx=Math.max(0,Math.min(units.length-1,Math.floor(Math.log(bytesPerSecond)/Math.log(1024))));
  const value=bytesPerSecond/Math.pow(1024,idx);
  const decimals=idx===0?0:2;
  return`${value.toFixed(decimals)} ${units[idx]}`;
}
function resetTransferStats(){
  uploadStatsState={start:null,lastTime:null,lastLoaded:0};
  if(transferStatsCard)transferStatsCard.classList.add('hidden');
  if(transferSpeedEl)transferSpeedEl.textContent='0 MB/s';
  if(transferProgressEl)transferProgressEl.textContent='0 MB / 0 MB';
  if(transferRemainingEl)transferRemainingEl.textContent='0 MB left';
}
function updateTransferStats(loaded,total,bytesPerSecond){
  if(!transferStatsCard)return;
  transferStatsCard.classList.remove('hidden');
  if(typeof bytesPerSecond==='number'&&transferSpeedEl){
    transferSpeedEl.textContent=formatSpeed(bytesPerSecond);
  }
  if(transferProgressEl){
    if(typeof total==='number'&&isFinite(total)&&total>0){
      transferProgressEl.textContent=`${bytesToSize(loaded)} / ${bytesToSize(total)}`;
    }else{
      transferProgressEl.textContent=`${bytesToSize(loaded)}`;
    }
  }
  if(transferRemainingEl){
    if(typeof total==='number'&&isFinite(total)&&total>=loaded){
      const remaining=Math.max(0,total-loaded);
      transferRemainingEl.textContent=`${bytesToSize(remaining)} left`;
    }else{
      transferRemainingEl.textContent='—';
    }
  }
}
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
function log(line){ 
  // Log function kept for compatibility
  const t=new Date().toLocaleTimeString(); 
  console.log(`[${t}] ${line}`);
}
function setUploadBar(p,l){ 
  if (uploadBar) {
    uploadBar.style.width=`${p}%`;
    // Force reflow for smooth animation
    uploadBar.offsetHeight;
  }
  if (uploadText) uploadText.textContent=l || 'Processing...';
  if (progressTitle && p >= 100) progressTitle.textContent = 'Complete!';
}
function showFileInfo(f){ if(!f){fileInfo.classList.add('hidden');return;} fileInfo.textContent=`Selected: ${f.name} (${bytesToSize(f.size)})`; fileInfo.classList.remove('hidden'); }

// Modal helpers
function showProgressModal() {
  if (progressModal) {
    resetTransferStats();
    progressModal.classList.remove('hidden');
    // Reset progress
    setUploadBar(0, 'Starting...');
    if (progressTitle) progressTitle.textContent = 'Submitting...';
    if (queueInfo) queueInfo.classList.add('hidden');
    if (uploadText) uploadText.textContent = 'Connecting to server...';
    
    // Reset stepper
    if (stepper) {
      const steps = stepper.querySelectorAll('.stepper-step');
      steps.forEach(step => {
        step.classList.remove('active', 'done');
      });
    }
  }
}

function updateQueuePosition(position) {
  if (queueNumber && queueInfo) {
    if (position > 0) {
      queueNumber.textContent = position;
      queueInfo.classList.remove('hidden');
      if (progressTitle) progressTitle.textContent = 'Queued...';
    } else {
      queueInfo.classList.add('hidden');
      if (progressTitle) progressTitle.textContent = 'Processing...';
    }
  }
}

function hideProgressModal() {
  if (progressModal) {
    progressModal.classList.add('hidden');
  }
  resetTransferStats();
}

function cancelAnalysis() {
  if (currentXhr) {
    currentXhr.abort();
    currentXhr = null;
  }
  
  // Reset UI state
  submitBtn.disabled = false;
  setUploadBar(0, 'Cancelled');
  resetTransferStats();
  
  // Mark session as cancelled/failed
  localStorage.setItem('sessionStatus', 'failed');
  
  // Hide modal
  hideProgressModal();
  
  // Show toast notification
  showToast('Analysis cancelled');
}

function updateStepper(stepName) {
  if (!stepper) return;
  const steps = stepper.querySelectorAll('.stepper-step');
  
  // Map server steps to UI steps
  const stepMapping = {
    'yt': 'upload',
    'upload': 'upload',
    'waiting': 'process',
    'active': 'process',
    'split': 'process',
    'stream': 'analyze',
    'complete': 'complete'
  };
  
  const uiStepName = stepMapping[stepName] || stepName;
  let found = false;
  
  steps.forEach((step, index) => {
    const stepData = step.getAttribute('data-step');
    if (stepData === uiStepName) {
      found = true;
      step.classList.add('active');
      step.classList.remove('done');
      // Mark previous steps as done
      for (let i = 0; i < index; i++) {
        steps[i].classList.add('done');
        steps[i].classList.remove('active');
      }
    } else if (found) {
      step.classList.remove('active', 'done');
    }
  });
}

// --- Mode + theme ---
let CURRENT_MODE='idle';
(function initTheme(){const saved=localStorage.getItem('vat-theme');if(saved)document.documentElement.setAttribute('data-theme',saved);})();
themeToggle.addEventListener('click',()=>{const cur=document.documentElement.getAttribute('data-theme')||'dark';const next=cur==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',next);localStorage.setItem('vat-theme',next);});

// --- Pointer Particles Toggle ---
(function initParticlesToggle() {
  // Default state: OFF (disabled)
  const savedState = localStorage.getItem('pointer-particles-enabled');
  const isEnabled = savedState === 'true';
  
  if (pointerParticlesElement) {
    // Hide particles by default (OFF state)
    pointerParticlesElement.style.display = isEnabled ? 'grid' : 'none';
    
    if (particlesToggle) {
      // Set toggle state based on saved preference
      if (isEnabled) {
        particlesToggle.classList.add('active');
      } else {
        particlesToggle.classList.remove('active');
      }
    }
    
    // If no saved state exists, explicitly set to OFF
    if (savedState === null) {
      localStorage.setItem('pointer-particles-enabled', 'false');
    }
  }
})();

particlesToggle?.addEventListener('click', () => {
  const isActive = particlesToggle.classList.contains('active');
  
  if (pointerParticlesElement) {
    if (isActive) {
      // Turn OFF
      pointerParticlesElement.style.display = 'none';
      particlesToggle.classList.remove('active');
      localStorage.setItem('pointer-particles-enabled', 'false');
    } else {
      // Turn ON
      pointerParticlesElement.style.display = 'grid';
      particlesToggle.classList.add('active');
      localStorage.setItem('pointer-particles-enabled', 'true');
    }
  }
});

// --- History Panel ---
function closeHistoryPanel() {
  if(!historyPanel) return;
  historyPanel.classList.add('hidden');
  document.body.classList.remove('history-panel-open');
}

function openHistoryPanel() {
  if(!historyPanel) return;
  historyPanel.classList.remove('hidden');
  document.body.classList.add('history-panel-open');
  loadHistory();
  loadStorage();
}

historyToggle?.addEventListener('click',()=>{
  if(!historyPanel)return;
  const hidden=historyPanel.classList.contains('hidden');
  if(hidden) {
    openHistoryPanel();
  } else {
    closeHistoryPanel();
  }
});

historyCloseBtn?.addEventListener('click', () => {
  closeHistoryPanel();
});

// Close history panel when clicking outside of it
document.addEventListener('click', (e) => {
  if (!historyPanel) return;
  
  // Don't close if panel is already hidden
  if (historyPanel.classList.contains('hidden')) return;
  
  // Don't close if clicking inside the history panel
  if (historyPanel.contains(e.target)) return;
  
  // Don't close if clicking the history toggle button (it has its own toggle logic)
  if (historyToggle && historyToggle.contains(e.target)) return;
  
  // Close the panel
  closeHistoryPanel();
});

// Close history item menu dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.history-item-menu')) {
    document.querySelectorAll('.history-item-menu-dropdown').forEach(dd => {
      dd.classList.add('hidden');
    });
  }
});

async function loadHistory(){
  try{
    const resp=await fetch('/history/list');
    const items=await resp.json();
    renderHistory(items||[]);
    await loadStorage(); 
  }catch(e){console.error(e);}
}

async function loadStorage(){
  try{
    const resp=await fetch('/history/storage');
    const data=await resp.json();
    const usedBytes=typeof data.used==='number'?data.used:0;
    const totalBytes=typeof data.total==='number'?data.total:(20*1024*1024*1024);
    const used=bytesToSize(usedBytes);
    const total=bytesToSize(totalBytes);
    const storageValue=document.getElementById('storageValue');
    if(storageValue) storageValue.textContent=`${used || '0 B'} / ${total || '20.0 GB'}`;
    
    // Update storage progress bar
    const storageProgressBar=document.getElementById('storageProgressBar');
    if(storageProgressBar && totalBytes > 0){
      const percentage=Math.min(100,Math.max(0,(usedBytes/totalBytes)*100));
      storageProgressBar.style.width=`${percentage}%`;
      
      // Add color classes based on usage
      storageProgressBar.classList.remove('warning','danger');
      if(percentage>=90){
        storageProgressBar.classList.add('danger');
      }else if(percentage>=75){
        storageProgressBar.classList.add('warning');
      }
    }
  }catch(e){
    console.error('Failed to load storage:',e);
    const storageValue=document.getElementById('storageValue');
    if(storageValue) storageValue.textContent='0 B / 20.0 GB';
    const storageProgressBar=document.getElementById('storageProgressBar');
    if(storageProgressBar) storageProgressBar.style.width='0%';
  }
}

function renderHistory(items){
  if(!historyList)return;
  historyList.innerHTML='';
  items.forEach(item=>{
    const itemDiv=document.createElement('div');
    itemDiv.className='history-item';
    itemDiv.setAttribute('data-history-id', item.id);
    
    const nameSpan=document.createElement('span');
    nameSpan.className='history-item-name';
    nameSpan.textContent=item.name||item.id;
    nameSpan.title=item.name||item.id;
    nameSpan.addEventListener('click',()=>loadHistoryItem(item));
    
    const menuDiv=document.createElement('div');
    menuDiv.className='history-item-menu';
    
    const menuBtn=document.createElement('button');
    menuBtn.className='history-item-menu-btn';
    menuBtn.setAttribute('aria-label','Menu');
    menuBtn.textContent='⋯';
    menuBtn.addEventListener('click',(e)=>{
      e.stopPropagation();
      // Close all other dropdowns
      document.querySelectorAll('.history-item-menu-dropdown').forEach(dd=>{
        if(dd!==menuDropdown) dd.classList.add('hidden');
      });
      menuDropdown.classList.toggle('hidden');
    });
    
    const menuDropdown=document.createElement('div');
    menuDropdown.className='history-item-menu-dropdown hidden';
    
    const shareBtn=document.createElement('button');
    shareBtn.className='history-item-menu-item share-btn';
    shareBtn.innerHTML='<span class="history-item-menu-item-icon">🔗</span><span>Share</span>';
    shareBtn.addEventListener('click',(e)=>{
      e.stopPropagation();
      menuDropdown.classList.add('hidden');
      shareHistoryItem(item);
    });
    
    const deleteBtn=document.createElement('button');
    deleteBtn.className='history-item-menu-item delete-btn';
    deleteBtn.innerHTML='<span class="history-item-menu-item-icon">🗑</span><span>Delete</span>';
    deleteBtn.addEventListener('click',(e)=>{
      e.stopPropagation();
      menuDropdown.classList.add('hidden');
      deleteHistoryItem(item);
    });
    
    menuDropdown.appendChild(shareBtn);
    menuDropdown.appendChild(deleteBtn);
    menuDiv.appendChild(menuBtn);
    menuDiv.appendChild(menuDropdown);
    
    itemDiv.appendChild(nameSpan);
    itemDiv.appendChild(menuDiv);
    
    itemDiv.addEventListener('click',(e)=>{
      if(!e.target.closest('.history-item-menu')){
        loadHistoryItem(item);
      }
    });
    
    historyList.appendChild(itemDiv);
  });
}

async function deleteHistoryItem(item){
  if(!confirm(`Are you sure you want to delete "${item.name||item.id}"?`)) return;
  
  // Find the DOM element for this item
  const itemElement = historyList?.querySelector(`[data-history-id="${item.id}"]`);
  
  try{
    const resp=await fetch(`/history/${item.id}`,{
      method:'DELETE'
    });
    const data=await resp.json();
    if(resp.ok){
      // Immediately remove from DOM with animation
      if(itemElement){
        itemElement.style.transition = 'opacity 0.2s, transform 0.2s';
        itemElement.style.opacity = '0';
        itemElement.style.transform = 'translateX(-20px)';
        setTimeout(() => {
          itemElement.remove();
        }, 200);
      }
      showToast('History item deleted');
      // Refresh history in background to update storage info
      loadHistory(); 
    }else{
      showToast(data.error||'Failed to delete');
    }
  }catch(e){
    console.error(e);
    showToast('Failed to delete history item');
  }
}

async function shareHistoryItem(item){
  try{
    const shareData={
      title:item.name||item.id,
      text:`Video Analysis: ${item.name||item.id}`,
      url:window.location.origin+item.resultsUrl
    };
    if(navigator.share){
      await navigator.share(shareData);
    }else{
      
      await navigator.clipboard.writeText(shareData.url);
      showToast('Results URL copied to clipboard');
    }
  }catch(e){
    if(e.name!=='AbortError'){
      console.error(e);
      showToast('Share failed');
    }
  }
}

async function loadHistoryItem(item){
  try{
    const resTxt=await fetch(item.resultsUrl).then(r=>r.text());
    resultsPre.textContent=resTxt;
    renderFormatted(resTxt);
    if(item.videoUrl){
      resultVideo.src=item.videoUrl;
      resultVideo.load();
    }
    switchTab('results');
    showToast('Loaded from history');
  }catch(e){console.error(e);showToast('Failed to load history item');}
}

;
browseBtn.addEventListener('click',(e)=>{
  e.stopPropagation(); 
  videoInput.click();
});

dropZone.addEventListener('click',()=>videoInput.click());
['dragenter','dragover'].forEach(evn=>dropZone.addEventListener(evn,e=>{e.preventDefault();dropZone.classList.add('drag');}));
['dragleave','drop'].forEach(evn=>dropZone.addEventListener(evn,e=>{e.preventDefault();if(evn==='drop'){const f=e.dataTransfer?.files?.[0];if(f){videoInput.files=e.dataTransfer.files;videoInput.dispatchEvent(new Event('change'));}}dropZone.classList.remove('drag');}));
// if(urlInput)urlInput.addEventListener('input',()=>{CURRENT_MODE=urlInput.value.trim()?'url':'idle';});


videoInput.addEventListener('change', () => {
  const f = videoInput.files?.[0];
  if (f && f.size > MAX_UPLOAD_SIZE_BYTES) {
    showToast(`File exceeds 2 GB limit (${bytesToSize(f.size)}).`, 'error');
    videoInput.value = '';
    showFileInfo(null);
    if (videoObjectURL) {
      URL.revokeObjectURL(videoObjectURL);
      videoObjectURL = null;
    }
    CURRENT_MODE = 'idle';
    return;
  }
  showFileInfo(f);
  if (f) {
    CURRENT_MODE = 'file';
    if (videoObjectURL) {
      URL.revokeObjectURL(videoObjectURL);
    }
    videoObjectURL = URL.createObjectURL(f);
  }
});



function renderFormatted(text) {
 
  const sections = text.split(/\n#{3}\s Window\s+\d+\s \([^)]+\)\s \n/i);
 
  const content = sections.length > 1 ? sections.slice(1).join('\n') : text;

  
  const blocks = content.split(/Error\s*#\d+/i).slice(1);
  let html = '';
  let foundErrors = 0;

  if (blocks.length > 0) {
    blocks.forEach((block, i) => {
      
      const cleanBlock = block.trim().split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('***') &&
               !trimmed.startsWith('###') && 
               !trimmed.toLowerCase().startsWith('excellent') && 
               !trimmed.toLowerCase().startsWith('based on'); 
      }).join('\n');
      
      if (!cleanBlock) return; 

      const lines = cleanBlock.trim().split('\n');
      
      // --- START REPLACEMENT ---
      // 1. Parse the data from the block
      let errorData = {
        timestamp: '',
        errorType: '',
        subtitleText: '',
        correction: ''
      };

      lines.forEach(line => {
        const l = line.toLowerCase();
        if (l.startsWith('timestamp:')) {
          errorData.timestamp = line.substring(10).trim();
        } else if (l.startsWith('error:')) {
          errorData.errorType = line.substring(6).trim();
        } else if (l.startsWith('subtitle text:')) {
          errorData.subtitleText = line.substring(14).trim();
        } else if (l.startsWith('correction:')) {
          errorData.correction = line.substring(11).trim();
        }
      });

      // 2. Find timestamp for seeking
      let timestampInSeconds = '0';
      if (errorData.timestamp) {
        const match = errorData.timestamp.match(/(\d{1,2}:\d{2}:\d{2})|(\d{1,2}:\d{2})/);
        if (match && match[0]) {
          const parts = match[0].split(':').map(Number);
          if (parts.length === 3) { 
            timestampInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          } else if (parts.length === 2) { 
            timestampInSeconds = parts[0] * 60 + parts[1];
          }
        }
      }
      
      // 3. Build the new HTML
      const headerTitle = `Error #${i + 1}${errorData.errorType ? ': ' + escapeHtml(errorData.errorType) : ''}`;
      
      // Create timestamp HTML to add to the header
      const timestampHTML = errorData.timestamp 
          ? `<div class="error-card-timestamp">${escapeHtml(errorData.timestamp)}</div>` 
          : '';
      
      // Create error tags/pills
      const errorTagsHTML = `
        <div class="error-tag-container">
          ${errorData.errorType ? `
            <div class="error-tag error-type" title="Error Type">
              <span class="error-tag-icon">⚠</span>
              <span class="error-tag-label">${escapeHtml(errorData.errorType)}</span>
            </div>
          ` : ''}
          ${errorData.timestamp ? `
            <div class="error-tag" title="Timestamp">
              <span class="error-tag-icon">⏱</span>
              <span class="error-tag-timestamp">${escapeHtml(errorData.timestamp)}</span>
            </div>
          ` : ''}
        </div>`;
      
      const subtitleHTML = `
        <div class="error-card-column subtitle">
          <div class="error-label">Subtitle Text</div>
          <div class="error-text">${escapeHtml(errorData.subtitleText || '(none)')}</div>
        </div>`;

      const correctionHTML = `
        <div class="error-card-column correction">
          <div class="error-label">Correction</div>
          <div class="error-text">${escapeHtml(errorData.correction || '(none)')}</div>
        </div>`;

      // 4. The main card HTML (UPDATED)
      html += `
        <div class="error-card glass" data-timestamp="${timestampInSeconds}" data-error-index="${i}">
          <div class="error-card-header">
            <div class="error-card-header-content">
              <div class="mono" style="font-weight:600;" title="${headerTitle}">${headerTitle}</div>
              ${errorTagsHTML}
            </div>
            <div class="error-card-menu">
              <button class="error-card-menu-btn" aria-label="Menu">⋯</button>
              <div class="error-card-menu-dropdown hidden">
                <button class="error-card-menu-item edit-btn" data-error-index="${i}">
                  <span class="error-card-menu-item-icon">✏️</span>
                  <span>Edit</span>
                </button>
                <button class="error-card-menu-item delete-btn" data-error-index="${i}">
                  <span class="error-card-menu-item-icon">🗑️</span>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>

          <div class="error-card-body">
            ${subtitleHTML}
            ${correctionHTML}
          </div>
        </div>`;
      // --- END REPLACEMENT ---

      foundErrors++;
    });
  }
  
  
  if (foundErrors === 0) {
     
     const cleanContent = content.trim().split('\n').filter(line => {
        const trimmed = line.trim().toLowerCase();
        return (trimmed.includes('no issues') || trimmed.includes('no discrepancies')) && 
               !trimmed.startsWith('###') && 
               !trimmed.startsWith('***');
     }).join('<br>');

     if (cleanContent) {
        html = `<div style="opacity:.9;">${cleanContent}</div>`;
     } else {
        html = `<div style="opacity:.9;">No errors or actionable items found in the analysis.</div>`;
     }
  }

  summaryDiv.innerHTML = html;

  // Setup error card interactions
  document.querySelectorAll('.error-card').forEach(card => {
    // Card click handler (seek video) - but not when clicking menu
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking menu or menu items
      if (e.target.closest('.error-card-menu')) return;
      
      const time = parseFloat(card.dataset.timestamp);
      if (!isNaN(time) && resultVideo) {
        resultVideo.currentTime = time;
        // resultVideo.play();
      }
    });

    // Menu button click handler
    const menuBtn = card.querySelector('.error-card-menu-btn');
    const dropdown = card.querySelector('.error-card-menu-dropdown');
    
    if (menuBtn && dropdown) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close all other dropdowns
        document.querySelectorAll('.error-card-menu-dropdown').forEach(dd => {
          if (dd !== dropdown) dd.classList.add('hidden');
        });
        dropdown.classList.toggle('hidden');
      });

      // Edit button handler
      const editBtn = card.querySelector('.edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.add('hidden');
          editErrorCard(card);
        });
      }

      // Delete button handler
      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.add('hidden');
          deleteErrorCard(card);
        });
      }
    }
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.error-card-menu')) {
      document.querySelectorAll('.error-card-menu-dropdown').forEach(dd => {
        dd.classList.add('hidden');
      });
    }
  });
}

// Function to edit an error card
function editErrorCard(card) {
  const errorIndex = parseInt(card.dataset.errorIndex);
  const bodyDiv = card.querySelector('.error-card-body');
  const originalHTML = bodyDiv.innerHTML;
  
  // Parse current error data from new structure
  const errorData = {};
  
  // Get timestamp from tag if it exists
  const timestampTag = card.querySelector('.error-card-header .error-tag-timestamp');
  if (timestampTag) {
    errorData.timestamp = timestampTag.textContent.trim();
  }
  
  // Get error type from header or tag
  const headerDiv = card.querySelector('.error-card-header .mono');
  if (headerDiv) {
    const headerText = headerDiv.textContent;
    if (headerText.includes(':')) {
      errorData.errorType = headerText.split(':')[1]?.trim() || '';
    }
  }
  
  // Also try to get error type from tag
  const errorTypeTag = card.querySelector('.error-card-header .error-tag.error-type .error-tag-label');
  if (errorTypeTag && !errorData.errorType) {
    errorData.errorType = errorTypeTag.textContent.trim();
  }
  
  // Get subtitle text from subtitle column
  const subtitleColumn = card.querySelector('.error-card-column.subtitle .error-text');
  if (subtitleColumn) {
    errorData.subtitleText = subtitleColumn.textContent.trim();
  }
  
  // Get correction from correction column
  const correctionColumn = card.querySelector('.error-card-column.correction .error-text');
  if (correctionColumn) {
    errorData.correction = correctionColumn.textContent.trim();
  }

  // Create edit form
  const editForm = `
    <div class="error-edit-form">
      <div class="error-edit-field">
        <label>Timestamp:</label>
        <input type="text" class="error-edit-input" value="${escapeHtml(errorData.timestamp || '')}" data-field="timestamp">
      </div>
      <div class="error-edit-field">
        <label>Error Type:</label>
        <input type="text" class="error-edit-input" value="${escapeHtml(errorData.errorType || '')}" data-field="errorType">
      </div>
      <div class="error-edit-field">
        <label>Subtitle Text:</label>
        <textarea class="error-edit-input" data-field="subtitleText">${escapeHtml(errorData.subtitleText || '')}</textarea>
      </div>
      <div class="error-edit-field">
        <label>Correction:</label>
        <textarea class="error-edit-input" data-field="correction">${escapeHtml(errorData.correction || '')}</textarea>
      </div>
      <div class="error-edit-actions">
        <button class="btn primary error-save-btn">Save</button>
        <button class="btn ghost error-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  
  bodyDiv.innerHTML = editForm;
  
  // Save button handler
  const saveBtn = bodyDiv.querySelector('.error-save-btn');
  const cancelBtn = bodyDiv.querySelector('.error-cancel-btn');
  
  saveBtn.addEventListener('click', () => {
    const inputs = bodyDiv.querySelectorAll('.error-edit-input');
    const newData = {};
    
    inputs.forEach(input => {
      const field = input.dataset.field;
      newData[field] = input.value.trim();
    });
    
    // --- START REPLACEMENT ---
    // Rebuild error card HTML in the new format
    const subtitleHTML = `
      <div class="error-card-column subtitle">
        <div class="error-label">Subtitle Text</div>
        <div class="error-text">${escapeHtml(newData.subtitleText || '(none)')}</div>
      </div>`;

    const correctionHTML = `
      <div class="error-card-column correction">
        <div class="error-label">Correction</div>
        <div class="error-text">${escapeHtml(newData.correction || '(none)')}</div>
      </div>`;
    
    bodyDiv.innerHTML = subtitleHTML + correctionHTML;
    // Re-add grid class
    bodyDiv.classList.add('error-card-body'); 
    
    // Update header title
    const headerContentDiv = card.querySelector('.error-card-header-content');
    if (!headerContentDiv) {
      // If header-content doesn't exist, create it
      const headerDiv = card.querySelector('.error-card-header');
      const titleDiv = headerDiv.querySelector('.mono');
      if (titleDiv) {
        const headerContent = document.createElement('div');
        headerContent.className = 'error-card-header-content';
        headerDiv.insertBefore(headerContent, titleDiv.nextSibling);
        headerContent.appendChild(titleDiv);
      }
    }
    
    // Rebuild tags
    const tagContainer = card.querySelector('.error-tag-container');
    if (tagContainer) {
      tagContainer.innerHTML = '';
      
      if (newData.errorType) {
        const errorTypeTag = document.createElement('div');
        errorTypeTag.className = 'error-tag error-type';
        errorTypeTag.title = 'Error Type';
        errorTypeTag.innerHTML = `
          <span class="error-tag-icon">⚠</span>
          <span class="error-tag-label">${escapeHtml(newData.errorType)}</span>
        `;
        tagContainer.appendChild(errorTypeTag);
      }
      
      if (newData.timestamp) {
        const timestampTag = document.createElement('div');
        timestampTag.className = 'error-tag';
        timestampTag.title = 'Timestamp';
        timestampTag.innerHTML = `
          <span class="error-tag-icon">⏱</span>
          <span class="error-tag-timestamp">${escapeHtml(newData.timestamp)}</span>
        `;
        tagContainer.appendChild(timestampTag);
      }
    } else {
      // Create tag container if it doesn't exist
      const headerContentDiv = card.querySelector('.error-card-header-content');
      if (headerContentDiv) {
        const tagContainer = document.createElement('div');
        tagContainer.className = 'error-tag-container';
        
        if (newData.errorType) {
          const errorTypeTag = document.createElement('div');
          errorTypeTag.className = 'error-tag error-type';
          errorTypeTag.title = 'Error Type';
          errorTypeTag.innerHTML = `
            <span class="error-tag-icon">⚠</span>
            <span class="error-tag-label">${escapeHtml(newData.errorType)}</span>
          `;
          tagContainer.appendChild(errorTypeTag);
        }
        
        if (newData.timestamp) {
          const timestampTag = document.createElement('div');
          timestampTag.className = 'error-tag';
          timestampTag.title = 'Timestamp';
          timestampTag.innerHTML = `
            <span class="error-tag-icon">⏱</span>
            <span class="error-tag-timestamp">${escapeHtml(newData.timestamp)}</span>
          `;
          tagContainer.appendChild(timestampTag);
        }
        
        headerContentDiv.appendChild(tagContainer);
      }
    }
    
    // Update header title
    const titleDiv = card.querySelector('.error-card-header .mono');
    if (titleDiv) {
      const errorNum = card.dataset.errorIndex ? parseInt(card.dataset.errorIndex) + 1 : '?';
      const newHeaderTitle = `Error #${errorNum}${newData.errorType ? ': ' + escapeHtml(newData.errorType) : ''}`;
      titleDiv.textContent = newHeaderTitle;
      titleDiv.title = newHeaderTitle;
    }
    // --- END REPLACEMENT ---
    
    // Update timestamp attribute if changed
    if (newData.timestamp) {
      const match = newData.timestamp.match(/(\d{1,2}):(\d{2}):(\d{2})|(\d{1,2}):(\d{2})/);
      if (match) {
        const parts = match[0].split(':').map(Number);
        let seconds = 0;
        if (parts.length === 3) {
          seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          seconds = parts[0] * 60 + parts[1];
        }
        card.dataset.timestamp = seconds.toString();
      }
    }
    
    // Update results text
    updateResultsText();
    showToast('Error updated');
  });
  
  cancelBtn.addEventListener('click', () => {
    bodyDiv.innerHTML = originalHTML;
  });
}

// Function to delete an error card
function deleteErrorCard(card) {
  if (!confirm('Are you sure you want to delete this error?')) {
    return;
  }
  
  card.style.transition = 'opacity 0.3s, transform 0.3s';
  card.style.opacity = '0';
  card.style.transform = 'translateX(-20px)';
  
  setTimeout(() => {
    card.remove();
    updateResultsText();
    showToast('Error deleted');
    
    // Re-render to update error numbers
    renderFormatted(resultsPre.textContent);
  }, 300);
}

// Function to update results text from current error cards
function updateResultsText() {
  const cards = document.querySelectorAll('.error-card');
  const sections = resultsPre.textContent.split(/\n#{3}\s Window\s+\d+\s \([^)]+\)\s \n/i);
  const header = sections.length > 1 ? sections[0] + '\n' : '';
  
  let newResults = header;
  let errorNumber = 1;
  
  cards.forEach(card => {
    // Extract data from new structure
    const timestampTag = card.querySelector('.error-card-header .error-tag-timestamp');
    const headerDiv = card.querySelector('.error-card-header .mono');
    const subtitleColumn = card.querySelector('.error-card-column.subtitle .error-text');
    const correctionColumn = card.querySelector('.error-card-column.correction .error-text');
    
    if (!headerDiv) return;
    
    // Parse error type from header
    const headerText = headerDiv.textContent;
    let errorType = '';
    if (headerText.includes(':')) {
      errorType = headerText.split(':')[1]?.trim() || '';
    }
    
    // Also try to get error type from tag if not found in header
    if (!errorType) {
      const errorTypeTag = card.querySelector('.error-card-header .error-tag.error-type .error-tag-label');
      if (errorTypeTag) {
        errorType = errorTypeTag.textContent.trim();
      }
    }
    
    const timestamp = timestampTag ? timestampTag.textContent.trim() : '';
    const subtitleText = subtitleColumn ? subtitleColumn.textContent.trim() : '';
    const correction = correctionColumn ? correctionColumn.textContent.trim() : '';
    
    newResults += `Error #${errorNumber}\n`;
    if (timestamp) newResults += `Timestamp: ${timestamp}\n`;
    if (errorType) newResults += `Error: ${errorType}\n`;
    if (subtitleText && subtitleText !== '(none)') newResults += `Subtitle Text: ${subtitleText}\n`;
    if (correction && correction !== '(none)') newResults += `Correction: ${correction}\n`;
    newResults += '\n';
    
    errorNumber++;
  });
  
  // Add remaining content after errors if any
  if (sections.length > 1) {
    const remaining = sections.slice(1).join('\n').split(/Error\s*#\d+/i);
    if (remaining.length > 1) {
      newResults += remaining.slice(1).join('');
    }
  }
  
  resultsPre.textContent = newResults.trim();
}





newAnalysisBtn.addEventListener('click', () => {
  // videoInput.value='';if(urlInput)urlInput.value='';promptInput.value=DEFAULT_PROMPT;fileInfo.classList.add('hidden');
  setUploadBar(0,'Idle');resultsPre.textContent='';summaryDiv.innerHTML='';
  resultVideo.src = '';
  if (videoObjectURL) {
    URL.revokeObjectURL(videoObjectURL);
    videoObjectURL = null;
  }
  switchTab('analysis');
  showToast('Ready for new analysis.');
});

clearBtn.addEventListener('click',()=>{
  // videoInput.value='';if(urlInput)urlInput.value='';promptInput.value=DEFAULT_PROMPT;fileInfo.classList.add('hidden');
  setUploadBar(0,'Idle');resultsPre.textContent='';summaryDiv.innerHTML='';
  resultVideo.src = '';
  if (videoObjectURL) {
    URL.revokeObjectURL(videoObjectURL);
    videoObjectURL = null;
  }
  showToast('Cleared.');
});
copyBtn.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(resultsPre.textContent||'');showToast('Copied.');}catch{showToast('Copy failed.');}});
saveBtn.addEventListener('click',()=>{const blob=new Blob([resultsPre.textContent||''],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`gemini-analysis-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;document.body.appendChild(a);a.click();a.remove();});

function exportAsDocFromHTML() {
  const title = 'Subtitle QA — Discrepancy Report';
  const now = new Date().toLocaleString();
  const htmlContent = summaryDiv.innerHTML && summaryDiv.innerHTML.trim()
    ? summaryDiv.innerHTML
    : (resultsPre.textContent || '').replace(/\n/g,'<br>');

  const docHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color:#111; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { color:#444; margin-bottom: 12px; }
    .card { border:1px solid #ccc; border-radius:6px; padding:10px; margin:8px 0; }
    .mono { font-family: Consolas, 'Courier New', monospace; }
  </style>
  </head><body>
    <h1>${title}</h1>
    <div class="meta">Generated: ${now}</div>
    <div>${htmlContent}</div>
  </body></html>`;

  const blob = new Blob([docHTML], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Subtitle_QA_${new Date().toISOString().replace(/[:.]/g,'-')}.doc`;
  document.body.appendChild(a); a.click(); a.remove();
}

// Export formatted results to .docx (fallback to .doc if library missing)
downloadDocxBtn.addEventListener('click', async () => {
  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx || {};
    if (!Document) { exportAsDocFromHTML(); return; }

    const doc = new Document({ sections: [{ properties: {}, children: [] }] });
    const children = [];

    children.push(new Paragraph({ text: 'Subtitle QA — Discrepancy Report', heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph('Generated: ' + new Date().toLocaleString()));
    children.push(new Paragraph(' '));

    // Build from current rendered cards
    const html = summaryDiv.innerHTML;
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const cards = Array.from(tmp.querySelectorAll('.error-card'));

    if (cards.length === 0) {
      children.push(new Paragraph('No formatted errors detected.'));
      const raw = resultsPre.textContent || '';
      if (raw) children.push(new Paragraph(raw));
    } else {
      cards.forEach((card, idx) => {
        const lines = Array.from(card.querySelectorAll('div')).map(d => d.textContent);
        children.push(new Paragraph({ text: `Error #${idx + 1}`, heading: HeadingLevel.HEADING_2 }));
        lines.forEach(line => children.push(new Paragraph({ children: [new TextRun({ text: line })] })));
        children.push(new Paragraph(' '));
      });
    }

    doc.addSection({ children });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Subtitle_QA_${new Date().toISOString().replace(/[:.]/g,'-')}.docx`;
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) {
    console.error(e);
    // Try HTML->.doc fallback if docx path failed at runtime
    try { exportAsDocFromHTML(); }
    catch { showToast('DOC export failed.'); }
  }
});


form.addEventListener('submit',e=>{
  e.preventDefault();

  // Clear previous results
  resultsPre.textContent='';
  summaryDiv.innerHTML='';
  // statusLog removed from UI

  const hasFile=videoInput.files&&videoInput.files.length>0;
  const hasUrl=false; // URL input is disabled
  if(!promptInput.value.trim())return showToast('Please enter prompt.');
  if(hasFile&&hasUrl)return showToast('Provide only one input.');
  if(!hasFile&&!hasUrl)return showToast('Upload a video or URL.');
  if (hasFile && videoInput.files[0].size > MAX_UPLOAD_SIZE_BYTES) {
    showToast('Selected file exceeds the 2 GB limit.', 'error');
    return;
  }

  // Show progress modal
  showProgressModal();

  // Set initial step based on input type
  if (hasUrl) {
    updateStepper('yt');
  } else {
    updateStepper('upload');
  }

  // Set up video for results tab
  resultVideo.parentElement.classList.remove('hidden'); 
  if (hasFile && videoObjectURL) {
    resultVideo.src = videoObjectURL;
  }
  // For YouTube URLs, we'll load the video from history after analysis completes

  // Generate new sessionId for this analysis (clear old one)
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  localStorage.setItem('activeSessionId', sessionId);
  localStorage.setItem('sessionStatus', 'active'); // Mark session as active
  localStorage.removeItem('activeHistoryId'); // Clear old historyId

  const fd=new FormData();
  fd.append('prompt',promptInput.value.trim());
  fd.append('sessionId', sessionId);
  if(hasFile)fd.append('video',videoInput.files[0]);

  submitBtn.disabled=true;
  const xhr=new XMLHttpRequest();xhr.open('POST','/upload');
  
  // Store XHR reference for cancellation
  currentXhr = xhr;
  
  // Upload progress only for file uploads (not YouTube URLs)
  let uploadInProgress = false;
  let uploadComplete = false;
  if (hasFile) {
    resetTransferStats();
    xhr.upload.onprogress=evt=>{
      if(evt.lengthComputable){
        uploadInProgress = true;
        const uploadPercent = Math.floor((evt.loaded/evt.total)*100);
        // Map upload progress to section 1 (0-25%)
        // Upload takes up 85% of section 1 (0-21.25% of total)
        const uploadProgress = Math.min(85, Math.floor((evt.loaded/evt.total)*85));
        const totalPct = Math.floor((uploadProgress / 100) * 25); // Map to 0-25% range
        setUploadBar(totalPct, `Uploading…`);
        updateStepper('upload');

        const now=performance.now();
        if(!uploadStatsState.start)uploadStatsState.start=now;
        let bytesPerSecond=0;
        if(uploadStatsState.lastTime!==null){
          const deltaTime=(now-uploadStatsState.lastTime)/1000;
          const deltaBytes=evt.loaded-uploadStatsState.lastLoaded;
          if(deltaTime>0&&deltaBytes>=0)bytesPerSecond=deltaBytes/deltaTime;
        }
        if(!bytesPerSecond||!isFinite(bytesPerSecond)){
          const elapsed=(now-uploadStatsState.start)/1000;
          if(elapsed>0)bytesPerSecond=evt.loaded/elapsed;
        }
        updateTransferStats(evt.loaded,evt.total,bytesPerSecond);
        uploadStatsState.lastLoaded=evt.loaded;
        uploadStatsState.lastTime=now;
        
        // Mark upload as complete when it reaches 100%
        if (uploadPercent >= 100) {
          uploadInProgress = false;
          uploadComplete = true;
        }
      }else {
        uploadInProgress = true;
        setUploadBar(5,'Uploading…');
        updateStepper('upload');
        updateTransferStats(evt.loaded||uploadStatsState.lastLoaded||0,undefined,0);
      }
    };
    
    // Also check on upload complete
    xhr.upload.onload = () => {
      uploadInProgress = false;
      uploadComplete = true;
      const loaded=uploadStatsState.lastLoaded||videoInput.files?.[0]?.size||0;
      updateTransferStats(loaded,loaded,0);
    };
  }

  let last=0;
  let queueChecked = false;
  let sessionIdReceived = null;
  let historyIdReceived = null;
  
  xhr.onprogress=()=>{
    const chunk=xhr.responseText.substring(last);
    last=xhr.responseText.length;
    if(!chunk)return;

    // Check for sessionId and historyId (sent early by server)
    if (!sessionIdReceived) {
      const sessionMatch = chunk.match(/\[SESSION_ID:([^\]]+)\]/);
      if (sessionMatch) {
        sessionIdReceived = sessionMatch[1];
        localStorage.setItem('activeSessionId', sessionIdReceived);
      }
    }
    if (!historyIdReceived) {
      const historyMatch = chunk.match(/\[HISTORY_ID:([^\]]+)\]/);
      if (historyMatch) {
        historyIdReceived = historyMatch[1];
        localStorage.setItem('activeHistoryId', historyIdReceived);
      }
    }

    // Check for queue position
    const queueMatch = chunk.match(/\[QUEUE_POSITION:(\d+)\]/);
    if (queueMatch && !queueChecked) {
      queueChecked = true;
      const position = parseInt(queueMatch[1], 10);
      updateQueuePosition(position);
    }

    // Parse PROGRESS markers before stripping them (real-time updates)
    const progressMatches = chunk.match(/\[PROGRESS:({.*?})\]/g);
    if (progressMatches) {
      progressMatches.forEach(match => {
        try {
          const jsonStr = match.replace(/\[PROGRESS:|]/g, '');
          const progress = JSON.parse(jsonStr);
          
          // Real-time progress bar update
          if (progress.pct !== undefined) {
            // For file uploads, only use server progress after upload completes
            // (when progress is beyond section 1 or upload is done)
            if (hasFile && uploadInProgress && !uploadComplete && progress.pct < 25) {
              // Still uploading, let XHR progress handle it
              return;
            }
            
            // Once upload is complete, always use server progress
            if (hasFile && uploadComplete) {
              uploadInProgress = false;
            }
            
            // Use server progress updates
            const statusText = progress.label || 'Processing...';
            setUploadBar(progress.pct, statusText);
            
            // Hide queue info once processing starts
            if (progress.pct > 0 && queueInfo) {
              queueInfo.classList.add('hidden');
              // Update title based on phase
              if (progress.pct >= 75) {
                if (progressTitle) progressTitle.textContent = 'Completing...';
              } else if (progress.pct >= 50) {
                if (progressTitle) progressTitle.textContent = 'Analyzing...';
              } else if (progress.pct >= 25) {
                if (progressTitle) progressTitle.textContent = 'Processing...';
              } else {
                if (progressTitle) progressTitle.textContent = 'Uploading...';
              }
            }
          }
          if (progress.step) {
            updateStepper(progress.step);
          }
        } catch (e) {
          console.error('Failed to parse progress:', e);
        }
      });
    }

    // Strip backend meta markers from user-visible results
    const cleanChunk = chunk
      .replace(/\[PROGRESS:({.*?})\]/g,'')
      .replace(/\[OFFSET_SECONDS:\d+\]/g,'')
      .replace(/\[QUEUE_POSITION:\d+\]/g,'')
      .replace(/\[SESSION_ID:[^\]]+\]/g,'')
      .replace(/\[HISTORY_ID:[^\]]+\]/g,'')
      .replace(/Queued\.\.\./g,'');

    if (cleanChunk.trim()) {
      resultsPre.textContent += cleanChunk;
      renderFormatted(resultsPre.textContent);
    }
  };

  xhr.onreadystatechange=async ()=>{
    if(xhr.readyState===4){
      submitBtn.disabled=false;
      currentXhr = null; // Clear XHR reference when done
      if(xhr.status>=200&&xhr.status<300){
        setUploadBar(100,'Done ✓');
        log('Complete.');
        renderFormatted(resultsPre.textContent);
        
        // Mark all steps as done
        if (stepper) {
          const steps = stepper.querySelectorAll('.step');
          steps.forEach(step => {
            step.classList.add('done');
            step.classList.remove('active');
          });
        }
        
        // For YouTube URLs, fetch the video from history after analysis
        if (hasUrl && !hasFile) {
          try {
            // Wait a bit for history entry to be created
            await new Promise(resolve => setTimeout(resolve, 1000));
            const historyResp = await fetch('/history/list');
            const historyItems = await historyResp.json();
            // Find the most recent entry (should be the one we just created)
            if (historyItems && historyItems.length > 0) {
              const newestEntry = historyItems[0]; // Already sorted by newest first
              if (newestEntry.videoUrl) {
                resultVideo.src = newestEntry.videoUrl;
                resultVideo.load();
                resultVideo.parentElement.classList.remove('hidden');
              }
            }
          } catch (e) {
            console.error('Failed to load YouTube video from history:', e);
          }
        }
        
        // Mark session as completed
        localStorage.setItem('sessionStatus', 'completed');
        
        // Close modal and switch to Results tab
        setTimeout(() => {
          hideProgressModal();
          switchTab('results');
        }, 500);
      } else {
        setUploadBar(0,'Idle');
        log(xhr.responseText||`Error ${xhr.status}`);
        showToast('Error during processing');
        // Mark session as failed
        localStorage.setItem('sessionStatus', 'failed');
        // Close modal on error after a delay
        setTimeout(() => {
          hideProgressModal();
        }, 2000);
      }
    }
  };
  xhr.onerror=()=>{
    submitBtn.disabled=false;
    currentXhr = null; // Clear XHR reference on error
    setUploadBar(0,'Idle');
    showToast('Network error.');
    localStorage.setItem('sessionStatus', 'failed');
    setTimeout(() => {
      hideProgressModal();
    }, 2000);
  };
  
  // Handle abort event
  xhr.onabort = () => {
    submitBtn.disabled = false;
    currentXhr = null;
    setUploadBar(0, 'Cancelled');
    showToast('Analysis cancelled');
  };
  
  xhr.send(fd);
});

// Close button handler
progressModalCloseBtn?.addEventListener('click', () => {
  cancelAnalysis();
});