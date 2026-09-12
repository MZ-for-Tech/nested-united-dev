import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { DialogProvider } from "@/components/accounting/DialogProvider";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "لوحة التحكم - إدارة الوحدات",
  description: "نظام إدارة الوحدات والحجوزات على Airbnb و Gathern",
  icons: {
    icon: [
      { url: "/api/company/logo", type: "image/png", sizes: "any" },
      { url: "/api/company/logo", type: "image/x-icon" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [
      { url: "/api/company/logo", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/api/company/logo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <DialogProvider>
            {children}
          </DialogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
