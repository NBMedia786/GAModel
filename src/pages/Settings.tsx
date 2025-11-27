import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Card } from "@/components/ui/card";
import { Settings as SettingsIcon, User, Bell, Shield, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface UserSettings {
  firstName: string;
  lastName: string;
  email: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  commentNotifications: boolean;
  darkMode: boolean;
}

const Settings = () => {
  const [settings, setSettings] = useState<UserSettings>({
    firstName: "Arpit",
    lastName: "Sharma",
    email: "arpit@nbmediaproductions.com",
    emailNotifications: false,
    pushNotifications: false,
    commentNotifications: true,
    darkMode: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        // Use default values if loading fails
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleProfileChange = (field: keyof UserSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationToggle = (field: keyof UserSettings) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }));
    // Auto-save notification preferences
    saveNotificationPreference(field, !settings[field]);
  };

  const handleAppearanceToggle = () => {
    const newValue = !settings.darkMode;
    setSettings(prev => ({ ...prev, darkMode: newValue }));
    saveAppearancePreference(newValue);
  };

  const saveNotificationPreference = async (field: keyof UserSettings, value: boolean) => {
    try {
      await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch (error) {
      console.error('Error saving notification preference:', error);
    }
  };

  const saveAppearancePreference = async (darkMode: boolean) => {
    try {
      await fetch('/api/settings/appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ darkMode }),
      });
      toast.success("Appearance preference saved");
    } catch (error) {
      console.error('Error saving appearance preference:', error);
      toast.error("Failed to save appearance preference");
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: settings.firstName,
          lastName: settings.lastName,
          email: settings.email,
        }),
      });

      if (res.ok) {
        toast.success("Profile updated successfully");
      } else {
        throw new Error('Failed to save profile');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      const res = await fetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (res.ok) {
        toast.success("Password changed successfully");
        setChangePasswordDialogOpen(false);
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || "Failed to change password");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await fetch('/api/settings/account', {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success("Account deleted successfully");
        // Redirect to home or login page
        window.location.href = '/';
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete account');
      }
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || "Failed to delete account");
    }
  };
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-16">
        <TopBar />
        <main className="pt-16 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Settings
              </h1>
              <p className="text-muted-foreground">
                Manage your account and preferences
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <p className="text-muted-foreground">Loading settings...</p>
              </div>
            ) : (
              <>

            {/* Profile Settings */}
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  Profile Settings
                </h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      placeholder="John" 
                      value={settings.firstName}
                      onChange={(e) => handleProfileChange('firstName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      placeholder="Doe" 
                      value={settings.lastName}
                      onChange={(e) => handleProfileChange('lastName', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    value={settings.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                  />
                </div>

                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </Card>

            {/* Notification Settings */}
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <Bell className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  Notifications
                </h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive email updates about your projects
                    </p>
                  </div>
                  <Switch 
                    checked={settings.emailNotifications}
                    onCheckedChange={() => handleNotificationToggle('emailNotifications')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified about important updates
                    </p>
                  </div>
                  <Switch 
                    checked={settings.pushNotifications}
                    onCheckedChange={() => handleNotificationToggle('pushNotifications')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Comment Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone comments
                    </p>
                  </div>
                  <Switch 
                    checked={settings.commentNotifications}
                    onCheckedChange={() => handleNotificationToggle('commentNotifications')}
                  />
                </div>
              </div>
            </Card>

            {/* Appearance Settings */}
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <Palette className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  Appearance
                </h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">
                      Use dark theme throughout the app
                    </p>
                  </div>
                  <Switch 
                    checked={settings.darkMode}
                    onCheckedChange={handleAppearanceToggle}
                  />
                </div>
              </div>
            </Card>

            {/* Security Settings */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">
                  Security
                </h2>
              </div>

              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  onClick={() => setChangePasswordDialogOpen(true)}
                >
                  Change Password
                </Button>
                <Separator />
                <Button 
                  variant="destructive" 
                  onClick={() => setDeleteAccountDialogOpen(true)}
                >
                  Delete Account
                </Button>
              </div>
            </Card>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword}>
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
