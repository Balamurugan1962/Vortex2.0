"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, CheckCircle2, Clock, Users, ArrowUpRight, LogOut, AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout, getBaseApiUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useToast, ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Exam {
    id: string;
    title: string;
    description: string;
    status: string;
    scheduled_at: string;
}

interface Submission {
    id: number;
    user_email: string;
    exam_id: string;
    violations: number;
    violations_details: any;
    submitted_at: string;
    responses: any;
}

export default function InstructorDashboard() {
    return (
        <ToastProvider>
            <InstructorDashboardContent />
        </ToastProvider>
    );
}

function InstructorDashboardContent() {
    const router = useRouter();
    const { addToast } = useToast();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedExamId, setSelectedExamId] = useState<string | "all">("all");

    const handleDeleteExam = async (e: React.MouseEvent, examId: string) => {
        e.stopPropagation(); // Don't trigger the filter click

        if (examId === 'default') {
            addToast({
                title: "Action Restricted",
                description: "The default assessment cannot be deleted.",
                variant: "warning"
            });
            return;
        }

        if (!confirm("Are you sure you want to delete this exam? All associated questions and student submissions will be permanently removed.")) {
            return;
        }

        try {
            const res = await fetch(`${getBaseApiUrl()}/exams/${examId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                addToast({
                    title: "Exam Deleted",
                    description: "The test session has been removed.",
                });
                // Remove from local state
                setExams(prev => prev.filter(ex => ex.id !== examId));
                if (selectedExamId === examId) setSelectedExamId("all");
                // Also trigger a full refresh of submissions if needed, 
                // but local filtering should handle most cases
                fetchData();
            } else {
                throw new Error("Failed to delete");
            }
        } catch (error) {
            console.error("Delete failed:", error);
            addToast({
                title: "Error",
                description: "Failed to delete the exam. Please try again.",
                variant: "destructive"
            });
        }
    };

    const fetchData = async () => {
        try {
            const [subRes, examRes] = await Promise.all([
                fetch(`${getBaseApiUrl()}/submissions`),
                fetch(`${getBaseApiUrl()}/exams`)
            ]);

            if (subRes.ok && examRes.ok) {
                const [subData, examData] = await Promise.all([subRes.json(), examRes.json()]);
                setSubmissions(subData);
                setExams(examData);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const filteredSubmissions = selectedExamId === "all"
        ? submissions
        : submissions.filter(s => s.exam_id === selectedExamId);

    const stats = [
        { label: "Total Exams", value: exams.length.toString(), icon: FileText, color: "text-blue-400" },
        { label: "Total Submissions", value: submissions.length.toString(), icon: CheckCircle2, color: "text-emerald-400" },
        { label: "Recent Violations", value: submissions.filter(s => s.violations > 0).length.toString(), icon: AlertTriangle, color: "text-amber-400" },
        { label: "Active Sessions", value: "0", icon: Clock, color: "text-purple-400" },
    ];

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
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} className="bg-card border-border shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                                <Icon className={cn("w-4 h-4", stat.color.replace('blue', 'primary').replace('amber', 'orange').replace('emerald', 'emerald').replace('purple', 'primary'))} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-foreground">Recent Exams</CardTitle>
                        <CardDescription>Your recently created or scheduled exams.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[400px] overflow-auto pr-2">
                            {exams.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No exams created yet.</div>
                            ) : (
                                exams.map((exam) => (
                                    <div
                                        key={exam.id}
                                        onClick={() => setSelectedExamId(selectedExamId === exam.id ? "all" : exam.id)}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-md border transition-all cursor-pointer group",
                                            selectedExamId === exam.id ? "bg-primary/5 border-primary/50 shadow-sm" : "bg-muted/20 border-border/50 hover:bg-muted/40"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-md flex items-center justify-center font-bold",
                                                selectedExamId === exam.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                                            )}>
                                                {exam.id.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-foreground">{exam.title}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(exam.scheduled_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedExamId === exam.id && <Badge variant="default" className="text-[10px]">Filter Active</Badge>}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => handleDeleteExam(e, exam.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-foreground">Active Submissions</CardTitle>
                        <CardDescription>Live monitoring of ongoing exams.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <PlusCircle className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredSubmissions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center mb-4">
                                    <Users className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <h3 className="font-medium text-foreground">No submissions found</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {selectedExamId === "all" ? "Awaiting students to complete exams." : "No completions for this exam yet."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[400px] overflow-auto pr-2">
                                {filteredSubmissions.map((sub) => (
                                    <div key={sub.id} className="flex items-center justify-between p-4 rounded-md bg-muted/20 border border-border/50 hover:bg-muted/40 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {sub.user_email.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm text-foreground">{sub.user_email}</div>
                                                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(sub.submitted_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {sub.violations > 0 && (
                                                <Badge variant="destructive" className="h-5 text-[10px] font-bold">
                                                    {sub.violations} Violations
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className="h-5 text-[10px] font-bold border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                                                {sub.exam_id === 'default' ? 'General' : sub.exam_id}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

