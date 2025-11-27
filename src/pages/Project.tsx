import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import ProjectSidebar from "@/components/ProjectSidebar";
import ProjectTopBar from "@/components/ProjectTopBar";
import FileCard from "@/components/FileCard";
import { useState, useEffect, useRef } from "react";
import SearchDialog from "@/components/SearchDialog";
import ShareProjectDialog from "@/components/ShareProjectDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface ProjectFile {
  id: string;
  title: string;
  owner: string;
  date: string;
  gradient: string;
  type: "video" | "image" | "audio" | "document";
  duration?: string;
  deleted: boolean;
  size?: number;
  url?: string;
}

const Project = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string>("all");
  const [selectedCollection, setSelectedCollection] = useState<string>("all");
  const [selectedShareLink, setSelectedShareLink] = useState<string>("all");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [project, setProject] = useState({
    id,
    title: "Untitled Project",
    size: "0 GB",
    totalAssets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<string>("Custom");
  const [searchQuery, setSearchQuery] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ id: string; name: string } | null>(null);
  const [editFileName, setEditFileName] = useState("");

  // Fetch project data and files
  useEffect(() => {
    const fetchProjectData = async () => {
      if (!id) return;

      try {
        setLoading(true);

        // Fetch project metadata
        const metaRes = await fetch(`/api/history/list`);
        if (metaRes.ok) {
          const projects = await metaRes.json();
          const currentProject = projects.find((p: any) => p.id === id);
          if (currentProject) {
            setProject({
              id: currentProject.id,
              title: currentProject.name || "Untitled Project",
              size: "0 GB", // Calculate from files
              totalAssets: 0,
            });
          }
        }

        // Fetch project files
        const filesRes = await fetch(`/api/history/${id}/files`);
        if (filesRes.ok) {
          const projectFiles = await filesRes.json();
          setFiles(projectFiles);

          // Calculate total size
          const totalSize = projectFiles.reduce((sum: number, file: ProjectFile) => {
            return sum + (file.size || 0);
          }, 0);

          const sizeInGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
          setProject(prev => ({
            ...prev,
            totalAssets: projectFiles.length,
            size: `${sizeInGB} GB`,
          }));
        } else if (filesRes.status === 404) {
          // Project not found or no files yet
          setFiles([]);
        }
      } catch (error: any) {
        console.error('Error fetching project data:', error);
        toast.error("Failed to load project data");
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [id]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) {
      // Reset file input if no file selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Reset file input immediately to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('video', file);
      formData.append('projectId', id || '');
      formData.append('projectName', project.title);

      toast.loading("Uploading video...", { id: 'upload-video' });

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // Handle completion
      xhr.addEventListener('load', async () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            let data;
            try {
              data = JSON.parse(xhr.responseText);
            } catch (parseError) {
              // If response is not JSON, check if it's empty or text
              console.warn('Response is not JSON:', xhr.responseText);
              // Still try to proceed if we got a 200 status
              data = { success: true, message: 'Upload successful' };
            }

            toast.success("Video uploaded successfully!", { id: 'upload-video' });

            // Refresh the files list
            try {
              const filesRes = await fetch(`/api/history/${id}/files`);
              if (filesRes.ok) {
                const projectFiles = await filesRes.json();
                setFiles(projectFiles);

                // Recalculate total size
                const totalSize = projectFiles.reduce((sum: number, file: ProjectFile) => {
                  return sum + (file.size || 0);
                }, 0);

                const sizeInGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
                setProject(prev => ({
                  ...prev,
                  totalAssets: projectFiles.length,
                  size: `${sizeInGB} GB`,
                }));
              } else {
                console.warn('Failed to refresh file list, but upload succeeded');
              }
            } catch (refreshError) {
              console.error('Error refreshing file list:', refreshError);
              // Don't show error to user since upload succeeded
            }
          } else {
            // Handle error response
            let errorMessage = 'Upload failed';
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.error || errorMessage;
            } catch (e) {
              // If response is HTML (like error page), extract text
              if (xhr.responseText.includes('<')) {
                errorMessage = `Server error (${xhr.status}). Please try again.`;
              } else {
                errorMessage = xhr.responseText || errorMessage;
              }
            }
            toast.error(`Failed to upload: ${errorMessage}`, { id: 'upload-video' });
          }
        } catch (error) {
          console.error('Error handling upload response:', error);
          toast.error("An error occurred while processing the upload", { id: 'upload-video' });
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
      });

      // Handle network errors
      xhr.addEventListener('error', () => {
        toast.error("Network error during upload. Please check your connection and try again.", { id: 'upload-video' });
        setUploading(false);
        setUploadProgress(0);
      });

      // Handle timeout
      xhr.addEventListener('timeout', () => {
        toast.error("Upload timed out. Please try again.", { id: 'upload-video' });
        setUploading(false);
        setUploadProgress(0);
      });

      // Set timeout (5 minutes for large files)
      xhr.timeout = 300000;

      xhr.addEventListener('abort', () => {
        toast.error("Upload cancelled", { id: 'upload-video' });
        setUploading(false);
        setUploadProgress(0);
      });

      xhr.open('POST', '/api/project/upload');
      xhr.send(formData);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Failed to start upload: ${error.message || 'Unknown error'}`, { id: 'upload-video' });
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleEditFile = (fileId: string, currentName: string) => {
    setSelectedFile({ id: fileId, name: currentName });
    setEditFileName(currentName);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedFile || !id || !editFileName.trim()) return;

    try {
      toast.loading("Renaming file...", { id: 'rename-file' });

      const response = await fetch(`/api/history/${id}/files/${encodeURIComponent(selectedFile.name)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newName: editFileName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to rename file' }));
        throw new Error(errorData.error || 'Failed to rename file');
      }

      toast.success("File renamed successfully!", { id: 'rename-file' });
      setEditDialogOpen(false);
      setSelectedFile(null);
      setEditFileName("");

      // Refresh the files list
      const filesRes = await fetch(`/api/history/${id}/files`);
      if (filesRes.ok) {
        const projectFiles = await filesRes.json();
        setFiles(projectFiles);
      }
    } catch (error: any) {
      console.error('Error renaming file:', error);
      toast.error(`Failed to rename file: ${error.message || 'Unknown error'}`, { id: 'rename-file' });
    }
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    setSelectedFile({ id: fileId, name: fileName });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedFile || !id) return;

    try {
      // Check if we're in "Recently Deleted" view - if so, permanently delete
      const isPermanentDelete = selectedAsset === "deleted";
      const actionText = isPermanentDelete ? "Permanently deleting" : "Moving to recently deleted";

      toast.loading(`${actionText} file...`, { id: 'delete-file' });

      // Encode the filename to handle special characters
      const encodedFileName = encodeURIComponent(selectedFile.name);
      const url = `/api/history/${id}/files/${encodedFileName}${isPermanentDelete ? '?permanent=true' : ''}`;

      console.log('Deleting file:', selectedFile.name);
      console.log('Permanent delete:', isPermanentDelete);
      console.log('Delete URL:', url);

      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to delete file';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const errorText = await response.text().catch(() => '');
          errorMessage = errorText || errorMessage;
        }
        console.error('Delete error response:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Delete success:', result);

      const successMessage = isPermanentDelete
        ? "File permanently deleted!"
        : "File moved to recently deleted!";
      toast.success(successMessage, { id: 'delete-file' });
      setDeleteDialogOpen(false);
      setSelectedFile(null);

      // Refresh the files list
      const filesRes = await fetch(`/api/history/${id}/files`);
      if (filesRes.ok) {
        const projectFiles = await filesRes.json();
        setFiles(projectFiles);

        // Recalculate total size (only count non-deleted files)
        const nonDeletedFiles = projectFiles.filter((f: ProjectFile) => !f.deleted);
        const totalSize = nonDeletedFiles.reduce((sum: number, file: ProjectFile) => {
          return sum + (file.size || 0);
        }, 0);

        const sizeInGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
        setProject(prev => ({
          ...prev,
          totalAssets: nonDeletedFiles.length,
          size: `${sizeInGB} GB`,
        }));
      }
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error(`Failed to delete file: ${error.message || 'Unknown error'}`, { id: 'delete-file' });
    }
  };

  // Sort files
  const sortFiles = (fileList: ProjectFile[]) => {
    const sorted = [...fileList];
    switch (sortBy) {
      case "Name":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "Date Modified":
      case "Date Created":
        return sorted.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });
      case "Size":
        return sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
      case "Type":
        return sorted.sort((a, b) => a.type.localeCompare(b.type));
      case "Custom":
      default:
        return sorted;
    }
  };

  // Filter files based on selected asset, collection, share links, and search
  const filteredFiles = files.filter(file => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!file.title.toLowerCase().includes(query) &&
        !file.owner.toLowerCase().includes(query)) {
        return false;
      }
    }
    // If share links are selected, show only shared files
    if (selectedShareLink !== "all") {
      // In a real app, you'd check if file is shared or has C2C connection
      // For now, we'll just return true to show all files when share links are selected
      return true;
    }

    // Handle "Recently Deleted" filter
    if (selectedAsset === "deleted") {
      return file.deleted === true;
    }

    // Handle collection filters
    if (selectedCollection !== "all") {
      if (selectedCollection === "review") {
        // Files that need review - in a real app, check a review flag
        // For now, we'll show files that might need review (you can add a needsReview property)
        return true; // Placeholder - add needsReview property to files
      }
      // Filter by type: video, audio, image
      if (selectedCollection !== file.type) {
        return false;
      }
    }

    // Handle asset filters (excluding deleted which is handled above)
    if (selectedAsset !== "all" && selectedAsset !== "deleted") {
      if (selectedAsset !== file.type) {
        return false;
      }
    }

    // Show only deleted files when "Recently Deleted" is selected
    if (selectedAsset === "deleted") {
      return file.deleted === true;
    }

    // Exclude deleted files when viewing normal assets
    if (file.deleted) {
      return false;
    }

    return true;
  });

  // Apply sorting to filtered files
  const sortedAndFilteredFiles = sortFiles(filteredFiles);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onSearchClick={() => setSearchDialogOpen(true)} />
      <ProjectSidebar
        projectTitle={project.title || "Untitled Project"}
        selectedAsset={selectedAsset}
        onAssetChange={setSelectedAsset}
        selectedCollection={selectedCollection}
        onCollectionChange={setSelectedCollection}
        selectedShareLink={selectedShareLink}
        onShareLinkChange={setSelectedShareLink}
      />
      <SearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        projects={[]}
      />
      <ShareProjectDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        projectName={project.title}
        projectId={id || ""}
      />

      <main className="ml-80">
        <ProjectTopBar
          projectTitle={project.title}
          totalAssets={filteredFiles.length}
          totalSize={project.size}
          onShareClick={() => setShareDialogOpen(true)}
          onUploadClick={handleUploadClick}
          showUploadButton={filteredFiles.length > 0 && selectedAsset !== "deleted"}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onSearch={setSearchQuery}
          onTeamClick={() => navigate("/team")}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="mx-6 mt-4 p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uploading video...</span>
              <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        <div className="p-6">
          {/* Assets Header */}
          <div className="flex items-center gap-3 mb-6">
            <Checkbox id="select-all" />
            <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
              {sortedAndFilteredFiles.length} Assets • {project.size}
            </label>
          </div>

          {/* Files Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : sortedAndFilteredFiles.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-lg border border-dashed">
              <h3 className="text-lg font-medium">
                {searchQuery ? "No files found" : "No files yet"}
              </h3>
              <p className="text-muted-foreground mt-2 mb-6">
                {searchQuery ? "Try a different search term" : "Upload a video to get started"}
              </p>
              {!searchQuery && selectedAsset !== "deleted" && (
                <Button
                  onClick={handleUploadClick}
                  className="gap-2"
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Upload video"}
                </Button>
              )}
            </div>
          ) : (
            <div className={viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              : "flex flex-col gap-3"
            }>
              {sortedAndFilteredFiles.map((file) => (
                <FileCard
                  key={file.id}
                  title={file.title}
                  owner={file.owner}
                  date={file.date}
                  gradient={file.gradient}
                  type={file.type}
                  duration={file.duration}
                  projectId={id}
                  fileId={file.title}
                  viewMode={viewMode}
                  onEdit={handleEditFile}
                  onDelete={handleDeleteFile}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit File Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fileName">File Name</Label>
              <Input
                id="fileName"
                value={editFileName}
                onChange={(e) => setEditFileName(e.target.value)}
                placeholder="Enter file name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editFileName.trim()) {
                    handleSaveEdit();
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
                setEditDialogOpen(false);
                setSelectedFile(null);
                setEditFileName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editFileName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete File Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedAsset === "deleted" ? "Permanently Delete File" : "Delete File"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAsset === "deleted" ? (
                <>
                  Are you sure you want to permanently delete <strong>{selectedFile?.name}</strong>?
                  This action cannot be undone and the file will be permanently removed from your system.
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong>{selectedFile?.name}</strong>?
                  The file will be moved to "Recently Deleted" where you can restore it or permanently delete it later.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {selectedAsset === "deleted" ? "Permanently Delete" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Project;
