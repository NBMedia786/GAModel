import { Folder, Trash2, List, Video, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface ProjectSidebarProps {
  projectTitle: string;
  selectedAsset?: string;
  onAssetChange?: (asset: string) => void;
  selectedCollection?: string;
  onCollectionChange?: (collection: string) => void;
  selectedShareLink?: string;
  onShareLinkChange?: (shareLink: string) => void;
}

const ProjectSidebar = ({ 
  projectTitle,
  selectedAsset = "all",
  onAssetChange,
  selectedCollection = "all",
  onCollectionChange,
  selectedShareLink = "all",
  onShareLinkChange
}: ProjectSidebarProps) => {
  const assetItems = [
    { id: "all", icon: Folder, label: projectTitle },
    { id: "deleted", icon: Trash2, label: "Recently Deleted" },
  ];

  const collectionItems = [
    { id: "all", icon: List, label: "All Collections" },
    { id: "video", icon: Video, label: "Videos" },
    { id: "review", icon: Eye, label: "Needs Review" },
  ];

  return (
    <aside className="fixed left-16 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-sm font-semibold text-sidebar-foreground">{projectTitle}</h2>
      </div>

      <ScrollArea className="flex-1">
        {/* Assets Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-sidebar-foreground">Assets</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => toast.info("Create new folder")}
            >
              <span className="text-sidebar-foreground">+</span>
            </Button>
          </div>
          <div className="space-y-1">
            {assetItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onAssetChange?.(item.id);
                  // Reset other filters when asset changes
                  onCollectionChange?.("all");
                  onShareLinkChange?.("all");
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-smooth",
                  selectedAsset === item.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Collections Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-sidebar-foreground">Collections</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => toast.info("Create new collection")}
            >
              <span className="text-sidebar-foreground">+</span>
            </Button>
          </div>
          <div className="space-y-1">
            {collectionItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onCollectionChange?.(item.id);
                  // Reset other filters when collection changes
                  onAssetChange?.("all");
                  onShareLinkChange?.("all");
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-smooth",
                  selectedCollection === item.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

      </ScrollArea>
    </aside>
  );
};

export default ProjectSidebar;
