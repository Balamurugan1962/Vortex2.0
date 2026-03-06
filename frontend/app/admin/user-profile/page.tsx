"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getIntegrityLogs, getIntegritySummary, getActivityLogs, getActivitySummary, getBaseApiUrl } from "@/lib/api";
import {
    ArrowLeft,
    Loader2,
    Image,
    Calendar,
    AlertTriangle,
    CheckCircle2,
    Shield,
    Eye,
    ZoomIn,
    Activity,
    Clock,
    FileText,
    MousePointer
} from "lucide-react";

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    created_at: string;
}

interface ViolationLog {
    id: number;
    user_email: string;
    violation_type: string;
    violation_timestamp: string;
    confidence: number;
    severity: string;
    frame_image_base64?: string;
    metadata: any;
    created_at: string;
}

interface ViolationSummary {
    total_violations: number;
    high_severity: number;
    medium_severity: number;
    low_severity: number;
    violations_by_type: { [key: string]: number };
    first_violation?: string;
    last_violation?: string;
}

interface ActivityLog {
    id: number;
    user_email: string;
    exam_id: string;
    submission_id?: number;
    event_type: string;
    event_timestamp: string;
    question_id?: number;
    event_data: any;
    created_at: string;
}

interface ActivitySummary {
    total_events: number;
    exam_started?: string;
    exam_submitted?: string;
    exam_duration_seconds?: number;
    questions_answered?: number;
    total_time_on_questions?: number;
    events_by_type: { [key: string]: number };
}

