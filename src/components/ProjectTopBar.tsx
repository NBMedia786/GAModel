import { useState } from "react";
import { Grid3x3, List, Search, Users, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectTopBarProps {
  projectTitle: string;
  totalAssets: number;
  totalSize: string;
  onShareClick?: () => void;
  onUploadClick?: () => void;
  showUploadButton?: boolean;
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
  onSearch?: (query: string) => void;
  onTeamClick?: () => void;
}

const ProjectTopBar = ({ 
  projectTitle, 
  totalAssets, 
  totalSize, 
  onShareClick, 
  onUploadClick, 
  showUploadButton = true,
  viewMode = "grid",
  onViewModeChange,
  sortBy = "Custom",
  onSortChange,
  onSearch,
  onTeamClick
}: ProjectTopBarProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const sortOptions = [
    "Custom",
    "Name",
    "Date Modified",
    "Date Created",
    "Size",
    "Type"
  ];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleSortSelect = (sort: string) => {
    onSortChange?.(sort);
  };
  return (
    <div className="border-b border-border bg-background">
      {/* Top Header */}
      <div className="h-14 px-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{projectTitle}</h1>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search" 
              className="w-64 pl-9 h-9 bg-muted/50"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-9 w-9 ${viewMode === "grid" ? "bg-muted" : ""}`}
            onClick={() => onViewModeChange?.("grid")}
            title="Grid view"
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-9 w-9 ${viewMode === "list" ? "bg-muted" : ""}`}
            onClick={() => onViewModeChange?.("list")}
            title="List view"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{totalAssets} Visible</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <span>Sorted by</span>
                <span className="text-foreground">{sortBy}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => handleSortSelect(option)}
                  className={sortBy === option ? "bg-muted" : ""}
                >
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => {
              setSearchQuery("");
              onSearch?.("");
              // Focus search input
              const searchInput = document.querySelector('input[placeholder="Search"]') as HTMLInputElement;
              searchInput?.focus();
            }}
            title="Clear search"
          >
            <Search className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {showUploadButton && (
            <Button 
              variant="outline" 
              size="sm"
              className="h-8 px-3 text-xs gap-2"
              onClick={onUploadClick}
            >
              <Upload className="w-3 h-3" />
              Upload video
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={onTeamClick}
            title="Team"
          >
            <Users className="w-4 h-4" />
          </Button>
          <Button 
            className="h-8 px-3 text-xs"
            onClick={onShareClick}
          >
            Share
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectTopBar;
