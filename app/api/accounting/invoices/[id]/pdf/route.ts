import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";
import { AccountingInvoice, AccountingInvoiceLine, CompanySettings } from "@/lib/types/accounting";
import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, Image, pdf } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// Register Arabic Font
Font.register({
    family: "Noto Kufi Arabic",
    fonts: [
        { src: path.join(process.cwd(), "public/fonts/NotoKufiArabic-Regular.ttf") },
        { src: path.join(process.cwd(), "public/fonts/NotoKufiArabic-Bold.ttf"), fontWeight: "bold" },
    ],
});

interface _RouteParams {
    params: { id: string };
}

// Theme Definitions
type PDFTheme = 'default' | 'eye-friendly' | 'dark';

interface PDFThemeStyles {
    bg: string;
    text: string;
    secondaryText: string;
    border: string;
    brandParams: string;
    accent: string;
    accentText: string;
    tableHeaderBg: string;
    tableRowBg: string;
    altRowBg: string;
    success: string;
    danger: string;
}

const themes: Record<PDFTheme, PDFThemeStyles> = {
    default: {
        bg: "#FFFFFF",
        text: "#1F2937",
        secondaryText: "#6B7280",
        border: "#E5E7EB",
        brandParams: "#111827",
        accent: "#F3F4F6",
        accentText: "#374151",
        tableHeaderBg: "#FFFFFF",
        tableRowBg: "#FFFFFF",
        altRowBg: "#F9FAFB",
        success: "#059669",
        danger: "#DC2626",
    },
    'eye-friendly': {
        bg: "#FDFBF7", // Creamy/Warm White
        text: "#2D2A26", // Softer Black
        secondaryText: "#5C5855",
        border: "#Eae5dd",
        brandParams: "#4A453E",
        accent: "#F0Ece4",
        accentText: "#4A453E",
        tableHeaderBg: "#FDFBF7",
        tableRowBg: "#FDFBF7",
        altRowBg: "#F5F2Eb",
        success: "#047857",
        danger: "#B91C1C",
    },
    dark: {
        bg: "#111827", // Gray 900
        text: "#F9FAFB", // Gray 50
        secondaryText: "#9CA3AF", // Gray 400
        border: "#374151", // Gray 700
        brandParams: "#F3F4F6",
        accent: "#1F2937", // Gray 800
        accentText: "#E5E7EB",
        tableHeaderBg: "#111827",
        tableRowBg: "#111827",
        altRowBg: "#1F2937",
        success: "#34D399",
        danger: "#F87171",
    }
};

