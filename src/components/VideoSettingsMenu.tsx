import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VideoSettingsMenuProps {
  currentQuality: string;
  onQualityChange: (quality: string) => void;
  onDownloadStill: () => void;
}

const VideoSettingsMenu = ({
  currentQuality,
  onQualityChange,
  onDownloadStill,
}: VideoSettingsMenuProps) => {
  const qualities = ["Auto", "1080p", "720p", "480p", "360p"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex items-center justify-between w-full">
              Quality
              <span className="text-xs text-muted-foreground ml-2">
                {currentQuality}
              </span>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {qualities.map((quality) => (
              <DropdownMenuItem
                key={quality}
                onClick={() => onQualityChange(quality)}
                className={currentQuality === quality ? "bg-accent" : ""}
              >
                {quality}
                {currentQuality === quality && (
                  <span className="ml-auto">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={onDownloadStill}>
          Download Still
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VideoSettingsMenu;
