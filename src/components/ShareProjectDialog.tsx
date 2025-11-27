import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Copy, Check, Mail, Link as LinkIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectId: string;
}

const ShareProjectDialog = ({ open, onOpenChange, projectName, projectId }: ShareProjectDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const shareLink = `${window.location.origin}/project/${projectId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast({
      title: "Link copied!",
      description: "Share link has been copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = () => {
    if (email.trim()) {
      toast({
        title: "Invite sent!",
        description: `Invitation sent to ${email}`,
      });
      setEmail("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
          <DialogDescription>
            Share <strong>{projectName}</strong> with your team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Copy Link */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Share Link
            </Label>
            <div className="flex gap-2">
              <Input
                value={shareLink}
                readOnly
                className="flex-1"
              />
              <Button onClick={handleCopyLink} size="icon" variant="secondary">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Email Invite */}
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Invite by Email
            </Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
              />
              <Button onClick={handleSendInvite} disabled={!email.trim()}>
                Send
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareProjectDialog;
