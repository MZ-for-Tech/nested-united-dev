import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { DialogProvider } from "@/components/accounting/DialogProvider";

const notoKufiArabic = localFont({
  src: [
    {
      path: "../public/fonts/NotoKufiArabic-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/NotoKufiArabic-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
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
      <body className={`${notoKufiArabic.variable} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <DialogProvider>
            {children}
          </DialogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
