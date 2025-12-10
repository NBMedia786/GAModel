import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import SearchDialog from "@/components/SearchDialog";
import VideoComments from "@/components/VideoComments";
import VideoTimelineMarkers from "@/components/VideoTimelineMarkers";
import { Play, Pause, Maximize, ChevronLeft, Loader2, Sparkles, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { streamAnalysis } from "@/services/api";
import { useUser } from "@/contexts/UserContext"; // [NEW]

export interface Comment {
  id: string;
  user: string;
  avatar: string;
  timestamp: number;
  text: string;
  date: string;
  commentNumber: number;
  isAI?: boolean;
  errorType?: string;
  correction?: string;
}

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

const VideoPlayer = () => {
  const { id, fileId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useUser(); // [NEW]

  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedCommentId, setSelectedCommentId] = useState<string>();

  // Analysis State
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState<{ pct: number; label: string; phase?: string }>({ pct: 0, label: '' });
  const [rawResults, setRawResults] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);

  // Quality State
  const [currentQuality, setCurrentQuality] = useState<string>("Original");
  const [isConverting, setIsConverting] = useState(false);

  // Data State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string>("");
  const [remoteVideoUrl, setRemoteVideoUrl] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState("Untitled Project");
  const [manualComments, setManualComments] = useState<Comment[]>([]);
  const [deletedAICommentIds, setDeletedAICommentIds] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  // 1. Initialize Video - Support both local blob and remote files
  useEffect(() => {
    const state = location.state as { file?: File; projectName?: string };

    // Priority 1: Check if we have a local file (fresh upload)
    if (state?.file) {
      const url = URL.createObjectURL(state.file);
      setLocalVideoUrl(url);
      setRemoteVideoUrl(""); // Clear remote URL
      setVideoFile(state.file); // Store file for later analysis
      // Use video filename instead of project name
      setVideoTitle(state.file.name || "Untitled Video");

      return () => URL.revokeObjectURL(url);
    }

    // Priority 2: Load from remote server (saved file)
    if (id && fileId) {
      // Construct the remote video URL
      const remoteUrl = `/history_static/${id}/${fileId}`;
      setRemoteVideoUrl(remoteUrl);
      setLocalVideoUrl(""); // Clear local URL
      setVideoFile(null); // No local file

      // Decode filename if it's URL encoded
      let displayName = fileId;
      try {
        displayName = decodeURIComponent(fileId);
      } catch (e) {
        // If decoding fails, use original
        displayName = fileId;
      }

      // Use video filename instead of project name
      setVideoTitle(displayName || "Untitled Video");
    }
  }, [location, id, fileId]);

  // 1.5 Fetch Saved Analysis
  useEffect(() => {
    if (id && fileId) {
      const fetchAnalysis = async () => {
        try {
          const response = await fetch(`/api/project/${id}/analysis/${encodeURIComponent(fileId)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.content) {
              setRawResults(data.content);
              setAnalysisStatus('complete'); // Mark as complete if we have data
              toast({ title: "Analysis Loaded", description: "Previous analysis results loaded." });
            }
          }
        } catch (e) {
          console.error("Failed to fetch analysis:", e);
        }
      };
      fetchAnalysis();
    }
  }, [id, fileId]);

  // 2. Trigger Analysis ONLY when clicked
  const handleStartAnalysis = () => {
    // Reset previous results
    setRawResults('');
    setAnalysisStatus('uploading');
    setProgress({ pct: 0, label: 'Starting analysis...' });

    // Structured prompt that matches the parser format exactly
    const systemPrompt = `Analyze the video for errors (visual, audio, or continuity). 

For EACH error found, you MUST output it in this EXACT format with NO variations:

Error #1
Timestamp: MM:SS
Error: [Short Category, e.g., Glitch, Audio, Text]
Subtitle Text: [Brief description of the error]
Correction: [What should happen instead]

Error #2
Timestamp: MM:SS
Error: [Short Category]
Subtitle Text: [Brief description]
Correction: [What should happen instead]

CRITICAL REQUIREMENTS:
1. Start each error block with "Error #" followed by a number (Error #1, Error #2, etc.)
2. Use EXACTLY these field names: "Timestamp:", "Error:", "Subtitle Text:", "Correction:"
3. Use MM:SS format for timestamps (e.g., "01:23" for 1 minute 23 seconds)
4. Do NOT add any introductory text, explanations, or conversational filler
5. Do NOT add markdown formatting, asterisks, or other decorations
6. Output ONLY the error blocks in the exact format shown above

Example of correct output:
Error #1
Timestamp: 00:15
Error: Grammar
Subtitle Text: He don't know what he's doing
Correction: He doesn't know what he's doing

Error #2
Timestamp: 01:30
Error: Spelling
Subtitle Text: The reciept is in the folder
Correction: The receipt is in the folder`;

    // Check if we have a local file or remote file
    if (videoFile) {
      // Analyze local file (upload first)
      streamAnalysis(
        videoFile,
        systemPrompt,
        {
          onProgress: (data) => {
            setProgress(data);
            if (data.phase === 'analyze' || data.phase === 'process') {
              setAnalysisStatus('analyzing');
            } else if (data.phase === 'upload') {
              setAnalysisStatus('uploading');
            }
          },
          onTextChunk: (text) => setRawResults((prev) => prev + text),
          onComplete: () => {
            setAnalysisStatus('complete');
            toast({ title: "Analysis Complete", description: "All errors found." });
          },
          onError: (err) => {
            setAnalysisStatus('error');
            toast({ variant: "destructive", title: "Analysis Failed", description: err });
          }
        }
      );
    } else if (id && fileId) {
      // Analyze remote file (existing video in project)
      streamAnalysis(
        null,
        systemPrompt,
        {
          projectId: id,
          fileName: decodeURIComponent(fileId),
          onProgress: (data) => {
            setProgress(data);
            if (data.phase === 'analyze' || data.phase === 'process') {
              setAnalysisStatus('analyzing');
            } else if (data.phase === 'upload') {
              setAnalysisStatus('uploading');
            }
          },
          onTextChunk: (text) => setRawResults((prev) => prev + text),
          onComplete: () => {
            setAnalysisStatus('complete');
            toast({ title: "Analysis Complete", description: "All errors found." });
          },
          onError: (err) => {
            setAnalysisStatus('error');
            toast({ variant: "destructive", title: "Analysis Failed", description: err });
          }
        }
      );
    } else {
      toast({ variant: "destructive", title: "No Video", description: "No video file available for analysis." });
      setAnalysisStatus('error');
    }
  };

  // 3. Add Human Comment
  const handleAddComment = (text: string) => {
    const newComment: Comment = {
      id: `human-${Date.now()}`,
      user: user ? `${user.firstName} ${user.lastName}` : "You",
      avatar: "ME",
      timestamp: currentTime,
      text: text,
      date: "Just now",
      commentNumber: manualComments.length + 1,
      isAI: false
    };
    setManualComments([...manualComments, newComment]);

    // Send Notification
    const userName = user ? `${user.firstName} ${user.lastName}` : "A user";
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Comment',
        description: `${userName} commented on ${videoTitle}: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
        type: 'info'
      })
    }).catch(console.error);

  };

  // 4. Edit Comment
  const handleEditComment = (id: string, newText: string) => {
    if (id.startsWith('ai-')) {
      // Find original AI comment
      const aiComment = comments.find(c => c.id === id);
      if (aiComment) {
        // Create new manual comment with edited text
        const newComment: Comment = {
          ...aiComment,
          id: `human-converted-${Date.now()}`,
          user: user ? `${user.firstName} ${user.lastName}` : "You",
          avatar: "ME",
          text: newText,
          isAI: false,
          date: "Edited just now"
        };

        // Add to manual and hide original AI
        setManualComments(prev => [...prev, newComment]);
        setDeletedAICommentIds(prev => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        toast({ title: "Comment Updated", description: "AI comment converted to manual edit." });
      }
    } else {
      setManualComments(prev =>
        prev.map(comment =>
          comment.id === id ? { ...comment, text: newText } : comment
        )
      );
    }
  };

  // 5. Delete Comment
  const handleDeleteComment = (id: string) => {
    if (id.startsWith('ai-')) {
      setDeletedAICommentIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } else {
      setManualComments(prev => prev.filter(comment => comment.id !== id));
    }

    if (selectedCommentId === id) {
      setSelectedCommentId(undefined);
    }
    toast({ title: "Comment Deleted", description: "Comment has been removed." });
  };

  // 6. Merge AI Results + Manual Comments
  const comments = useMemo<Comment[]>(() => {
    const aiComments: Comment[] = [];

    if (rawResults) {
      const blocks = rawResults.split(/Error\s*#\d+/i).slice(1);
      blocks.forEach((block, index) => {
        const id = `ai-${index}`;
        if (deletedAICommentIds.has(id)) return;

        const lines = block.trim().split('\n');
        const data = { timestamp: '', type: '', text: '', correction: '' };

        lines.forEach(line => {
          const l = line.toLowerCase();
          if (l.startsWith('timestamp:')) data.timestamp = line.substring(10).trim();
          else if (l.startsWith('error:')) data.type = line.substring(6).trim();
          else if (l.startsWith('subtitle text:')) data.text = line.substring(14).trim();
          else if (l.startsWith('correction:')) data.correction = line.substring(11).trim();
        });

        const parts = data.timestamp.split(':').map(Number);
        const seconds = parts.length === 3
          ? parts[0] * 3600 + parts[1] * 60 + parts[2]
          : parts[0] * 60 + parts[1];

        aiComments.push({
          id: `ai-${index}`,
          user: "AI Analyst",
          avatar: "AI",
          timestamp: seconds || 0,
          text: data.text,
          errorType: data.type,
          correction: data.correction,
          date: "Just now",
          commentNumber: index + 1,
          isAI: true
        });
      });
    }

    // Combine and sort by timestamp
    return [...aiComments, ...manualComments].sort((a, b) => a.timestamp - b.timestamp);
  }, [rawResults, manualComments, deletedAICommentIds]);

  // Video Events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      if (!isNaN(video.currentTime)) {
        setCurrentTime(video.currentTime);
      }
    };

    const updateDuration = () => {
      if (!isNaN(video.duration) && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      updateDuration();
      // Also try to get duration on loadeddata as fallback
      if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };
    const handleLoadedData = () => {
      if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    // Try to get duration immediately if already loaded
    if (video.readyState >= 1 && video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
      setDuration(video.duration);
    }

    return () => {
      video.removeEventListener("timeupdate", updateTime);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [localVideoUrl, remoteVideoUrl]);

  const togglePlay = async () => {
    if (videoRef.current) {
      try {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          await videoRef.current.play();
        }
        // State will be updated by event listeners
      } catch (error) {
        console.error("Error toggling play:", error);
        setIsPlaying(false);
      }
    }
  };

  const [sliderValue, setSliderValue] = useState([0]);
  const [isDragging, setIsDragging] = useState(false);

  // Sync slider with video time when not dragging
  useEffect(() => {
    if (!isDragging && !isNaN(currentTime)) {
      setSliderValue([currentTime]);
    }
  }, [currentTime, isDragging]);

  const handleSeekChange = (value: number[]) => {
    setIsDragging(true);
    setSliderValue(value);
    // Optional: Scrubbing effect
    if (videoRef.current && !isNaN(value[0]) && isFinite(value[0])) {
      videoRef.current.currentTime = value[0];
    }
  };

  const handleSeekCommit = (value: number[]) => {
    setIsDragging(false);
    if (videoRef.current && !isNaN(value[0]) && isFinite(value[0])) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleCommentClick = (timestamp: number, commentId?: string) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      setCurrentTime(timestamp);
      if (commentId) setSelectedCommentId(commentId);
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time) || !isFinite(time)) {
      return "00:00:00";
    }
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link Copied", description: "Video link copied to clipboard!" });
    } catch (err) {
      toast({ variant: "destructive", title: "Share Failed", description: "Could not copy link." });
    }
  };

  const handleQualityChange = async (quality: string) => {
    if (quality === currentQuality) return;

    // If switching back to original, we need to find the original file or just reload
    // For simplicity, for now we only support downscaling. 
    // If "Original" is selected, we might need to store the original URL somewhere. 
    // But since the backend endpoint finds the "Original" based on metadata, 
    // we can't easily "un-convert" without reloading the page or storing original URL.
    // Let's assume for now we can always switch TO a quality.

    // Exception: If "Original" is clicked, we reload the page or reset (Simplest MVP)
    if (quality === "Original") {
      window.location.reload();
      return;
    }

    if (!id) return;

    const heightMap: Record<string, number> = {
      "480p": 480,
      "720p": 720,
      "1080p": 1080,
      "4k": 2160
    };

    const targetHeight = heightMap[quality];
    if (!targetHeight) return;

    setIsConverting(true);
    toast({ title: "Changing Quality", description: `Switching to ${quality}...` });

    const wasPlaying = isPlaying;
    if (videoRef.current) videoRef.current.pause();

    try {
      const response = await fetch(`/api/project/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetHeight })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success
        // Update URL
        const newUrl = `/history_static/${id}/${data.fileName}`;
        setRemoteVideoUrl(newUrl);
        setLocalVideoUrl("");
        setCurrentQuality(quality);

        // Restore time
        const time = currentTime;

        // Wait for video to load new source
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = time;
            if (wasPlaying) videoRef.current.play();
          }
          setIsConverting(false);
          toast({ title: "Quality Changed", description: `Now playing in ${quality}` });
        }, 500);

      } else {
        throw new Error(data.error || 'Conversion failed');
      }

    } catch (e: any) {
      console.error("Quality switch failed:", e);
      toast({ variant: "destructive", title: "Failed to change quality", description: e.message });
      setIsConverting(false);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Sidebar onSearchClick={() => setSearchDialogOpen(true)} />
      <SearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} projects={[]} />

      <main className="ml-16 flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b border-border flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-sm font-medium text-foreground">{videoTitle}</h1>

            {/* Status Indicator */}
            {analysisStatus !== 'idle' && analysisStatus !== 'complete' && (
              <div className="flex items-center gap-4">
                {/* Detailed Steps */}
                <div className="flex items-center gap-2 mr-4">
                  {/* Step 1: Chunking */}
                  <div className={`flex items-center gap-2 ${['process', 'upload', 'analyze'].includes(progress.phase || '') ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${['process', 'upload', 'analyze'].includes(progress.phase || '') ? 'bg-primary' : 'bg-muted'}`} />
                    <span className="text-xs font-medium">Chunking</span>
                  </div>
                  <div className="w-4 h-[1px] bg-border" />

                  {/* Step 2: Upload */}
                  <div className={`flex items-center gap-2 ${['upload', 'analyze'].includes(progress.phase || '') ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${['upload', 'analyze'].includes(progress.phase || '') ? 'bg-primary' : 'bg-muted'}`} />
                    <span className="text-xs font-medium">Upload</span>
                  </div>
                  <div className="w-4 h-[1px] bg-border" />

                  {/* Step 3: Analyze */}
                  <div className={`flex items-center gap-2 ${['analyze'].includes(progress.phase || '') ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-2 h-2 rounded-full ${['analyze'].includes(progress.phase || '') ? 'bg-primary' : 'bg-muted'}`} />
                    <span className="text-xs font-medium">Analyze</span>
                  </div>
                </div>

                {/* Current Action Badge */}
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{progress.label} ({progress.pct}%)</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* START BUTTON */}
            {analysisStatus === 'idle' && (
              <Button onClick={handleStartAnalysis} size="sm" className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 border-0">
                <Sparkles className="w-4 h-4" />
                Start AI Analysis
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleShare}>Share</Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Video Player Area */}
          <div className="flex-1 flex flex-col bg-slate-900 min-w-0 overflow-hidden relative">
            <div className="flex-1 relative group flex items-center justify-center min-h-0">
              {(localVideoUrl || remoteVideoUrl) ? (
                <video
                  ref={videoRef}
                  src={localVideoUrl || remoteVideoUrl}
                  className="max-h-full max-w-full object-contain"
                  onClick={togglePlay}
                  preload="metadata"
                  onLoadedMetadata={() => {
                    if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration) && isFinite(videoRef.current.duration)) {
                      setDuration(videoRef.current.duration);
                    }
                  }}
                />
              ) : (
                <div className="text-muted-foreground">No video source</div>
              )}

              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                  <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Video Controls */}
            <div className="bg-gray-900/90 backdrop-blur-sm border-t border-white/10 p-4 flex-shrink-0 z-10 relative">
              <div className="mb-4 relative">
                <VideoTimelineMarkers
                  comments={comments}
                  duration={duration}
                  onMarkerClick={(id, ts) => handleCommentClick(ts, id)}
                  selectedCommentId={selectedCommentId}
                />
                <Slider
                  value={sliderValue}
                  max={duration && !isNaN(duration) && isFinite(duration) ? duration : 100}
                  step={0.1}
                  onValueChange={handleSeekChange}
                  onValueCommit={handleSeekCommit}
                  className="cursor-pointer group [&>span:first-child]:h-1 [&>span:first-child]:bg-white/10 [&>span:first-child>span]:bg-white [&>span:last-child]:h-3.5 [&>span:last-child]:w-3.5 [&>span:last-child]:rounded-full [&>span:last-child]:border-2 [&>span:last-child]:border-white [&>span:last-child]:bg-white [&>span:last-child]:shadow-[0_0_10px_rgba(255,255,255,0.5)] [&>span:last-child]:transition-transform [&>span:last-child]:hover:scale-125 [&>span:last-child]:focus:scale-125"
                  disabled={!duration || isNaN(duration) || !isFinite(duration)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/10 hover:text-white">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <span className="text-xs text-gray-300 font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isConverting} className="text-white hover:bg-white/10 hover:text-white">
                        {isConverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled>Quality: {currentQuality}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQualityChange("Original")}>Original</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQualityChange("1080p")}>1080p (HD)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQualityChange("720p")}>720p (HD)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQualityChange("480p")}>480p (SD)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="ghost" size="icon" onClick={() => videoRef.current?.requestFullscreen()} className="text-white hover:bg-white/10 hover:text-white">
                    <Maximize className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div >

          {/* Comments Sidebar */}
          < VideoComments
            comments={comments}
            onCommentClick={handleCommentClick}
            onAddComment={handleAddComment}
            onEditComment={handleEditComment}
            onDeleteComment={handleDeleteComment}
            currentTime={currentTime}
            selectedCommentId={selectedCommentId}
          />
        </div >
      </main >
    </div >
  );
};

export default VideoPlayer;
