// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { NextRequest } from "next/server";

const { query, documents } = vi.hoisted(() => ({
    query: vi.fn(),
    documents: [] as unknown[],
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/db", () => ({ query }));
vi.mock("@react-pdf/renderer", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
    return {
        ...actual,
        pdf: (...args: Parameters<typeof actual.pdf>) => {
            documents.push(args[0]);
            return actual.pdf(...args);
        },
    };
});

import { GET } from "./route";

function textContent(node: ReactNode): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textContent).join("\n");
    return textContent((node as ReactElement<{ children?: ReactNode }>).props?.children);
}

describe("Invoice PDF notes", () => {
    beforeEach(() => {
        query.mockReset();
        documents.length = 0;
    });

    it.each(["default", "eye-friendly", "dark"])("renders saved multiline notes in the %s PDF", async (theme) => {
        const notes = "ملاحظة خاصة بالفاتورة\nSecond line of invoice notes";
        query.mockResolvedValueOnce([{
            id: "invoice-1", invoice_number: "INV-2026-0001", state: "draft",
            invoice_date: "2026-11-07", due_date: "2026-12-07",
            partner_name: "عميل تجريبي", notes, subtotal: "200.00",
            discount_amount: "10.00", tax_amount: "28.50", total_amount: "218.50",
            amount_paid: "0.00", amount_due: "218.50", payment_terms: "Net 30",
        }]).mockResolvedValueOnce([{
            description: "إقامة", quantity: "2.00", unit_price: "100.00",
            tax_rate: "15.00", line_total_with_tax: "218.50",
        }]).mockResolvedValueOnce([{
            company_name: "Nested United", invoice_terms: "شروط الشركة",
        }]);

        const response = await GET(new NextRequest(`http://localhost/api/accounting/invoices/invoice-1/pdf?theme=${theme}`), {
            params: Promise.resolve({ id: "invoice-1" }),
        });
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("application/pdf");
        const bytes = Buffer.from(await response.arrayBuffer());
        expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
        const content = textContent(documents[0] as ReactNode);
        expect(content).toContain(notes);
        expect(content).toContain("ملاحظات");
        expect(content).toContain("شروط الشركة");
    });
});
