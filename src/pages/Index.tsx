import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import FilterBar from "@/components/FilterBar";
import ProjectCard from "@/components/ProjectCard";
import SearchDialog from "@/components/SearchDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  source: string;
  createdAt: number;
  videoFileName?: string;
  totalSize?: number;
  sizeInGB?: string;
  lastUpdated?: number;
}

// Gradient options for project cards
const gradients = [
  "bg-gradient-blue-purple",
  "bg-gradient-purple-pink",
  "bg-gradient-cyan-blue",
  "bg-gradient-orange-pink",
  "bg-gradient-pink-purple",
];

const Index = () => {
  const navigate = useNavigate();
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [filterBy, setFilterBy] = useState("Active Projects");
  const [sortBy, setSortBy] = useState("Name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [projects, setProjects] = useState<Array<Project & { title: string; size: string; gradient: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Fetch History from Backend
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/history/list');
        if (!res.ok) {
          if (res.status === 404) {
            // No projects yet, that's okay
            setProjects([]);
            setLoading(false);
            return;
          }
          throw new Error(`Failed to fetch: ${res.status}`);
        }
        const data: Project[] = await res.json();

        // Map backend data to ProjectCard format
        const mappedProjects = data.map((project, index) => {
          // Calculate size from totalSize (in bytes) or use sizeInGB if available
          let sizeValue = "0.00";

          // Prefer totalSize (in bytes) for accurate calculation
          if (project.totalSize && typeof project.totalSize === 'number' && project.totalSize > 0) {
            sizeValue = (project.totalSize / (1024 * 1024 * 1024)).toFixed(2);
          } else if (project.sizeInGB) {
            // Fallback to sizeInGB if totalSize is not available
            const sizeGB = typeof project.sizeInGB === 'string'
              ? parseFloat(project.sizeInGB)
              : project.sizeInGB;
            if (!isNaN(sizeGB) && sizeGB > 0) {
              sizeValue = sizeGB.toFixed(2);
            }
          }

          console.log(`[FRONTEND] Project ${project.id} (${project.name}): sizeInGB=${project.sizeInGB}, totalSize=${project.totalSize}, finalSize=${sizeValue} GB`);

          return {
            ...project,
            title: project.name || 'Untitled Project',
            size: `${sizeValue} GB`, // Use calculated size from backend
            gradient: gradients[index % gradients.length],
          };
        });

        setProjects(mappedProjects);
      } catch (error: any) {
        console.error('Error fetching projects:', error);
        // Only show error on initial load, not on refresh
        if (loading) {
          toast.error("Could not load projects. Is the backend running?");
        }
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    // Refresh projects every 10 seconds to catch new uploads
    // Only poll when page is visible to reduce unnecessary requests
    let interval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        // Only fetch if page is visible
        if (!document.hidden) {
          fetchHistory();
        }
      }, 10000); // 10 seconds instead of 3
    };

    // Start polling
    startPolling();

    // Pause polling when page is hidden, resume when visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } else {
        fetchHistory(); // Fetch immediately when page becomes visible
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loading]);

  const handleRename = (id: string, newName: string) => {
    setProjects(prev =>
      prev.map(project =>
        project.id === id ? { ...project, title: newName, name: newName } : project
      )
    );
    toast.success("Project renamed");
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/history/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete project' }));
        throw new Error(error.error || `Failed to delete: ${res.status}`);
      }

      // Update local state after successful deletion
      setProjects(prev => prev.filter(project => project.id !== id));
      toast.success("Project deleted");
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error(error.message || "Failed to delete project");
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }

    try {
      setCreatingProject(true);
      toast.loading("Creating project...", { id: 'create-project' });

      const response = await fetch('/api/project/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName: projectName.trim(),
          template: 'blank',
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create project';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = await response.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      toast.success("Project created successfully!", { id: 'create-project' });

      setNewProjectDialogOpen(false);
      setProjectName("");

      // Refresh projects list
      const res = await fetch('/api/history/list');
      if (res.ok) {
        const projectData: Project[] = await res.json();
        const mappedProjects = projectData.map((project, index) => ({
          ...project,
          title: project.name || 'Untitled Project',
          size: "0 GB",
          gradient: gradients[index % gradients.length],
        }));
        setProjects(mappedProjects);
      }

      // Navigate to the new project
      navigate(`/project/${data.projectId}`);
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast.error(`Failed to create project: ${error.message || 'Unknown error'}`, { id: 'create-project' });
    } finally {
      setCreatingProject(false);
    }
  };

  // Combine all projects for search
  const allProjects = projects.map(p => ({
    id: p.id,
    title: p.title,
    size: p.size,
    gradient: p.gradient,
  }));

  // Filter projects
  const filterProjects = (projects: typeof allProjects) => {
    // For now, just return all projects since we don't have status info
    return projects;
  };

  // Sort projects
  const sortProjects = (projectsToSort: typeof allProjects) => {
    const sorted = [...projectsToSort];
    switch (sortBy) {
      case "Name":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "Size":
        return sorted.sort((a, b) => {
          const sizeA = parseFloat(a.size);
          const sizeB = parseFloat(b.size);
          return sizeB - sizeA;
        });
      case "Date Modified":
      case "Date Created":
        // Sort by creation date from original projects state
        return sorted.sort((a, b) => {
          const fullA = projects.find(p => p.id === a.id);
          const fullB = projects.find(p => p.id === b.id);
          const dateA = fullA?.lastUpdated || fullA?.createdAt || 0;
          const dateB = fullB?.lastUpdated || fullB?.createdAt || 0;
          return dateB - dateA;
        });
      default:
        return sorted;
    }
  };

  const filteredAndSorted = sortProjects(filterProjects(allProjects));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onSearchClick={() => setSearchDialogOpen(true)} />
      <TopBar />
      <SearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        projects={allProjects}
      />

      {/* Main Content */}
      <main className="ml-16 pt-16">
        <div className="p-6 space-y-8">
          {/* Header Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Projects</h1>
              <p className="text-muted-foreground mt-1">
                Manage your AI video analysis projects
              </p>
            </div>
            <Button onClick={() => setNewProjectDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>

          {/* Filter Bar */}
          <FilterBar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            filterBy={filterBy}
            onFilterChange={setFilterBy}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {/* Projects List */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-lg border border-dashed">
              <h3 className="text-lg font-medium">No projects yet</h3>
              <p className="text-muted-foreground mb-4">Create a new project to get started</p>
              <Button
                onClick={() => setNewProjectDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New Project
              </Button>
            </div>
          ) : (
            <div className={viewMode === "grid"
              ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"
              : "flex flex-col gap-3"
            }>
              {filteredAndSorted.map((project) => {
                const fullProject = projects.find(p => p.id === project.id);
                return (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    title={project.title}
                    size={project.size}
                    gradient={project.gradient}
                    lastUpdated={fullProject?.lastUpdated || fullProject?.createdAt || Date.now()}
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* New Project Dialog */}
      <Dialog open={newProjectDialogOpen} onOpenChange={setNewProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && projectName.trim()) {
                    handleCreateProject();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewProjectDialogOpen(false);
                setProjectName("");
              }}
              disabled={creatingProject}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!projectName.trim() || creatingProject}
            >
              {creatingProject ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
