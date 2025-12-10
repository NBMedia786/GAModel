import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Card } from "@/components/ui/card";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Messages = () => {
  // Conversations - will be fetched from API
  const conversations: Array<{
    id: number;
    name: string;
    lastMessage: string;
    time: string;
    unread: number;
    initials: string;
  }> = [];

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 ml-16">
        <TopBar />
        <main className="pt-16 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Messages
              </h1>
              <p className="text-muted-foreground">
                Chat with your team members
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Conversations List */}
              <Card className="p-4 md:col-span-1">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Conversations
                </h2>
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {conv.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-sm text-foreground truncate">
                              {conv.name}
                            </p>
                            {conv.unread > 0 && (
                              <span className="w-5 h-5 bg-primary rounded-full text-xs flex items-center justify-center text-primary-foreground">
                                {conv.unread}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.lastMessage}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {conv.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Chat Area */}
              <Card className="p-6 md:col-span-2 flex flex-col">
                <div className="flex-1 flex items-center justify-center min-h-[400px]">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-foreground font-medium mb-2">
                      No conversation selected
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Choose a conversation from the list to start messaging
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Input placeholder="Type a message..." className="flex-1" />
                  <Button>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Messages;
