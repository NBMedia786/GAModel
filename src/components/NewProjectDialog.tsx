import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileText, LayoutDashboard, ShoppingCart, Newspaper, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const templates = [
  {
    id: "blank",
    name: "Blank Template",
    description: "Start from scratch",
    icon: Plus,
    gradient: "from-gray-500 to-gray-600",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Analytics and data visualization",
    icon: LayoutDashboard,
    gradient: "from-blue-500 to-blue-600",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Showcase your work",
    icon: FileText,
    gradient: "from-purple-500 to-purple-600",
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Online store template",
    icon: ShoppingCart,
    gradient: "from-green-500 to-green-600",
  },
  {
    id: "blog",
    name: "Blog",
    description: "Content publishing platform",
    icon: Newspaper,
    gradient: "from-orange-500 to-orange-600",
  },
];

const NewProjectDialog = ({ open, onOpenChange }: NewProjectDialogProps) => {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");

  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  const handleCreateProject = async () => {
    if (!selectedTemplate || !projectName.trim()) return;
    
    try {
      toast.loading("Creating project...", { id: 'create-project' });
      
      // Create project via API
      const response = await fetch('/api/project/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName: projectName.trim(),
          template: selectedTemplate,
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
      
      onOpenChange(false);
      
      // Navigate to the project page
      navigate(`/project/${data.projectId}`);
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast.error(`Failed to create project: ${error.message || 'Unknown error'}`, { id: 'create-project' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Left side - Templates */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Templates</Label>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {templates.map((template) => {
                const Icon = template.icon;
                const isSelected = selectedTemplate === template.id;
                return (
                  <Card
                    key={template.id}
                    className={`p-3 cursor-pointer transition-all duration-200 group ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => handleTemplateClick(template.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${template.gradient} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-foreground mb-1">
                          {template.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Right side - Project Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className="text-base"
              />
            </div>

            <div className="flex-1 flex items-center justify-center min-h-[300px] border-2 border-dashed border-border rounded-lg bg-muted/20">
              <div className="text-center p-8">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  {selectedTemplate && templates.find(t => t.id === selectedTemplate) && (
                    (() => {
                      const template = templates.find(t => t.id === selectedTemplate);
                      const Icon = template!.icon;
                      return <Icon className="w-8 h-8 text-muted-foreground" />;
                    })()
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate
                    ? `${templates.find(t => t.id === selectedTemplate)?.name} selected`
                    : "Select a template to get started"}
                </p>
              </div>
            </div>

            <Button
              onClick={handleCreateProject}
              disabled={!selectedTemplate || !projectName.trim()}
              className="w-full"
            >
              Create New Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectDialog;
