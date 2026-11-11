// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { query, setContent, pdf } = vi.hoisted(() => ({
    query: vi.fn(), setContent: vi.fn(), pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-test")),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/db", () => ({ query }));
vi.mock("puppeteer", () => ({ default: { launch: async () => ({
    newPage: async () => ({ setContent, evaluate: vi.fn(), pdf }),
    close: vi.fn(),
}) } }));

import { GET } from "./route";

describe("Invoice PDF export", () => {
    beforeEach(() => {
        query.mockReset(); setContent.mockReset(); pdf.mockClear();
    });

    it.each([0, 15])("renders RTL notes, logo and tax conditionally (rate %i)", async (taxRate) => {
        const notes = "تاريخ الدخول: 2026-11-07\nوقت الدخول: 04:00 مساءً";
        query.mockResolvedValueOnce([{
            id: "invoice-1", invoice_number: "INV-2026-0006", state: "paid",
            invoice_date: "2026-11-07", due_date: "2026-11-07", partner_name: "عميل تجريبي",
            notes, subtotal: "200.00", tax_amount: taxRate ? "30.00" : "0.00",
            total_amount: taxRate ? "230.00" : "200.00", amount_paid: "200.00", amount_due: "0.00",
        }]).mockResolvedValueOnce([{
            description: "إقامة", quantity: "1.00", unit_price: "200.00",
            tax_rate: String(taxRate), line_total_with_tax: taxRate ? "230.00" : "200.00",
        }]).mockResolvedValueOnce([{
            company_name: "Nested United", logo_url: "/logo.png", tax_number: "12345",
        }]);
        const response = await GET(new NextRequest("http://localhost/api/accounting/invoices/invoice-1/pdf"), {
            params: Promise.resolve({ id: "invoice-1" }),
        });
        expect(response.status).toBe(200);
        expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("%PDF-test");
        const html = setContent.mock.calls[0][0] as string;
        expect(html).toContain("lang=\"ar\" dir=\"rtl\"");
        expect(html).toContain("تاريخ الدخول: 2026-11-07<br>وقت الدخول: 04:00 مساءً");
        expect(html).toContain("data:image/png;base64,");
        expect(html.includes("ضريبة القيمة المضافة")).toBe(Boolean(taxRate));
    });
});
