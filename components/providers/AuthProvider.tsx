"use client";

import { SessionProvider } from "next-auth/react";
import { NotificationManager } from "@/components/NotificationManager";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            {children}
            <NotificationManager />
        </SessionProvider>
    );
}
