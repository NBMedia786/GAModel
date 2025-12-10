import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const TopBar = () => {
  return (
    <div className="fixed top-0 right-0 left-16 h-16 bg-background border-b border-border px-6 flex items-center justify-between z-40">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            type="text"
            placeholder="Search"
            className="pl-10 bg-secondary border-border focus-visible:ring-primary"
          />
        </div>
      </div>
    </div>
  );
};

export default TopBar;
