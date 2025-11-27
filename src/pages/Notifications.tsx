import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Card } from "@/components/ui/card";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNotifications } from "@/contexts/NotificationsContext";

const Notifications = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteAllNotifications } = useNotifications();

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    toast.success("All notifications marked as read");
  };

  const handleMarkAsRead = async (id: number) => {
    await markAsRead(id);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-16">
        <TopBar />
        <main className="pt-16 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-3 text-lg text-muted-foreground">
                      ({unreadCount} unread)
                    </span>
                  )}
                </h1>
                <p className="text-muted-foreground">
                  Stay updated with your project activities
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark all as read
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete all notifications?')) {
                      await deleteAllNotifications();
                      toast.success("All notifications deleted");
                    }
                  }}
                  disabled={notifications.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <Card
                    key={notification.id}
                    onClick={() => handleMarkAsRead(notification.id)}
                    className={`p-4 cursor-pointer hover:border-primary transition-colors ${!notification.read ? "bg-primary/5 border-primary/20" : ""
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${!notification.read ? "bg-primary" : "bg-muted"
                        }`}>
                        <Bell className={`w-5 h-5 ${!notification.read ? "text-primary-foreground" : "text-muted-foreground"
                          }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground mb-1">
                          {notification.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {notification.time}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </Card>
                )))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Notifications;
