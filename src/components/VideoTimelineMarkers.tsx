import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Comment } from "@/pages/VideoPlayer";
import { getUserColor } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface VideoTimelineMarkersProps {
  comments: Comment[];
  duration: number;
  onMarkerClick: (commentId: string, timestamp: number) => void;
  selectedCommentId?: string;
}

const VideoTimelineMarkers = ({
  comments,
  duration,
  onMarkerClick,
  selectedCommentId,
}: VideoTimelineMarkersProps) => {
  if (!duration) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {comments.map((comment) => {
        const position = (comment.timestamp / duration) * 100;
        const isSelected = selectedCommentId === comment.id;

        return (
          <div
            key={comment.id}
            className="absolute pointer-events-auto cursor-pointer group z-20"
            style={{
              left: `${position}%`,
              top: "-22px", // Adjusted to clear progress bar
              transform: "translateX(-50%)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onMarkerClick(comment.id, comment.timestamp);
            }}
          >
            {/* Marker Shape */}
            <div className={`relative transition-all duration-300 ${isSelected ? 'scale-125 -translate-y-1' : 'hover:scale-125 hover:-translate-y-1'}`}>
              {comment.isAI ? (
                // AI Marker: Sleek "AI" Text Badge
                <div className="bg-purple-600 border border-purple-400/80 shadow-[0_0_8px_rgba(168,85,247,0.8)] rounded-[4px] flex items-center justify-center px-1.5 py-0.5">
                  <span className="text-[10px] font-black text-white leading-none tracking-normal drop-shadow-md">AI</span>
                </div>
              ) : (
                // Human Marker: Clean Dot
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-white/90 shadow-sm"
                  style={{ backgroundColor: getUserColor(comment.user) }}
                />
              )}

              {/* Connector Line (visible on hover or select) */}
              <div className={`absolute top-full left-1/2 -translate-x-1/2 w-[1px] bg-white/30 rounded-full transition-all duration-300 ${isSelected ? 'h-6 opacity-100' : 'h-0 opacity-0 group-hover:h-5 group-hover:opacity-100'}`} />
            </div>

            {/* Premium Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <div className="bg-slate-900/95 backdrop-blur-md text-white text-[11px] px-3 py-1.5 rounded-lg border border-slate-700/50 shadow-xl whitespace-nowrap flex items-center gap-2 transform translate-y-1 group-hover:translate-y-0 transition-transform">
                {comment.isAI && <Sparkles className="w-3 h-3 text-purple-400" />}
                <span
                  className="font-bold tracking-wide"
                  style={{ color: comment.isAI ? '#A855F7' : getUserColor(comment.user) }}
                >
                  {comment.user}
                </span>
                <span className="w-[1px] h-3 bg-white/10" />
                <span className="text-slate-300 max-w-[200px] truncate font-light">{comment.text}</span>
              </div>
              {/* Tooltip Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900/95 border-r border-b border-slate-700/50 rotate-45" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VideoTimelineMarkers;
