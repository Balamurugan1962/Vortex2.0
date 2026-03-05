"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, GripVertical, CheckCircle, Share2, QrCode, Copy, Link as LinkIcon, Upload, FileType, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type QuestionType = "MCQ" | "Multi-select" | "Short Answer" | "Long Answer" | "Scenario";

interface Question {
    id: string;
    type: QuestionType;
    text: string;
    options?: string[];
    correctAnswers?: number[];
}

export default function CreateExamPage() {
    const [questions, setQuestions] = useState<Question[]>([
        { id: "1", type: "MCQ", text: "", options: ["", "", ""], correctAnswers: [0] }
    ]);
    const [showShare, setShowShare] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const addQuestion = () => {
        const newQuestion: Question = {
            id: Date.now().toString(),
            type: "MCQ",
            text: "",
            options: ["", "", ""],
            correctAnswers: [0]
        };
        setQuestions([...questions, newQuestion]);
    };

    const removeQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const handleCreate = () => {
        setShowShare(true);
    };

    const downloadTemplate = () => {
        const headers = "Type,Question,O1,O2,O3,O4,CorrectIndex";
        const example = "MCQ,\"What is the time complexity of binary search?\",\"O(n)\",\"O(log n)\",\"O(n^2)\",\"O(1)\",1";
        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + example;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "vortex_exam_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBulkUpload = async () => {
        setIsUploading(true);
        // Simulate parsing CSV/Excel
        await new Promise(resolve => setTimeout(resolve, 1500));

        const bulkQuestions: Question[] = [
            { id: Date.now() + 1 + "", type: "MCQ", text: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"], correctAnswers: [1] },
            { id: Date.now() + 2 + "", type: "Short Answer", text: "Define a 'Linked List'.", correctAnswers: [] },
            { id: Date.now() + 3 + "", type: "MCQ", text: "Which data structure uses LIFO?", options: ["Queue", "Stack", "Tree", "Graph"], correctAnswers: [1] },
        ];

        setQuestions([...questions, ...bulkQuestions]);
        setIsUploading(false);
        setShowUpload(false);
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Create New Examination</h1>
                    <p className="text-muted-foreground mt-1 font-medium">Configure your exam settings and build your question bank.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="border-border hover:bg-muted font-semibold">Save Draft</Button>
                    <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all">Create Exam</Button>
                </div>
            </div>

            {/* Basic Info */}
            <Card className="bg-card border-border shadow-sm">
                <CardHeader>
                    <CardTitle className="text-foreground">Examination Details</CardTitle>
                    <CardDescription className="font-medium text-muted-foreground">Set the basic configuration for the exam.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-foreground font-semibold">Exam Title</Label>
                        <Input placeholder="e.g., Data Structures & Algorithms - Final" className="bg-background border-border text-foreground" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-foreground font-semibold">Description</Label>
                        <Textarea placeholder="Provide instructions for students..." className="bg-background border-border min-h-[100px] text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground font-semibold">Duration (Minutes)</Label>
                        <Input type="number" defaultValue="60" className="bg-background border-border text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground font-semibold">Total Marks</Label>
                        <Input type="number" defaultValue="100" className="bg-background border-border text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground font-semibold">Start Time</Label>
                        <Input type="datetime-local" className="bg-background border-border text-foreground" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-foreground font-semibold">End Time</Label>
                        <Input type="datetime-local" className="bg-background border-border text-foreground" />
                    </div>
                </CardContent>
            </Card>

            {/* Question Builder */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-foreground">Question Bank</h2>
                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[11px] font-black rounded-full uppercase tracking-wider">
                            {questions.length} Items
                        </span>
                    </div>
                    <Button onClick={() => setShowUpload(true)} variant="outline" size="sm" className="border-primary/20 text-primary hover:bg-primary/5 font-bold h-9">
                        <Upload className="mr-2 h-4 w-4" />
                        Bulk Upload (CSV)
                    </Button>
                </div>

                {questions.map((q, index) => (
                    <Card key={q.id} className="bg-card border-border relative group overflow-hidden shadow-sm">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <div className="flex items-center gap-4">
                                <GripVertical className="w-5 h-5 text-muted-foreground/50 cursor-move" />
                                <span className="font-bold text-primary">#{index + 1}</span>
                                <Select defaultValue={q.type}>
                                    <SelectTrigger className="w-[180px] bg-background border-border h-8 font-semibold text-foreground">
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border text-foreground">
                                        <SelectItem value="MCQ">MCQ</SelectItem>
                                        <SelectItem value="Multi-select">Multi-select</SelectItem>
                                        <SelectItem value="Short Answer">Short Answer</SelectItem>
                                        <SelectItem value="Long Answer">Long Answer</SelectItem>
                                        <SelectItem value="Scenario">Scenario</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 h-8 w-8">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                placeholder="Enter your question here..."
                                className="bg-background border-border text-foreground font-semibold"
                                defaultValue={q.text}
                            />

                            {(q.type === "MCQ" || q.type === "Multi-select") && (
                                <div className="space-y-3 pl-8 border-l-2 border-muted mt-4">
                                    {q.options?.map((opt, optIndex) => (
                                        <div key={optIndex} className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-4 h-4 rounded-full border border-border",
                                                q.correctAnswers?.includes(optIndex) ? "bg-primary border-primary shadow-sm shadow-primary/30" : "bg-background shadow-inner"
                                            )} />
                                            <Input
                                                placeholder={`Option ${optIndex + 1}`}
                                                className="bg-background border-border text-foreground h-9"
                                                defaultValue={opt}
                                            />
                                            {optIndex > 1 && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 font-bold h-8 mt-2">
                                        <PlusCircle className="mr-2 h-3 w-3" />
                                        Add Option
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                <Button onClick={addQuestion} variant="outline" className="w-full border-dashed border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary h-16 transition-all font-bold">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Add Manual Question Entry
                </Button>
            </div>

            {/* Bulk Upload Modal Simulation */}
            {showUpload && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg bg-card border-border shadow-2xl animate-in zoom-in-95 duration-200">
                        <CardHeader className="text-center pb-6 border-b border-border/50">
                            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary border border-primary/20">
                                <Upload className="w-7 h-7" />
                            </div>
                            <CardTitle className="text-3xl font-black tracking-tight">Bulk Upload</CardTitle>
                            <CardDescription className="font-medium">Upload question bank via CSV or Excel sheet.</CardDescription>
                        </CardHeader>
                        <CardContent className="py-10 space-y-6">
                            <div className="border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center bg-muted/5 group hover:bg-primary/5 hover:border-primary/50 transition-all cursor-pointer">
                                <FileType className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors mb-4" />
                                <p className="text-sm font-bold text-foreground">Click to browse or drag and drop</p>
                                <p className="text-xs text-muted-foreground mt-1">Supports .csv, .xlsx (Max 5MB)</p>
                            </div>

                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 text-left">
                                <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-primary uppercase tracking-widest">Formatting Standard</p>
                                    <div className="text-[10px] text-muted-foreground leading-relaxed font-medium space-y-1">
                                        <p>Columns: [Type], [Question], [O1], [O2], [O3], [O4], [CorrectIndex]</p>
                                        <p>Example: <code className="bg-primary/10 px-1 rounded text-primary">MCQ, "What is React?", "Library", "Framework", "OS", "DB", 0</code></p>
                                    </div>
                                    <Button
                                        variant="link"
                                        onClick={downloadTemplate}
                                        className="h-auto p-0 text-[10px] text-primary font-black uppercase tracking-tighter hover:no-underline"
                                    >
                                        Download Standard CSV Template
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pb-8 pt-2 px-6 flex gap-3">
                            <Button variant="ghost" className="flex-1 font-bold h-12" onClick={() => setShowUpload(false)}>Cancel</Button>
                            <Button
                                onClick={handleBulkUpload}
                                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-black h-12 shadow-lg shadow-primary/20"
                                disabled={isUploading}
                            >
                                {isUploading ? "Syncing Questions..." : "Process & Import"}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* Share Panel Modal Simulation */}
            {showShare && (
                <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg bg-card border-border shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="h-2 w-full bg-emerald-500" />
                        <CardHeader className="text-center border-b border-border/50 pb-8 pt-10 px-8">
                            <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-600 border border-emerald-500/20 shadow-sm">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <CardTitle className="text-3xl text-foreground font-black tracking-tight">Examination Live!</CardTitle>
                            <CardDescription className="text-muted-foreground font-medium pt-1">Your exam is now live. Share the access details with students.</CardDescription>
                        </CardHeader>
                        <CardContent className="py-10 space-y-10 px-10">
                            <div className="bg-muted/10 border border-border rounded-2xl p-6 text-center shadow-inner">
                                <h3 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-4">Instructor Authentication Required</h3>
                                <p className="text-sm text-foreground font-bold">Session integrity check passed. Access tokens provisioned.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-muted-foreground text-[10px] uppercase font-black tracking-widest">Exam Join Code</Label>
                                    <div className="flex gap-2">
                                        <Input readOnly value="VX-12345" className="bg-muted/30 border-border h-14 text-center font-mono text-2xl tracking-[0.2em] text-primary font-black select-all" />
                                        <Button size="icon" variant="outline" className="border-border hover:bg-muted h-14 w-14 shrink-0 shadow-sm"><Copy className="h-5 w-5" /></Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-muted-foreground text-[10px] uppercase font-black tracking-widest">Exam URL</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-muted/30 border border-border rounded-xl px-4 h-12 text-sm text-foreground font-bold flex items-center gap-3 overflow-hidden whitespace-nowrap shadow-inner">
                                            <LinkIcon className="w-4 h-4 text-primary shrink-0" />
                                            vortex-exam.app/join/VX-12345
                                        </div>
                                        <Button size="icon" variant="outline" className="border-border hover:bg-muted h-12 w-12 shrink-0 shadow-sm"><Copy className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-2 pb-10 px-10">
                            <Button onClick={() => setShowShare(false)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-14 text-lg shadow-lg shadow-primary/20 transition-all">
                                Return to Instructor Dashboard
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