const createStyles = (themeName: PDFTheme = 'default') => {
    const t = themes[themeName] || themes.default;

    return StyleSheet.create({
        page: {
            padding: 50,
            paddingBottom: 120,
            fontSize: 10,
            fontFamily: "Noto Kufi Arabic",
            backgroundColor: t.bg,
            color: t.text,
        },

        // Header
        header: {
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 40,
            borderBottom: `1 solid ${t.border}`,
            paddingBottom: 20,
        },

        // Brand Section
        brandSection: {
            alignItems: "flex-end", // Right in RTL
            width: "50%",
        },
        logoImage: {
            width: 60,
            height: 60,
            marginBottom: 10,
            objectFit: "contain",
        },
        companyName: {
            fontSize: 20,
            fontWeight: "bold",
            color: t.brandParams, // Theme-aware
            marginBottom: 4,
        },
        companyDetail: {
            fontSize: 9,
            color: t.secondaryText,
            marginBottom: 2,
        },

        // Invoice Meta
        invoiceMeta: {
            alignItems: "flex-start", // Left in RTL
            width: "40%",
        },
        invoiceTitle: {
            fontSize: 14,
            fontWeight: "bold",
            color: t.brandParams, // Darker text
            marginBottom: 2,
        },
        invoiceNumber: {
            fontSize: 24,
            fontWeight: "bold",
            color: t.brandParams, // Theme-aware
            marginBottom: 10,
        },
        statusBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 4,
            fontSize: 9,
            fontWeight: "bold",
            backgroundColor: t.accent,
            color: t.accentText,
        },

        // Info Grid
        infoGrid: {
            flexDirection: "row-reverse",
            marginBottom: 40,
            gap: 40,
        },
        infoColumn: {
            width: "30%",
            alignItems: "flex-end",
        },
        infoLabel: {
            fontSize: 9,
            color: t.secondaryText, // Theme-aware
            marginBottom: 4,
        },
        infoValue: {
            fontSize: 10,
            color: t.brandParams, // Theme-aware
            fontWeight: "bold",
            marginBottom: 10,
        },

        // Table
        table: {
            width: "100%",
            marginTop: 10,
            marginBottom: 20,
        },
        tableHeader: {
            flexDirection: "row-reverse",
            borderBottom: `1 solid ${t.border}`,
            backgroundColor: t.tableHeaderBg,
            paddingBottom: 8,
            marginBottom: 8,
        },
        tableRow: {
            flexDirection: "row-reverse",
            paddingVertical: 8,
            borderBottom: `1 solid ${themeName === 'dark' ? '#374151' : '#F9FAFB'}`, // Subtle separator
        },

        // Columns
        colDesc: { width: "45%", textAlign: "right" },
        colQty: { width: "10%", textAlign: "center" },
        colPrice: { width: "15%", textAlign: "right" },
        colTax: { width: "10%", textAlign: "right" },
        colTotal: { width: "20%", textAlign: "left", paddingLeft: 10 },

        headerText: { fontSize: 9, fontWeight: "bold", color: t.secondaryText },
        cellText: { fontSize: 10, color: t.text }, // Theme-aware

        // Totals
        totalsSection: {
            flexDirection: "row-reverse", // Right-to-Left container
            justifyContent: "space-between",
            marginTop: 20,
            paddingTop: 10,
        },
        totalsBox: {
            width: "40%",
            alignItems: "flex-start",
        },
        totalRow: {
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            width: "100%",
            marginBottom: 6,
        },
        totalLabel: { fontSize: 9, color: t.secondaryText },
        totalValue: { fontSize: 10, fontWeight: "bold", color: t.brandParams, textAlign: "left" },
        
        // Terms Box (Right Side under descriptions)
        termsBox: {
            width: "55%", // Solid width to prevent character-level wrapping
            paddingTop: 10,
        },
        termsTitle: {
            fontSize: 9,
            fontWeight: "bold",
            color: t.brandParams,
            marginBottom: 6,
            borderBottom: `1 solid ${t.border}`,
            paddingBottom: 2,
            textAlign: "right",
        },
        termsLine: {
            flexDirection: "row-reverse",
            marginBottom: 4,
            width: "100%",
        },
        termsBullet: {
            fontSize: 10,
            color: t.brandParams,
            marginLeft: 6,
        },
        termsText: {
            fontSize: 8,
            color: t.secondaryText,
            textAlign: "right",
            lineHeight: 1.4,
            flex: 1,
        },

        notesBox: {
            marginTop: 16,
            width: "100%",
        },
        notesText: {
            fontSize: 9,
            color: t.text,
            textAlign: "right",
            lineHeight: 1.6,
        },

        grandTotalRow: {
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            width: "100%",
            borderTop: `1 solid ${t.border}`,
            paddingTop: 10,
            marginTop: 5,
        },
        grandTotalLabel: { fontSize: 12, fontWeight: "bold", color: t.brandParams },
        grandTotalValue: { fontSize: 14, fontWeight: "bold", color: t.brandParams },

        // Footer
        footer: {
            position: "absolute",
            bottom: 50,
            left: 50,
            right: 50,
            borderTop: `1 solid ${t.border}`,
            paddingTop: 20,
            alignItems: "center",
        },
        footerText: { fontSize: 8, color: t.secondaryText, marginBottom: 2 },

        // Colors for amount due/paid
        textSuccess: { color: t.success },
        textDanger: { color: t.danger },
    });
};

