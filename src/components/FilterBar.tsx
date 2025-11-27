import { Grid3x3, List, Filter, ArrowUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface FilterBarProps {
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
  filterBy?: string;
  onFilterChange?: (filter: string) => void;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}

const FilterBar = ({ 
  viewMode = "grid", 
  onViewModeChange,
  filterBy = "Active Projects",
  onFilterChange,
  sortBy = "Name",
  onSortChange 
}: FilterBarProps) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const filterOptions = [
    "All Projects",
    "Active Projects",
    "Archived Projects",
    "Shared with Me",
    "My Projects",
  ];

  const sortOptions = [
    "Name",
    "Date Modified",
    "Date Created",
    "Size",
  ];

  return (
    <div className="flex items-center gap-3">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
        <button
          onClick={() => onViewModeChange?.("grid")}
          className={cn(
            "p-2 rounded-md transition-smooth",
            viewMode === "grid" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Grid3x3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewModeChange?.("list")}
          className={cn(
            "p-2 rounded-md transition-smooth",
            viewMode === "list" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Button */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtered by
            <span className="text-primary">{filterBy}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground px-2 py-1.5">
              Filter Projects
            </p>
            <Separator />
            {filterOptions.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onFilterChange?.(option);
                  setFilterOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors",
                  filterBy === option && "bg-muted"
                )}
              >
                <span className={cn(
                  "text-foreground",
                  filterBy === option && "font-medium"
                )}>
                  {option}
                </span>
                {filterBy === option && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort Button */}
      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm" className="gap-2">
            <ArrowUpDown className="w-4 h-4" />
            Sorted by
            <span className="text-primary">{sortBy}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground px-2 py-1.5">
              Sort Projects
            </p>
            <Separator />
            {sortOptions.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onSortChange?.(option);
                  setSortOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors",
                  sortBy === option && "bg-muted"
                )}
              >
                <span className={cn(
                  "text-foreground",
                  sortBy === option && "font-medium"
                )}>
                  {option}
                </span>
                {sortBy === option && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default FilterBar;
