import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import SearchDialog from "@/components/SearchDialog";
import VideoComments from "@/components/VideoComments";
import VideoTimelineMarkers from "@/components/VideoTimelineMarkers";
import { Play, Pause, Maximize, ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { streamAnalysis } from "@/services/api";

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

  // Data State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string>("");
  const [remoteVideoUrl, setRemoteVideoUrl] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState("Untitled Project");
  const [manualComments, setManualComments] = useState<Comment[]>([]);

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
      user: "You",
      avatar: "ME",
      timestamp: currentTime,
      text: text,
      date: "Just now",
      commentNumber: manualComments.length + 1,
      isAI: false
    };
    setManualComments([...manualComments, newComment]);
  };

  // 4. Edit Human Comment
  const handleEditComment = (id: string, newText: string) => {
    setManualComments(prev =>
      prev.map(comment =>
        comment.id === id ? { ...comment, text: newText } : comment
      )
    );
  };

  // 5. Delete Human Comment
  const handleDeleteComment = (id: string) => {
    setManualComments(prev => prev.filter(comment => comment.id !== id));
    if (selectedCommentId === id) {
      setSelectedCommentId(undefined);
    }
  };

  // 6. Merge AI Results + Manual Comments
  const comments = useMemo<Comment[]>(() => {
    const aiComments: Comment[] = [];

    if (rawResults) {
      const blocks = rawResults.split(/Error\s*#\d+/i).slice(1);
      blocks.forEach((block, index) => {
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
  }, [rawResults, manualComments]);

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

  // 4. Share Functionality
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link Copied", description: "Video link copied to clipboard!" });
    } catch (err) {
      toast({ variant: "destructive", title: "Share Failed", description: "Could not copy link." });
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
          <div className="flex-1 flex flex-col bg-black min-w-0 overflow-hidden relative">
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
            <div className="bg-background border-t border-border p-4 flex-shrink-0 z-10 relative">
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
                  className="cursor-pointer"
                  disabled={!duration || isNaN(duration) || !isFinite(duration)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={togglePlay}>
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => videoRef.current?.requestFullscreen()}>
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
