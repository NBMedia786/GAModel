import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import SearchDialog from "@/components/SearchDialog";
import { useUser } from "@/contexts/UserContext";
import { Card } from "@/components/ui/card";
import { Users, HardDrive, FolderOpen, Shield, Activity } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const Admin = () => {
    const { user } = useUser();
    const { toast } = useToast();
    const [searchDialogOpen, setSearchDialogOpen] = useState(false);

    // Fetch Stats (Live Polling every 3s)
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['adminStats'],
        queryFn: async () => {
            const res = await fetch('/api/admin/stats', {
                headers: { 'x-user-email': user?.email || '' }
            });
            if (!res.ok) throw new Error('Failed to fetch stats');
            return res.json();
        },
        refetchInterval: 3000,
        enabled: !!user?.email
    });

    // Fetch Users (Live Polling every 3s)
    const { data: users = [], isLoading: usersLoading } = useQuery({
        queryKey: ['adminUsers'],
        queryFn: async () => {
            const res = await fetch('/api/admin/users', {
                headers: { 'x-user-email': user?.email || '' }
            });
            if (!res.ok) throw new Error('Failed to fetch users');
            const data = await res.json();
            // Sort by last login (desc)
            return data.sort((a: any, b: any) =>
                new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
            );
        },
        refetchInterval: 3000,
        enabled: !!user?.email
    });

    const isLoading = statsLoading || usersLoading;

    if (isLoading && !stats && users.length === 0) { // Only show full loader on initial load
        return (
            <div className="flex h-screen bg-slate-950 items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    <p>Initializing Live Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden">
            <Sidebar onSearchClick={() => setSearchDialogOpen(true)} />
            <SearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} projects={[]} />

            <main className="flex-1 overflow-y-auto p-8 ml-16">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Shield className="w-8 h-8 text-purple-500" />
                                Admin Dashboard
                            </h1>
                            <p className="text-slate-400 mt-2">
                                Overview of NB Media Productions Workspace
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 px-4 py-2 rounded-full backdrop-blur-md">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <span className="text-xs font-mono text-green-400 font-medium">LIVE UPDATES ACTIVE</span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatsCard
                            icon={Users}
                            label="Total Users"
                            value={stats?.users || 0}
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                            border="border-blue-500/20"
                        />
                        <StatsCard
                            icon={FolderOpen}
                            label="Active Projects"
                            value={stats?.projects || 0}
                            color="text-purple-400"
                            bg="bg-purple-500/10"
                            border="border-purple-500/20"
                        />
                        <StatsCard
                            icon={HardDrive}
                            label="Storage Used"
                            value={`${stats?.storageGB || "0.00"} GB`}
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            border="border-emerald-500/20"
                        />
                    </div>

                    {/* Users Table */}
                    <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-slate-400" />
                                User Activity
                            </h2>
                            <Badge variant="outline" className="border-slate-700 text-slate-400 font-mono text-xs">
                                Refreshes every 3s
                            </Badge>
                        </div>

                        <div className="rounded-md border border-slate-800">
                            <Table>
                                <TableHeader className="bg-slate-900">
                                    <TableRow className="border-slate-800 hover:bg-transparent">
                                        <TableHead className="text-slate-400">User</TableHead>
                                        <TableHead className="text-slate-400">Role</TableHead>
                                        <TableHead className="text-slate-400">Joined</TableHead>
                                        <TableHead className="text-slate-400">Last Active</TableHead>
                                        <TableHead className="text-slate-400 text-right">Logins</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((u: any) => (
                                        <TableRow key={u.email} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                                            <TableCell className="font-medium text-white">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border border-slate-700">
                                                        <AvatarImage src={u.photoURL} />
                                                        <AvatarFallback className="bg-slate-800 text-slate-300">
                                                            {u.firstName?.[0]}{u.lastName?.[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
                                                        <div className="text-xs text-slate-500">{u.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {u.isAdmin ? (
                                                    <Badge className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border-purple-500/50">Admin</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-400 border-slate-700">Member</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-sm">
                                                {new Date(u.joinedAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-sm font-mono text-xs">
                                                {formatDistanceToNow(new Date(u.lastLogin), { addSuffix: true })}
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-sm text-right">
                                                {u.loginCount || 1}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>

                </div>
            </main>
        </div>
    );
};

const StatsCard = ({ icon: Icon, label, value, color, bg, border }: any) => (
    <Card className={`p-6 bg-slate-900/50 backdrop-blur-sm border ${border} relative overflow-hidden group`}>
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
            <Icon className="w-24 h-24" />
        </div>
        <div className="relative z-10">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">{label}</p>
            <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
        </div>
    </Card>
);

export default Admin;
