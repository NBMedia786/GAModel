import { Home, Search, Bell, Cloud, Users, MessageSquare, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useContext } from "react";
import { NotificationsContext } from "@/contexts/NotificationsContext";
import { useUser } from "@/contexts/UserContext";

interface SidebarProps {
  className?: string;
  onSearchClick?: () => void;
}

const Sidebar = ({ className, onSearchClick }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  // Get unread count from notifications context
  // If context is not available, default to 0
  const notificationsContext = useContext(NotificationsContext);
  const unreadCount = notificationsContext?.unreadCount ?? 0;

  const navItems = [
    // { icon: Home, label: "Home", path: "/" }, // Removed redundant home button
    { icon: Search, label: "Search", onClick: onSearchClick },
    { icon: Bell, label: "Notifications", badge: unreadCount > 0 ? unreadCount : undefined, path: "/notifications" },
    { icon: Cloud, label: "Storage", path: "/storage" },
    { icon: Users, label: "Team", path: "/team" },
    { icon: MessageSquare, label: "Messages", path: "/messages" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  // Add Admin Link if User is Admin
  if (user?.isAdmin) {
    navItems.push({ icon: Shield, label: "Admin", path: "/admin" });
  }



  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <aside className={cn("fixed left-0 top-0 h-screen w-16 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 z-50", className)}>
      {/* Home Icon */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary hover:bg-primary/90 transition-smooth"
        >
          <Home className="w-5 h-5 text-primary-foreground" />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-2 w-full px-2">
        {navItems.map((item, index) => {
          const isActive = item.path === location.pathname;
          return (
            <button
              key={index}
              onClick={() => handleNavClick(item)}
              className={cn(
                "relative w-12 h-12 flex items-center justify-center rounded-lg transition-smooth group",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-xs flex items-center justify-center text-destructive-foreground font-semibold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
