import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  title: string;
  size: string;
  gradient: string;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
}

const SearchDialog = ({ open, onOpenChange, projects }: SearchDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProjects([]);
      return;
    }

    // Fuzzy search: match any combination of letters in the project name
    const query = searchQuery.toLowerCase().replace(/\s+/g, '');
    const filtered = projects.filter(project => {
      const projectName = project.title.toLowerCase().replace(/\s+/g, '');
      
      // Check if all characters in query appear in order in the project name
      let queryIndex = 0;
      for (let i = 0; i < projectName.length && queryIndex < query.length; i++) {
        if (projectName[i] === query[queryIndex]) {
          queryIndex++;
        }
      }
      
      return queryIndex === query.length;
    });

    setFilteredProjects(filtered);
  }, [searchQuery, projects]);

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
    onOpenChange(false);
    setSearchQuery("");
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase().replace(/\s+/g, '');
    const parts: { text: string; highlight: boolean }[] = [];
    let lastIndex = 0;
    let queryIndex = 0;

    for (let i = 0; i < text.length && queryIndex < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        if (i > lastIndex) {
          parts.push({ text: text.slice(lastIndex, i), highlight: false });
        }
        parts.push({ text: text[i], highlight: true });
        lastIndex = i + 1;
        queryIndex++;
      }
    }

    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), highlight: false });
    }

    return (
      <span>
        {parts.map((part, index) => (
          <span
            key={index}
            className={part.highlight ? "text-primary font-semibold" : ""}
          >
            {part.text}
          </span>
        ))}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Search Projects</DialogTitle>
        </DialogHeader>
        
        {/* Search Input */}
        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Type to search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Search Results */}
        <div className="px-6 pb-6 max-h-96 overflow-y-auto">
          {searchQuery.trim() === "" ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Start typing to search projects</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No projects found</p>
              <p className="text-sm mt-1">Try different keywords</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project.id)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-secondary transition-smooth text-left group"
                >
                  <div className={`w-12 h-12 rounded-lg ${project.gradient} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground mb-1 truncate">
                      {highlightMatch(project.title, searchQuery)}
                    </p>
                    <p className="text-sm text-muted-foreground">{project.size}</p>
                  </div>
                  <FolderOpen className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-smooth flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchDialog;