function generateInvoicePDF(invoice: AccountingInvoice, company: CompanySettings, logoPath: string | null, theme: PDFTheme = 'default') {
    const styles = createStyles(theme);

    // Keep numbers in English/LTR for clarity if preferred, or use localized digits.
    // Usually business in SA uses Western Arabic numerals (0-9).
    const formatCurrency = (amount: number) => `${Number(amount).toFixed(2)} ر.س`;
    const formatDate = (date?: string | null) => date ? new Date(date).toLocaleDateString("en-US") : "-";

    const getStatusText = (state: string) => {
        switch (state) {
            case 'draft': return 'مسودة (غير مدفوعة)';
            case 'confirmed': return 'مدفوعة';
            case 'paid': return 'مدفوعة';
            case 'partial': return 'جزئي';
            case 'cancelled': return 'ملغاة';
            default: return state;
        }
    };

    return React.createElement(
        Document,
        {},
        React.createElement(
            Page,
            { size: "A4", style: styles.page },

            /* Header */
            React.createElement(
                View,
                { style: styles.header },

                /* Brand (Right) */
                React.createElement(
                    View,
                    { style: styles.brandSection },
                    logoPath && React.createElement(Image, { src: logoPath, style: styles.logoImage }),
                    React.createElement(Text, { style: styles.companyName }, company.company_name || "Nested United"),
                    company.tax_number && React.createElement(Text, { style: styles.companyDetail }, `الرقم الضريبي: ${company.tax_number}`),
                    company.commercial_registration && React.createElement(Text, { style: styles.companyDetail }, `السجل التجاري: ${company.commercial_registration}`),
                    company.address && React.createElement(Text, { style: styles.companyDetail }, company.address),
                    company.phone && React.createElement(Text, { style: styles.companyDetail }, company.phone)
                ),

                /* Invoice Meta (Left) */
                React.createElement(
                    View,
                    { style: styles.invoiceMeta },
                    React.createElement(Text, { style: styles.invoiceTitle }, company.invoice_type_label || "فاتورة ضريبية"),
                    React.createElement(Text, { style: styles.invoiceNumber }, invoice.invoice_number),
                    React.createElement(Text, { style: styles.statusBadge }, getStatusText(invoice.state))
                )
            ),

            /* Info Grid */
            React.createElement(
                View,
                { style: styles.infoGrid },

                /* Bill To */
                React.createElement(
                    View,
                    { style: { ...styles.infoColumn, width: "40%" } },
                    React.createElement(Text, { style: styles.infoLabel }, "العميل"),
                    React.createElement(Text, { style: styles.infoValue }, invoice.partner_name),
                    invoice.partner_email && React.createElement(Text, { style: { ...styles.infoValue, fontWeight: "normal" } }, invoice.partner_email),
                    invoice.partner_phone && React.createElement(Text, { style: { ...styles.infoValue, fontWeight: "normal" } }, invoice.partner_phone)
                ),

                /* Dates */
                React.createElement(
                    View,
                    { style: styles.infoColumn },
                    React.createElement(Text, { style: styles.infoLabel }, "التاريخ"),
                    React.createElement(Text, { style: styles.infoValue }, formatDate(invoice.invoice_date)),

                    React.createElement(Text, { style: { ...styles.infoLabel, marginTop: 10 } }, "تاريخ الاستحقاق"),
                    React.createElement(Text, { style: styles.infoValue }, formatDate(invoice.due_date))
                ),

                /* Reference */
                invoice.reference && React.createElement(
                    View,
                    { style: styles.infoColumn },
                    React.createElement(Text, { style: styles.infoLabel }, "المرجع"),
                    React.createElement(Text, { style: styles.infoValue }, invoice.reference)
                )
            ),

            /* Items Table */
            React.createElement(
                View,
                { style: styles.table },
                React.createElement(
                    View,
                    { style: styles.tableHeader },
                    React.createElement(Text, { style: { ...styles.colDesc, ...styles.headerText } }, "الوصف"),
                    React.createElement(Text, { style: { ...styles.colQty, ...styles.headerText } }, "الكمية"),
                    React.createElement(Text, { style: { ...styles.colPrice, ...styles.headerText } }, "السعر"),
                    React.createElement(Text, { style: { ...styles.colTax, ...styles.headerText } }, "الضريبة"),
                    React.createElement(Text, { style: { ...styles.colTotal, ...styles.headerText } }, "المجموع")
                ),
                ...(invoice.lines || []).map((line: AccountingInvoiceLine, idx: number) =>
                    React.createElement(
                        View,
                        { key: idx, style: styles.tableRow },
                        React.createElement(Text, { style: { ...styles.colDesc, ...styles.cellText } }, line.description),
                        React.createElement(Text, { style: { ...styles.colQty, ...styles.cellText } }, Number(line.quantity).toString()),
                        React.createElement(Text, { style: { ...styles.colPrice, ...styles.cellText } }, formatCurrency(Number(line.unit_price)).replace(" ر.س", "")),
                        React.createElement(Text, { style: { ...styles.colTax, ...styles.cellText } }, `${Number(line.tax_rate)}%`),
                        React.createElement(Text, { style: { ...styles.colTotal, ...styles.cellText } }, formatCurrency(Number(line.line_total_with_tax)))
                    )
                )
            ),

            /* Totals & Terms Section */
            React.createElement(
                View,
                { style: styles.totalsSection },
                
                /* Terms (Right) */
                React.createElement(
                    View,
                    { style: styles.termsBox },
                    company.invoice_terms && React.createElement(
                        React.Fragment, 
                        {}, 
                        React.createElement(Text, { style: styles.termsTitle }, "الشروط والأحكام"),
                        company.invoice_terms.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => {
                            const content = line.replace(/^[-\u2022\u00b7]\s*/, '').trim();
                            const isTitle = line.includes(':') && content.length < 20;

                            return React.createElement(
                                View,
                                { key: i, style: styles.termsLine },
                                !isTitle && React.createElement(Text, { style: styles.termsBullet }, "•"),
                                React.createElement(Text, { style: styles.termsText }, content)
                            );
                        })
                    )
                ),

                /* Totals (Left) */
                React.createElement(
                    View,
                    { style: styles.totalsBox },
                    React.createElement(
                        View,
                        { style: styles.totalRow },
                        React.createElement(Text, { style: styles.totalLabel }, "المجموع الفرعي"),
                        React.createElement(Text, { style: styles.totalValue }, formatCurrency(Number(invoice.subtotal)))
                    ),
                    Number(invoice.discount_amount) > 0 && React.createElement(
                        View,
                        { style: styles.totalRow },
                        React.createElement(Text, { style: styles.totalLabel }, "الخصم"),
                        React.createElement(Text, { style: styles.totalValue }, `-${formatCurrency(Number(invoice.discount_amount))}`)
                    ),
                    React.createElement(
                        View,
                        { style: styles.totalRow },
                        React.createElement(Text, { style: styles.totalLabel }, "ضريبة القيمة المضافة"),
                        React.createElement(Text, { style: styles.totalValue }, formatCurrency(Number(invoice.tax_amount)))
                    ),
                    React.createElement(
                        View,
                        { style: styles.grandTotalRow },
                        React.createElement(Text, { style: styles.grandTotalLabel }, "الإجمالي"),
                        React.createElement(Text, { style: styles.grandTotalValue }, formatCurrency(Number(invoice.total_amount)))
                    ),
                    Number(invoice.amount_paid) > 0 && React.createElement(
                        View,
                        { style: { ...styles.totalRow, marginTop: 10 } },
                        React.createElement(Text, { style: styles.totalLabel }, "المدفوع"),
                        React.createElement(Text, { style: { ...styles.totalValue, ...styles.textSuccess } }, formatCurrency(Number(invoice.amount_paid)))
                    ),
                    Number(invoice.amount_due) > 0 && React.createElement(
                        View,
                        { style: styles.totalRow },
                        React.createElement(Text, { style: { ...styles.totalLabel, ...styles.textDanger } }, "المتبقي"),
                        React.createElement(Text, { style: { ...styles.totalValue, ...styles.textDanger } }, formatCurrency(Number(invoice.amount_due)))
                    )
                )
            ),

            /* Invoice notes belong in the page flow so long notes can wrap. */
            invoice.notes && React.createElement(
                View,
                { style: styles.notesBox },
                React.createElement(Text, { style: styles.termsTitle }, "ملاحظات"),
                React.createElement(Text, { style: styles.notesText }, invoice.notes)
            ),

            /* Footer */
            React.createElement(
                View,
                { style: styles.footer, fixed: true },
                // Only Invoice Specific Terms in footer now (e.g. Net 30)
                invoice.payment_terms && React.createElement(Text, { style: { ...styles.footerText, fontSize: 7, marginBottom: 8, fontWeight: 'bold' } }, `شروط الدفع: ${invoice.payment_terms}`),
                
                React.createElement(Text, { style: styles.footerText }, company.invoice_footer || "شكراً لتعاملكم معنا"),
                React.createElement(Text, { style: styles.footerText }, company.company_name || "Nested United")
            )
        )
    );
}

