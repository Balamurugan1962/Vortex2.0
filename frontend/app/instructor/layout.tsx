"use client";

import Link from "next/navigation";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FilePlus, Users, BarChart3, Settings, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/instructor/dashboard" },
    { icon: FilePlus, label: "Create Exam", href: "/instructor/create-exam" },
];

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Sidebar */}
            <aside className="w-64 border-r border-sidebar-border bg-sidebar hidden md:flex flex-col">
                <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20">
                        <ShieldCheck className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-foreground">OffGuard</span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {sidebarItems.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                pathname === item.href
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </a>
                    ))}
                </nav>

                <div className="p-4 border-t border-sidebar-border">
                    <button className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/5 transition-colors w-full">
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
