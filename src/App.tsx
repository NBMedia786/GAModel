import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { UserProvider, useUser } from "@/contexts/UserContext";
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
import Login from "./pages/Login";
import Admin from "./pages/Admin"; // [NEW]
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Public Route Check (optional, but good)
// const PublicOnly = ({ children }: { children: JSX.Element }) => { ... }

// Protected Route Component
const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useUser();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// [NEW] Admin Route Component
const RequireAdmin = ({ children }: { children: JSX.Element }) => {
  const { user, isAuthenticated } = useUser();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/" replace />;
  return children;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <NotificationsProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public Route */}
                <Route path="/login" element={<Login />} />

                {/* Admin Route */}
                <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />

                {/* Protected Routes */}
                <Route path="/" element={<RequireAuth><Index /></RequireAuth>} />
                <Route path="/upload" element={<RequireAuth><UploadVideo /></RequireAuth>} />
                <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
                <Route path="/storage" element={<RequireAuth><Storage /></RequireAuth>} />
                <Route path="/team" element={<RequireAuth><Team /></RequireAuth>} />
                <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
                <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
                <Route path="/project/:id" element={<RequireAuth><Project /></RequireAuth>} />
                <Route path="/project/:id/video/:fileId" element={<RequireAuth><VideoPlayer /></RequireAuth>} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </NotificationsProvider>
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
