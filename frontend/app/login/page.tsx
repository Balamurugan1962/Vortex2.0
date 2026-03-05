"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { login, register, setAuthToken } from "@/lib/api";

export default function LoginPage() {
    const router = useRouter();
    const [isRegistering, setIsRegistering] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("student"); // "student" or "instructor"

    // Settings
    const [registrationEnabled, setRegistrationEnabled] = useState(true);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial load: Check if registration is enabled
    useEffect(() => {
        import("@/lib/api").then(api => {
            api.getSettings().then(settings => {
                setRegistrationEnabled(settings.registration_enabled !== false);
            }).catch(console.error);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            let data;

            if (isRegistering) {
                // Submit explicitly selected role
                data = await register(name, email, password, role);
            } else {
                data = await login(email, password);
            }

            setAuthToken(data.token);

            // Access correct dashboard based on real database role
            if (data.user.role === "admin") {
                router.push("/admin/dashboard");
            } else if (data.user.role === "instructor") {
                router.push("/instructor/dashboard");
            } else {
                router.push("/student/connect");
            }

        } catch (err: any) {
            setError(err.message || "Authentication failed. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

            <Card className="w-full max-w-md bg-card/80 backdrop-blur-md border-border text-foreground shadow-2xl relative z-10 transition-all duration-300">
                <CardHeader className="space-y-2 text-center pb-8 border-b border-border/50">
                    <CardTitle className="text-3xl font-black tracking-tight text-foreground">OffGuard</CardTitle>
                    <CardDescription className="text-muted-foreground font-medium">Secure Desktop Examination Client</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-5 pt-8">
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium p-3 rounded-md flex items-center gap-2 animate-in fade-in">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {isRegistering && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-foreground font-semibold">Full Name</Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        placeholder="John Doe"
                                        required={isRegistering}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={isLoading}
                                        className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="role" className="text-foreground font-semibold">Account Type</Label>
                                    <select
                                        id="role"
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        disabled={isLoading}
                                        className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="student">Student</option>
                                        <option value="instructor">Instructor</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground font-semibold">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@offguard.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-foreground font-semibold">
                                    Password
                                </Label>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                required
                                placeholder="••••••••"
                                value={password}
                                disabled={isLoading}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-11"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pb-8 mt-2">
                        <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all h-11 text-base">
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Authenticating...</>
                            ) : (
                                isRegistering ? "Create Secure Account" : "Sign In to Environment"
                            )}
                        </Button>

                        {registrationEnabled && (
                            <div className="pt-2 text-center text-sm">
                                <button
                                    type="button"
                                    onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
                                    disabled={isLoading}
                                    className="text-muted-foreground hover:text-primary transition-colors font-medium border-b border-transparent hover:border-primary"
                                >
                                    {isRegistering ? "Already have an account? Sign In" : "Need access? Register here"}
                                </button>
                            </div>
                        )}

                        {!registrationEnabled && !isRegistering && (
                            <div className="pt-2 text-center text-xs text-muted-foreground">
                                Public registration is currently disabled by administrators.
                            </div>
                        )}
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
