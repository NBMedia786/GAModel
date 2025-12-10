import { MoreVertical, Cloud, FolderOpen, Edit2, Trash2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import RenameProjectDialog from "./RenameProjectDialog";
import DeleteProjectDialog from "./DeleteProjectDialog";
import ShareProjectDialog from "./ShareProjectDialog";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectCardProps {
  id: string;
  title: string;
  size: string;
  gradient: string;
  lastUpdated?: number;
  className?: string;
  onRename?: (id: string, newName: string) => void;
  onDelete?: (id: string) => void;
}

const ProjectCard = ({ id, title, size, gradient, lastUpdated, className, onRename, onDelete }: ProjectCardProps) => {
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
          "group relative aspect-square rounded-xl overflow-hidden transition-card hover:scale-[1.02] hover:shadow-2xl cursor-pointer",
          className
        )}
        onClick={handleOpen}
      >
        {/* Gradient Background */}
        <div className={cn("absolute inset-0", gradient)} />


        {/* Content */}
        <div className="absolute inset-0 p-3 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-white font-semibold text-base mb-1 line-clamp-1">{title}</h3>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-white/80 text-xs">
                  <Cloud className="w-3 h-3" />
                  <span>{size}</span>
                </div>
                {lastUpdated && (
                  <span className="text-white/60 text-[10px] font-medium">
                    Edited {new Date(lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-8 h-8 bg-black/20 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-black/30 transition-smooth"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4 text-white" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white/95 backdrop-blur-xl border-white/20">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameDialogOpen(true);
                  }}
                  className="gap-2 cursor-pointer text-gray-700 focus:text-gray-900 focus:bg-gray-100"
                >
                  <Edit2 className="w-4 h-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(e);
                  }}
                  className="gap-2 cursor-pointer text-gray-700 focus:text-gray-900 focus:bg-gray-100"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteDialogOpen(true);
                  }}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50 gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-smooth">
            <button
              className="flex-1 h-8 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center gap-2 hover:bg-white/20 transition-smooth"
              title="Open"
              onClick={handleOpen}
            >
              <FolderOpen className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">Open</span>
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
