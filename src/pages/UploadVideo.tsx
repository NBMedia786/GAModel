import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Upload, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

const UploadVideo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Get project name from navigation state
    const state = location.state as { projectName?: string };
    if (state?.projectName) {
      setProjectName(state.projectName);
    }
  }, [location]);

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith("video/")) {
      setSelectedFile(file);
      if (!projectName) {
        setProjectName(file.name.replace(/\.[^/.]+$/, ""));
      }
    } else {
      toast.error("Please select a video file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !projectName) {
      toast.error("Please provide project name and select a video");
      return;
    }

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('prompt', 'Analyze for errors...');
      const sessionId = `hist-${Date.now()}`;
      formData.append('sessionId', sessionId);
      formData.append('projectName', projectName);

      // Upload to backend
      toast.loading("Uploading video and creating project...", { id: 'upload' });
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload failed');
      }

      // Wait a moment for the project to be saved
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success("Project created successfully! Redirecting...", { id: 'upload' });
      
      // Navigate to video player with the project
      navigate(`/project/${sessionId}/video/main`, {
        state: {
          file: selectedFile,
          projectName: projectName,
        }
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload: ${error.message || 'Unknown error'}`, { id: 'upload' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-16">
        <TopBar />
        <main className="pt-16 p-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Upload Video
              </h1>
              <p className="text-muted-foreground">
                Create a new project by uploading your video file
              </p>
            </div>

            <Card className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  placeholder="Enter project name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Video File</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Video className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {selectedFile.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-foreground font-medium mb-2">
                        Drop your video here or click to browse
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Supports MP4, MOV, AVI, and other video formats
                      </p>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileInput}
                        className="hidden"
                        id="videoInput"
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          document.getElementById("videoInput")?.click()
                        }
                      >
                        Browse Files
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => navigate("/")}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !projectName}
                >
                  Upload video
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UploadVideo;