export default function UserProfilePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const userEmail = searchParams.get('email') || '';

    const [user, setUser] = useState<User | null>(null);
    const [violations, setViolations] = useState<ViolationLog[]>([]);
    const [summary, setSummary] = useState<ViolationSummary | null>(null);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedViolation, setSelectedViolation] = useState<ViolationLog | null>(null);
    const [showImageModal, setShowImageModal] = useState(false);
    const [examId, setExamId] = useState("default");

    useEffect(() => {
        if (userEmail) {
            loadUserProfile();
        }
    }, [userEmail]);

    const loadUserProfile = async () => {
        setIsLoading(true);
        try {
            // Try to fetch user from admin endpoint
            const usersRes = await fetch(`${getBaseApiUrl()}/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('vortex_auth_token')}`
                }
            });

            if (usersRes.ok) {
                const users = await usersRes.json();
                const foundUser = users.find((u: User) => u.email === userEmail);
                if (foundUser) {
                    setUser(foundUser);
                }
            }

            // Load integrity logs, summary, activity logs, and activity summary
            const [logsData, summaryData, activityLogsData, activitySummaryData] = await Promise.all([
                getIntegrityLogs(examId, userEmail),
                getIntegritySummary(examId, userEmail),
                getActivityLogs(examId, userEmail),
                getActivitySummary(examId, userEmail)
            ]);

            setViolations(logsData || []);
            setSummary(summaryData || null);
            setActivityLogs(activityLogsData || []);
            setActivitySummary(activitySummaryData || null);
        } catch (err) {
            console.error("Failed to load user profile:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "high":
                return "bg-red-500/10 text-red-700 border-red-500/20";
            case "medium":
                return "bg-orange-500/10 text-orange-700 border-orange-500/20";
            case "low":
                return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
            default:
                return "bg-gray-500/10 text-gray-700 border-gray-500/20";
        }
    };

    if (!userEmail) {
        return (
            <div className="min-h-screen bg-background p-8 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>No User Selected</CardTitle>
                        <CardDescription>Please select a user from the admin dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push('/admin/dashboard')} className="w-full">
                            Back to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading user profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">
                            {user?.name || "User Profile"}
                        </h1>
                        <p className="text-muted-foreground">{userEmail}</p>
                    </div>
                </div>

                {/* User Info Card */}
                {user && (
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary" />
                                User Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Name</p>
                                    <p className="text-lg font-bold text-foreground mt-1">{user.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Email</p>
                                    <p className="text-sm text-foreground mt-1 break-all">{user.email}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Role</p>
                                    <Badge className="mt-1 capitalize">
                                        {user.role}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Joined</p>
                                    <p className="text-sm text-foreground mt-1">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Violations Summary */}
                {summary && (
                    <Card className="border-border shadow-sm bg-gradient-to-br from-red-500/5 to-orange-500/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                Exam Integrity Summary
                            </CardTitle>
                            <CardDescription>
                                Violations detected during exam session
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-card p-4 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Total</p>
                                    <p className="text-3xl font-black text-red-500 mt-2">
                                        {summary.total_violations}
                                    </p>
                                </div>
                                <div className="bg-card p-4 rounded-lg border border-red-500/20">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">High</p>
                                    <p className="text-3xl font-black text-red-500 mt-2">
                                        {summary.high_severity}
                                    </p>
                                </div>
                                <div className="bg-card p-4 rounded-lg border border-orange-500/20">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Medium</p>
                                    <p className="text-3xl font-black text-orange-500 mt-2">
                                        {summary.medium_severity}
                                    </p>
                                </div>
                                <div className="bg-card p-4 rounded-lg border border-yellow-500/20">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Low</p>
                                    <p className="text-3xl font-black text-yellow-500 mt-2">
                                        {summary.low_severity}
                                    </p>
                                </div>
                                <div className="bg-card p-4 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Types</p>
                                    <p className="text-3xl font-black text-primary mt-2">
                                        {Object.keys(summary.violations_by_type || {}).length}
                                    </p>
                                </div>
                            </div>

                            {/* Violations by Type */}
                            {Object.keys(summary.violations_by_type || {}).length > 0 && (
                                <div className="mt-6 pt-6 border-t border-border">
                                    <p className="text-sm font-semibold text-foreground mb-4">Violation Breakdown</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {Object.entries(summary.violations_by_type || {}).map(([type, count]) => (
                                            <div key={type} className="flex items-center gap-2 p-2 bg-card rounded border border-border">
                                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                                <span className="text-sm flex-1 truncate">{type}</span>
                                                <Badge variant="secondary" className="font-bold">{count}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Activity Summary */}
                {activitySummary && (
                    <Card className="border-border shadow-sm bg-gradient-to-br from-blue-500/5 to-purple-500/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-500" />
                                Exam Activity Summary
                            </CardTitle>
                            <CardDescription>
                                Complete timeline of student exam interactions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-card p-4 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Total Events</p>
                                    <p className="text-3xl font-black text-blue-500 mt-2">
                                        {activitySummary.total_events}
                                    </p>
                                </div>
                                {activitySummary.exam_duration_seconds && (
                                    <div className="bg-card p-4 rounded-lg border border-purple-500/20">
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Duration</p>
                                        <p className="text-3xl font-black text-purple-500 mt-2">
                                            {Math.floor(activitySummary.exam_duration_seconds / 60)}m
                                        </p>
                                    </div>
                                )}
                                {activitySummary.questions_answered !== undefined && (
                                    <div className="bg-card p-4 rounded-lg border border-green-500/20">
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Answered</p>
                                        <p className="text-3xl font-black text-green-500 mt-2">
                                            {activitySummary.questions_answered}
                                        </p>
                                    </div>
                                )}
                                <div className="bg-card p-4 rounded-lg border border-border">
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Event Types</p>
                                    <p className="text-3xl font-black text-primary mt-2">
                                        {Object.keys(activitySummary.events_by_type || {}).length}
                                    </p>
                                </div>
                            </div>

                            {/* Events by Type */}
                            {Object.keys(activitySummary.events_by_type || {}).length > 0 && (
                                <div className="mt-6 pt-6 border-t border-border">
                                    <p className="text-sm font-semibold text-foreground mb-4">Event Breakdown</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {Object.entries(activitySummary.events_by_type || {}).map(([type, count]) => (
                                            <div key={type} className="flex items-center gap-2 p-2 bg-card rounded border border-border">
                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                <span className="text-sm flex-1 truncate">{type}</span>
                                                <Badge variant="secondary" className="font-bold">{count}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Activity Timeline */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary" />
                            Activity Timeline ({activityLogs.length})
                        </CardTitle>
                        <CardDescription>
                            Complete log of all student interactions during the exam
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activityLogs.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <p className="text-muted-foreground">No activity logs available</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {activityLogs.map((log, idx) => {
                                    const getEventIcon = (type: string) => {
                                        if (type.includes('EXAM')) return '🎯';
                                        if (type.includes('QUESTION')) return '📄';
                                        if (type.includes('ANSWER')) return '✍️';
                                        if (type.includes('TIME')) return '⏱️';
                                        return '📝';
                                    };

                                    const getEventColor = (type: string) => {
                                        if (type === 'EXAM_STARTED') return 'border-green-500/20 bg-green-500/5';
                                        if (type === 'EXAM_SUBMITTED') return 'border-red-500/20 bg-red-500/5';
                                        if (type.includes('ANSWER')) return 'border-blue-500/20 bg-blue-500/5';
                                        return 'border-border bg-card';
                                    };

                                    return (
                                        <div
                                            key={log.id}
                                            className={`p-3 rounded-lg border ${getEventColor(log.event_type)} transition-all hover:shadow-sm`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="text-xl">{getEventIcon(log.event_type)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-semibold text-sm text-foreground">
                                                            {log.event_type.replace(/_/g, ' ')}
                                                        </p>
                                                        {log.question_id && (
                                                            <Badge variant="outline" className="text-xs">
                                                                Q{log.question_id}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(log.event_timestamp).toLocaleString()}
                                                    </div>
                                                    {log.event_data && Object.keys(log.event_data).length > 0 && (
                                                        <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                                                            <pre className="text-muted-foreground overflow-x-auto">
                                                                {JSON.stringify(log.event_data, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Violations Log */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Eye className="w-5 h-5 text-primary" />
                            Violation Log ({violations.length})
                        </CardTitle>
                        <CardDescription>
                            Detailed record of all detected violations with captured evidence
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {violations.length === 0 ? (
                            <div className="text-center py-12">
                                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4 opacity-50" />
                                <p className="text-muted-foreground">No violations detected</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {violations.map((violation, idx) => (
                                    <div
                                        key={violation.id}
                                        className={`p-4 rounded-lg border ${getSeverityColor(violation.severity)} cursor-pointer transition-all hover:shadow-md`}
                                        onClick={() => {
                                            setSelectedViolation(violation);
                                            setShowImageModal(true);
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className="uppercase text-xs font-black">
                                                        {violation.severity}
                                                    </Badge>
                                                    <p className="font-bold text-sm">
                                                        {violation.violation_type}
                                                    </p>
                                                    <span className="text-xs text-muted-foreground ml-auto">
                                                        #{violation.id}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(violation.violation_timestamp).toLocaleString()}
                                                </div>
                                                <div className="mt-2 text-xs">
                                                    <span className="text-muted-foreground">Confidence: </span>
                                                    <span className="font-bold text-foreground">
                                                        {(violation.confidence * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {violation.frame_image_base64 && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedViolation(violation);
                                                            setShowImageModal(true);
                                                        }}
                                                    >
                                                        <Image className="w-4 h-4" />
                                                        View Frame
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Image Modal */}
            {showImageModal && selectedViolation?.frame_image_base64 && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowImageModal(false)}
                >
                    <Card className="max-w-2xl w-full border-border shadow-2xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ZoomIn className="w-5 h-5" />
                                    Violation Evidence
                                </CardTitle>
                                <CardDescription>
                                    {selectedViolation.violation_type} - {new Date(selectedViolation.violation_timestamp).toLocaleString()}
                                </CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowImageModal(false)}
                            >
                                ×
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="bg-black rounded-lg p-4 overflow-auto max-h-[500px] flex items-center justify-center">
                                    <img
                                        src={`data:image/jpeg;base64,${selectedViolation.frame_image_base64}`}
                                        alt="Violation frame"
                                        className="max-w-full max-h-[400px] rounded"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground uppercase font-semibold text-xs">Type</p>
                                        <p className="font-bold text-foreground mt-1">
                                            {selectedViolation.violation_type}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground uppercase font-semibold text-xs">Severity</p>
                                        <Badge className="mt-1 capitalize">
                                            {selectedViolation.severity}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground uppercase font-semibold text-xs">Confidence</p>
                                        <p className="font-bold text-foreground mt-1">
                                            {(selectedViolation.confidence * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground uppercase font-semibold text-xs">Timestamp</p>
                                        <p className="text-sm text-foreground mt-1">
                                            {new Date(selectedViolation.violation_timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
