import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Project from "./pages/Project";
import VideoPlayer from "./pages/VideoPlayer";
import UploadVideo from "./pages/UploadVideo";
import Notifications from "./pages/Notifications";
import Storage from "./pages/Storage";
import Team from "./pages/Team";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationsProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/upload" element={<UploadVideo />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/storage" element={<Storage />} />
              <Route path="/team" element={<Team />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/project/:id" element={<Project />} />
              <Route path="/project/:id/video/:fileId" element={<VideoPlayer />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </NotificationsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
