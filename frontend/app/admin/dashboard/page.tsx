"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminUsers, deleteUser, toggleRegistration, getSettings, logout } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, AlertCircle, Loader2, LogOut, ShieldCheck, UserPlus } from "lucide-react";

export default function AdminDashboard() {
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [registrationEnabled, setRegistrationEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [usersData, settingsData] = await Promise.all([
                getAdminUsers(),
                getSettings()
            ]);
            setUsers(usersData);
            setRegistrationEnabled(settingsData.registration_enabled);
        } catch (err: any) {
            setError(err.message || "Failed to load admin dashboard. Ensure you are logged in as admin.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleRegistration = async (checked: boolean) => {
        setActionLoading('toggle');
        setError(null);
        try {
            await toggleRegistration(checked);
            setRegistrationEnabled(checked);
        } catch (err: any) {
            setError(err.message || "Failed to update registration settings");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm("Are you sure you want to delete this user?")) return;

        setActionLoading(`delete-${id}`);
        setError(null);
        try {
            await deleteUser(id);
            setUsers(users.filter(u => u.id !== id));
        } catch (err: any) {
            setError(err.message || "Failed to delete user");
        } finally {
            setActionLoading(null);
        }
    };

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between bg-card p-6 rounded-lg border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Admin Control Center</h1>
                            <p className="text-muted-foreground">Manage global settings and active users</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </Button>
                </div>

                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium p-4 rounded-md flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Settings Sidebar */}
                    <Card className="col-span-1 border-border shadow-sm h-fit">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">Security</CardTitle>
                            <CardDescription>Global authentication rules</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="registration" className="flex flex-col gap-1 cursor-pointer">
                                    <span className="font-semibold text-foreground">Public Signups</span>
                                    <span className="font-normal text-xs text-muted-foreground">Allow new accounts</span>
                                </Label>
                                <Switch
                                    id="registration"
                                    checked={registrationEnabled}
                                    onCheckedChange={handleToggleRegistration}
                                    disabled={actionLoading === 'toggle'}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Users Main Area */}
                    <Card className="col-span-1 md:col-span-3 border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="text-lg">System Accounts</CardTitle>
                                <CardDescription>All registered students, instructors, and admins.</CardDescription>
                            </div>
                            <Button
                                size="sm"
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => {
                                    const modal = document.getElementById('add-user-modal') as HTMLDialogElement;
                                    if (modal) modal.showModal();
                                }}
                            >
                                <UserPlus className="w-4 h-4 mr-2" /> Add User
                            </Button>
                        </CardHeader>
                        <CardContent>

                            {/* Add User Modal (Native Dialog) */}
                            <dialog id="add-user-modal" className="p-0 rounded-lg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm border border-border bg-card w-full max-w-md fixed inset-0 m-auto">
                                <div className="p-6">
                                    <h3 className="font-semibold text-lg mb-4 text-foreground">Add New User</h3>
                                    <form id="add-user-form" onSubmit={async (e) => {
                                        e.preventDefault();
                                        setActionLoading('add-user');
                                        setError(null);
                                        const form = e.target as HTMLFormElement;

                                        try {
                                            const m = await import('@/lib/api');
                                            const token = m.getAuthToken();
                                            const headers: Record<string, string> = {
                                                'Content-Type': 'application/json'
                                            };

                                            if (token) {
                                                headers['Authorization'] = `Bearer ${token}`;
                                            }

                                            const response = await fetch(`${m.getBaseApiUrl()}/admin/users`, {
                                                method: 'POST',
                                                headers,
                                                body: JSON.stringify({
                                                    name: (form.elements.namedItem('name') as HTMLInputElement).value,
                                                    email: (form.elements.namedItem('email') as HTMLInputElement).value,
                                                    password: (form.elements.namedItem('password') as HTMLInputElement).value,
                                                    role: (form.elements.namedItem('role') as HTMLSelectElement).value,
                                                })
                                            });

                                            if (!response.ok) {
                                                const data = await response.json();
                                                throw new Error(data.error || 'Failed to add user');
                                            }

                                            loadData(); // refresh table
                                            form.reset();
                                            (document.getElementById('add-user-modal') as HTMLDialogElement)?.close();
                                        } catch (err: any) {
                                            setError(err.message);
                                            (document.getElementById('add-user-modal') as HTMLDialogElement)?.close();
                                        } finally {
                                            setActionLoading(null);
                                        }
                                    }}>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="new-name">Name</Label>
                                                <Input id="new-name" name="name" required placeholder="John Doe" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-email">Email</Label>
                                                <Input id="new-email" name="email" type="email" required placeholder="john@example.com" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-password">Password</Label>
                                                <Input id="new-password" name="password" type="password" required placeholder="••••••••" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-role">Role</Label>
                                                <select id="new-role" name="role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                                    <option value="student">Student</option>
                                                    <option value="instructor">Instructor</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3 mt-6">
                                            <Button type="button" variant="outline" onClick={() => (document.getElementById('add-user-modal') as HTMLDialogElement)?.close()}>Cancel</Button>
                                            <Button type="submit" disabled={actionLoading === 'add-user'}>
                                                {actionLoading === 'add-user' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </dialog>

                            <div className="rounded-md border border-border overflow-hidden mt-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">User</th>
                                            <th className="px-4 py-3 font-semibold">Role</th>
                                            <th className="px-4 py-3 font-semibold">Joined</th>
                                            <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {users.map((user) => (
                                            <tr key={user.id} className="bg-card hover:bg-muted/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-foreground">{user.name}</div>
                                                    <div className="text-muted-foreground text-xs">{user.email}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${user.role === 'admin' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                        user.role === 'instructor' ? 'bg-primary/10 text-primary border-primary/20' :
                                                            'bg-green-500/10 text-green-500 border-green-500/20'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {new Date(user.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {user.role !== 'admin' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            disabled={actionLoading === `delete-${user.id}`}
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            {actionLoading === `delete-${user.id}` ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-4 h-4" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {users.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                                    No users found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
