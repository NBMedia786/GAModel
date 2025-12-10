import { Button } from "@/components/ui/button";
import { Sparkles, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";

const Login = () => {

    const handleGoogleLogin = () => {
        // Redirect to Backend OAuth Endpoint
        window.location.href = "http://localhost:3000/api/auth/google";
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
            {/* Professional Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

            {/* Subtle Top Glow */}
            <div className="absolute top-0 left-0 right-0 h-[500px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

            <Card className="max-w-[400px] w-full bg-slate-900/80 backdrop-blur-xl border-slate-800 p-8 shadow-2xl relative z-10 flex flex-col items-center text-center ring-1 ring-white/5">
                {/* Logo Area */}
                <div className="mb-8 relative group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                    <div className="relative w-16 h-16 bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center shadow-xl">
                        <Sparkles className="w-8 h-8 text-purple-400" />
                    </div>
                </div>

                <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">Internal Workspace</h1>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                    NB Media Productions
                    <br />
                    <span className="text-slate-500 text-xs">Employee Access Portal</span>
                </p>

                <Button
                    size="lg"
                    className="w-full bg-white text-slate-900 hover:bg-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all font-medium h-12 border border-slate-200 shadow-sm"
                    onClick={handleGoogleLogin}
                >
                    <div className="flex items-center justify-center gap-3">
                        <svg className="h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                            <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                        </svg>
                        <span>Continue with Google</span>
                    </div>
                </Button>

                <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-slate-600 uppercase tracking-widest font-medium">
                    <Shield className="w-3 h-3" />
                    <span>Secure Environment</span>
                </div>
            </Card>
        </div>
    );
};

export default Login;
