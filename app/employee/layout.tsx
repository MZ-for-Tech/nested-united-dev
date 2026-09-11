"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Clock,
    FileText,
    Receipt,
    User,
    LogOut,
    MessageSquare,
    Trophy,
} from "lucide-react";
import { NotificationDropdown } from "@/components/employee/NotificationDropdown";

const navItems = [
    { href: "/employee", label: "الرئيسية", icon: LayoutDashboard },
    { href: "/employee/attendance", label: "الحضور والانصراف", icon: Clock },
    { href: "/employee/requests", label: "طلباتي", icon: FileText },
    { href: "/employee/messages", label: "رسائل الإدارة", icon: MessageSquare },
    { href: "/employee/evaluations", label: "تقييماتي", icon: Trophy },
    { href: "/employee/payslips", label: "كشوف الراتب", icon: Receipt },
    { href: "/employee/profile", label: "ملفي الشخصي", icon: User },
];

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
            {/* Top Navigation Bar */}
            <header className="bg-white shadow-sm border-b sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center shadow-lg">
                                <User className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900">بوابة الموظف</h1>
                                <p className="text-gray-500 text-xs">Employee Portal</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <NotificationDropdown />
                            <Link
                                href="/portal"
                                className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition text-sm"
                            >
                                <LogOut className="w-4 h-4 rotate-180" />
                                <span>العودة للبوابة</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="bg-white border-b">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="flex gap-1 overflow-x-auto py-2">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href ||
                                (item.href !== "/employee" && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all ${isActive
                                        ? "bg-violet-100 text-violet-700 font-semibold"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                        }`}
                                >
                                    <item.icon className="w-4 h-4" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 py-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t bg-white py-4 mt-8">
                <div className="max-w-5xl mx-auto px-4 text-center text-gray-500 text-sm">
                    © 2026 نظام الموارد البشرية
                </div>
            </footer>
        </div>
    );
}
