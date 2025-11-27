import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, AlertCircle, Clock, Send, User, Edit2, Trash2, Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Comment } from "@/pages/VideoPlayer";

interface VideoCommentsProps {
  comments: Comment[];
  onCommentClick: (timestamp: number, commentId?: string) => void;
  onAddComment: (text: string) => void;
  onEditComment: (id: string, newText: string) => void;
  onDeleteComment: (id: string) => void;
  currentTime: number;
  selectedCommentId?: string;
}

const VideoComments = ({
  comments,
  onCommentClick,
  onAddComment,
  onEditComment,
  onDeleteComment,
  currentTime,
  selectedCommentId,
}: VideoCommentsProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const formatTimestamp = (t: number) => {
    const hours = Math.floor(t / 3600);
    const minutes = Math.floor((t % 3600) / 60);
    const seconds = Math.floor(t % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddComment(newComment);
      setNewComment("");
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  const handleSaveEdit = () => {
    if (editingCommentId && editingText.trim()) {
      onEditComment(editingCommentId, editingText.trim());
      setEditingCommentId(null);
      setEditingText("");
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText("");
  };

  const handleDeleteClick = (commentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentToDelete(commentId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (commentToDelete) {
      onDeleteComment(commentToDelete);
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
    }
  };

  return (
    <div className="w-96 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border">
        <Tabs defaultValue="comments" className="w-full">
          <TabsList className="w-full rounded-none h-12 bg-transparent border-b border-border">
            <TabsTrigger value="comments" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              Comments & Analysis
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {comments.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
              <p>No comments yet.</p>
              <p className="text-xs mt-2">Start AI Analysis or add a comment.</p>
            </div>
          )}

          {comments
            .filter((c) => !searchQuery || c.text.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((comment) => {
              const isSelected = selectedCommentId === comment.id;

              // 🤖 AI ERROR CARD STYLE
              if (comment.isAI) {
                return (
                  <div
                    key={comment.id}
                    onClick={() => onCommentClick(comment.timestamp, comment.id)}
                    className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 ${isSelected
                      ? "bg-primary/5 border-primary shadow-sm"
                      : "bg-card border-border hover:border-primary/50"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500">
                        <AlertCircle className="w-3 h-3" />
                        {comment.errorType || "Issue"}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-mono text-primary">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(comment.timestamp)}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="pl-2 border-l-2 border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase block">Original</span>
                        <p className="text-foreground/80 line-clamp-2">{comment.text}</p>
                      </div>
                      {comment.correction && (
                        <div className="pl-2 border-l-2 border-green-500/50">
                          <span className="text-[10px] text-green-600 uppercase block">Correction</span>
                          <p className="text-foreground font-medium">{comment.correction}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // 👤 HUMAN COMMENT STYLE
              const isEditing = editingCommentId === comment.id;

              return (
                <div
                  key={comment.id}
                  className={`rounded-lg p-3 transition-all ${isSelected ? "bg-muted border-l-2 border-primary" : "hover:bg-muted/50"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 text-xs flex-shrink-0">
                      <User className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{comment.user}</span>
                          <span className="text-[10px] text-muted-foreground">{formatTimestamp(comment.timestamp)}</span>
                        </div>
                        {!isEditing && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(comment);
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => handleDeleteClick(comment.id, e)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit();
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            className="text-sm"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              onClick={handleSaveEdit}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              onClick={handleCancelEdit}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className="text-sm cursor-pointer"
                          onClick={() => onCommentClick(comment.timestamp, comment.id)}
                        >
                          {comment.text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </ScrollArea>

      {/* ADD COMMENT INPUT */}
      <div className="p-4 border-t border-border bg-background">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-muted-foreground">
            {formatTimestamp(currentTime)}
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSubmit}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCommentToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VideoComments;
