import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Notification {
  id: number;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  refreshNotifications: () => void;
}

export const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
};

interface NotificationsProviderProps {
  children: ReactNode;
}

export const NotificationsProvider = ({ children }: NotificationsProviderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        if (res.status === 404) {
          // No notifications yet, that's okay
          setNotifications([]);
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch notifications: ${res.status}`);
      }
      const data: Notification[] = await res.json();
      setNotifications(data);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
      });
      if (!res.ok) {
        throw new Error('Failed to mark notification as read');
      }
      // Update local state optimistically
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      // Revert on error
      await fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PUT',
      });
      if (!res.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      // Update local state optimistically
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      // Revert on error
      await fetchNotifications();
    }
  };

  const deleteAllNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete all notifications');
      }
      // Update local state
      setNotifications([]);
    } catch (error: any) {
      console.error('Error deleting all notifications:', error);
      // Revert on error
      await fetchNotifications();
    }
  };

  const refreshNotifications = () => {
    fetchNotifications();
  };

  useEffect(() => {
    // Wrap in try-catch to prevent crashes
    try {
      fetchNotifications();
      // Refresh notifications every 30 seconds (already reasonable)
      // Only poll when page is visible
      let interval: NodeJS.Timeout | null = null;
      
      const startPolling = () => {
        if (interval) clearInterval(interval);
        interval = setInterval(() => {
          if (!document.hidden) {
            try {
              fetchNotifications();
            } catch (error) {
              console.error('Error in notification refresh interval:', error);
            }
          }
        }, 30000);
      };

      startPolling();

      const handleVisibilityChange = () => {
        if (document.hidden) {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        } else {
          fetchNotifications();
          startPolling();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (interval) clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } catch (error) {
      console.error('Error setting up notifications:', error);
      setLoading(false);
    }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteAllNotifications,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};
