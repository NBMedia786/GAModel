import { File, MoreHorizontal, Play, Edit2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

interface FileCardProps {
  title: string;
  owner: string;
  date: string;
  gradient?: string;
  type?: "video" | "image" | "file" | "audio" | "document";
  duration?: string;
  projectId?: string;
  fileId?: string;
  viewMode?: "grid" | "list";
  onEdit?: (fileId: string, currentName: string) => void;
  onDelete?: (fileId: string, fileName: string) => void;
}

const FileCard = ({ title, owner, date, gradient = "bg-gradient-blue-purple", type = "video", duration, projectId, fileId, viewMode = "grid", onEdit, onDelete }: FileCardProps) => {
  const navigate = useNavigate();

  const handleDoubleClick = () => {
    if (projectId && fileId) {
      navigate(`/project/${projectId}/video/${fileId}`);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileId && onEdit) {
      onEdit(fileId, title);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileId && onDelete) {
      onDelete(fileId, title);
    }
  };

  if (viewMode === "list") {
    return (
      <Card
        className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-smooth cursor-pointer"
        onDoubleClick={handleDoubleClick}
      >
        <div className="flex items-center gap-4 p-3">
          {/* Thumbnail */}
          <div className={`relative w-24 h-16 flex-shrink-0 ${gradient} flex items-center justify-center group-hover:scale-105 transition-transform rounded`}>
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center rounded">
              <Play className="w-8 h-8 text-white/90 group-hover:scale-110 transition-transform" />
            </div>
            {duration && (
              <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
                {duration}
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-sm font-medium text-foreground truncate flex-1">{title}</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -mt-1 opacity-0 group-hover:opacity-100 transition-smooth"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="text-xs text-muted-foreground">
              {owner} • {date}
            </p>
          </div>

          {/* Status Section */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-3 h-3 rounded-sm bg-muted" />
            <span className="text-xs text-muted-foreground">Status</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-smooth cursor-pointer"
      onDoubleClick={handleDoubleClick}
    >
      {/* Thumbnail */}
      <div className={`relative aspect-video ${gradient} flex items-center justify-center group-hover:scale-105 transition-transform`}>
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <Play className="w-12 h-12 text-white/90 group-hover:scale-110 transition-transform" />
        </div>
        {duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {duration}
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="p-3">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-medium text-foreground truncate flex-1">{title}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mt-1 opacity-0 group-hover:opacity-100 transition-smooth"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={handleEdit}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          {owner} • {date}
        </p>

        {/* Status Section */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <span className="text-xs text-muted-foreground">Status</span>
        </div>
      </div>
    </Card>
  );
};

export default FileCard;
