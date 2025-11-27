import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Card } from "@/components/ui/card";
import { Cloud, HardDrive } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Storage = () => {
  const [storageData, setStorageData] = useState({
    used: 0,
    total: 50, // 50 GB total storage on VPS
    categories: [] as Array<{ name: string; size: number; color: string }>,
  });

  // Fetch total storage used across all projects
  useEffect(() => {
    const fetchStorageUsage = async () => {
      try {
        const res = await fetch('/api/history/list');
        if (res.ok) {
          const projects = await res.json();
          
          console.log('[STORAGE] Fetched projects:', projects.length);
          
          // Calculate total storage used (sum of all project sizes)
          let totalUsedBytes = 0;
          projects.forEach((project: any) => {
            // Use totalSize (in bytes) if available, otherwise calculate from sizeInGB
            let projectSize = 0;
            if (project.totalSize && typeof project.totalSize === 'number' && project.totalSize > 0) {
              projectSize = project.totalSize;
            } else if (project.sizeInGB) {
              // Fallback: calculate from sizeInGB string
              const sizeGB = typeof project.sizeInGB === 'string' 
                ? parseFloat(project.sizeInGB) 
                : project.sizeInGB;
              if (!isNaN(sizeGB) && sizeGB > 0) {
                projectSize = sizeGB * 1024 * 1024 * 1024; // Convert GB to bytes
              }
            }
            totalUsedBytes += projectSize;
            console.log(`[STORAGE] Project ${project.id} (${project.name}): ${projectSize} bytes (${(projectSize / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
          });
          
          const usedInGB = totalUsedBytes / (1024 * 1024 * 1024);
          
          console.log(`[STORAGE] Total used: ${totalUsedBytes} bytes = ${usedInGB.toFixed(2)} GB`);
          
          // Ensure we have a valid number
          const finalUsedGB = isNaN(usedInGB) || usedInGB < 0 ? 0 : usedInGB;
          
          // Calculate storage by category (for now, all is "Projects")
          const categories = [
            {
              name: "Projects",
              size: parseFloat(finalUsedGB.toFixed(2)),
              color: "bg-primary"
            }
          ];
          
          setStorageData({
            used: parseFloat(finalUsedGB.toFixed(2)),
            total: 50,
            categories: categories,
          });
        } else {
          console.error('[STORAGE] Failed to fetch projects:', res.status);
        }
      } catch (error) {
        console.error('[STORAGE] Error fetching storage usage:', error);
      }
    };
    
    fetchStorageUsage();
    // Refresh every 5 seconds to keep storage usage updated
    const interval = setInterval(fetchStorageUsage, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-16">
        <TopBar />
        <main className="pt-16 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Storage
              </h1>
              <p className="text-muted-foreground">
                Manage your storage and files
              </p>
            </div>

            {/* Storage Overview */}
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <HardDrive className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    Storage Usage
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {storageData.used} GB of {storageData.total} GB used
                  </p>
                </div>
              </div>

              <Progress
                value={storageData.total > 0 ? Math.min((storageData.used / storageData.total) * 100, 100) : 0}
                className="h-3 mb-6"
              />

              {/* Storage Categories */}
              {storageData.categories.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {storageData.categories.map((category) => (
                    <Card key={category.name} className="p-4">
                      <div
                        className={`w-3 h-3 rounded-full ${category.color} mb-2`}
                      />
                      <p className="text-sm font-medium text-foreground mb-1">
                        {category.name}
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {category.size} GB
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Files */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Recent Files
              </h2>
              <div className="space-y-3">
                {/* Recent files will be fetched from API */}
                {storageData.categories.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No recent files
                  </p>
                )}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Storage;
