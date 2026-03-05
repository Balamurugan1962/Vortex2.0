"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Simulate role check based on email domain
        if (email.includes("@instructor.com") || email.includes("admin")) {
            router.push("/instructor/dashboard");
        } else {
            router.push("/student/connect");
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

            <Card className="w-full max-w-md bg-card/80 backdrop-blur-md border-border text-foreground shadow-2xl relative z-10">
                <CardHeader className="space-y-2 text-center pb-8 border-b border-border/50">
                    <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-primary-foreground"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
                    </div>
                    <CardTitle className="text-3xl font-black tracking-tight text-foreground">VortexExam</CardTitle>
                    <CardDescription className="text-muted-foreground font-medium">Secure Desktop Examination Client</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-6 pt-8">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground font-semibold">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@vortex.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-foreground font-semibold">Password</Label>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-12"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pb-12">
                        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all h-12 text-lg">
                            Sign In to Environment
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground/50 uppercase font-bold tracking-widest">
                            Secure Authentication Required
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