// GET /api/accounting/invoices/[id]/pdf - Generate PDF
export async function GET(req: NextRequest, params: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser();
        if (!user?.id) {
            return NextResponse.json({ error: "يرجى تسجيل الدخول أولاً" }, { status: 401 });
        }

        const { id: invoiceId } = await params.params;
        const { searchParams } = new URL(req.url);
        const theme = (searchParams.get("theme") || "default") as PDFTheme;

        // Get invoice with details
        const invoices = await query<AccountingInvoice>(
            `SELECT i.*, p.name as partner_name, p.email as partner_email, p.phone as partner_phone
             FROM accounting_invoices i
             LEFT JOIN accounting_partners p ON i.partner_id = p.id
             WHERE i.id = ? AND i.deleted_at IS NULL`,
            [invoiceId]
        );

        if (!invoices || invoices.length === 0) {
            return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
        }

        const invoiceData = invoices[0];

        // Get invoice lines
        const lines = await query<AccountingInvoiceLine>(
            "SELECT * FROM accounting_invoice_lines WHERE invoice_id = ? ORDER BY created_at",
            [invoiceId]
        );

        // Get company settings
        const companySettings = await query<CompanySettings>("SELECT * FROM company_settings LIMIT 1");
        const company = companySettings.length > 0 ? companySettings[0] : {} as CompanySettings;

        // Resolve logo path
        let logoPath = null;
        if (company.logo_url) {
            // Check if it's a base64 data URL
            if (company.logo_url.startsWith("data:image")) {
                logoPath = company.logo_url;
            } else {
                // Fallback for file system paths (backward compatibility)
                const relativePath = company.logo_url.startsWith("/") ? company.logo_url : `/${company.logo_url}`;
                const absolutePath = path.join(process.cwd(), "public", relativePath);
                if (fs.existsSync(absolutePath)) {
                    logoPath = absolutePath;
                }
            }
        }

        // Generate PDF
        const pdfDoc = generateInvoicePDF({ ...invoiceData, lines }, company, logoPath, theme);
        const pdfBytes = await pdf(pdfDoc).toBlob();

        // Return as downloadable PDF
        return new NextResponse(pdfBytes, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="invoice-${invoiceData.invoice_number}.pdf"`,
            },
        });
    } catch (error) {
        console.error("Error generating PDF:", error);
        return NextResponse.json(
            { error: "فشل في إنشاء ملف PDF", details: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
