import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Comment } from "@/pages/VideoPlayer";

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
            className="absolute pointer-events-auto cursor-pointer"
            style={{
              left: `${position}%`,
              top: "-28px",
              transform: "translateX(-50%)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onMarkerClick(comment.id, comment.timestamp);
            }}
          >
            <div className="relative group">
              <Avatar
                className={`w-6 h-6 border-2 transition-all ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/50 scale-110"
                    : "border-background hover:border-primary/50 hover:scale-110"
                }`}
              >
                <AvatarFallback className="bg-primary/90 text-primary-foreground text-[10px]">
                  {comment.avatar}
                </AvatarFallback>
              </Avatar>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  {comment.user}: {comment.text.substring(0, 30)}
                  {comment.text.length > 30 ? "..." : ""}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VideoTimelineMarkers;
