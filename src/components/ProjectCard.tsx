import { Lock, MoreVertical, Cloud, FolderOpen, Edit2, Trash2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import RenameProjectDialog from "./RenameProjectDialog";
import DeleteProjectDialog from "./DeleteProjectDialog";
import ShareProjectDialog from "./ShareProjectDialog";
import { toast } from "@/hooks/use-toast";

interface ProjectCardProps {
  id: string;
  title: string;
  size: string;
  gradient: string;
  locked?: boolean;
  className?: string;
  onRename?: (id: string, newName: string) => void;
  onDelete?: (id: string) => void;
}

const ProjectCard = ({ id, title, size, gradient, locked = true, className, onRename, onDelete }: ProjectCardProps) => {
  const navigate = useNavigate();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/project/${id}`);
  };

  const handleRename = (newName: string) => {
    onRename?.(id, newName);
    toast({
      title: "Project renamed",
      description: `Project renamed to "${newName}"`,
    });
  };

  const handleDelete = () => {
    onDelete?.(id);
    toast({
      title: "Project deleted",
      description: `"${title}" has been deleted.`,
      variant: "destructive",
    });
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareDialogOpen(true);
  };
  return (
    <>
      <div 
        className={cn(
          "group relative h-48 rounded-xl overflow-hidden transition-card hover:scale-[1.02] hover:shadow-2xl cursor-pointer",
          className
        )}
        onClick={handleOpen}
      >
        {/* Gradient Background */}
        <div className={cn("absolute inset-0", gradient)} />
        
        {/* Lock Icon */}
        {locked && (
          <button className="absolute top-3 right-3 w-8 h-8 bg-black/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-black/30 transition-smooth z-10">
            <Lock className="w-4 h-4 text-white" />
          </button>
        )}

        {/* Content */}
        <div className="absolute inset-0 p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base mb-1 line-clamp-2">{title}</h3>
              <div className="flex items-center gap-1.5 text-white/80 text-sm">
                <Cloud className="w-3.5 h-3.5" />
                <span>{size}</span>
              </div>
            </div>
            <button 
              className="w-8 h-8 bg-black/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-black/30 transition-smooth"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-smooth">
            <button 
              className="flex-1 h-9 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center gap-2 hover:bg-white/20 transition-smooth"
              title="Open"
              onClick={handleOpen}
            >
              <FolderOpen className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">Open</span>
            </button>
            <button 
              className="h-9 px-3 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/20 transition-smooth"
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                setRenameDialogOpen(true);
              }}
            >
              <Edit2 className="w-4 h-4 text-white" />
            </button>
            <button 
              className="h-9 px-3 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/20 transition-smooth"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 text-white" />
            </button>
            <button 
              className="h-9 px-3 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-white/20 transition-smooth"
              title="Share"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-smooth pointer-events-none" />
      </div>

      {/* Dialogs */}
      <RenameProjectDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        currentName={title}
        onRename={handleRename}
      />
      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        projectName={title}
        onDelete={handleDelete}
      />
      <ShareProjectDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        projectName={title}
        projectId={id}
      />
    </>
  );
};

export default ProjectCard;
