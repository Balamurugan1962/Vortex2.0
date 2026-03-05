"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, CheckCircle2, Clock, Users, ArrowUpRight, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";

const stats = [
    { label: "Total Exams", value: "12", icon: FileText, color: "text-blue-400" },
    { label: "Active Exams", value: "3", icon: Clock, color: "text-amber-400" },
    { label: "Completed", value: "45", icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Total Students", value: "1.2k", icon: Users, color: "text-purple-400" },
];

export default function InstructorDashboard() {
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Instructor Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Manage your examinations and monitor student progress.</p>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </Button>
                    <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                        <Link href="/instructor/create-exam">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New Exam
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <Card key={stat.label} className="bg-card border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                            <stat.icon className={cn("w-4 h-4", stat.color.replace('blue', 'primary').replace('amber', 'orange').replace('emerald', 'emerald').replace('purple', 'primary'))} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-foreground">Recent Exams</CardTitle>
                        <CardDescription>Your recently created or scheduled exams.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-md bg-muted/20 border border-border/50 hover:bg-muted/40 transition-all cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {i}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-foreground">Mid-term Computer Science {i}</div>
                                            <div className="text-sm text-muted-foreground">Scheduled: 24th March, 2024</div>
                                        </div>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-foreground">Active Submissions</CardTitle>
                        <CardDescription>Live monitoring of ongoing exams.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center mb-4">
                                <Users className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium text-foreground">No active sessions</h3>
                            <p className="text-sm text-muted-foreground mt-1">Start an exam to monitor submissions in real-time.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
