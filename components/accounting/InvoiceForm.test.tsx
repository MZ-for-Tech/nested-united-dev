// @vitest-environment happy-dom
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { InvoiceForm } from "./InvoiceForm";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/accounting/DialogProvider", () => ({
    useDialog: () => ({ alert: vi.fn() }),
}));

describe("InvoiceForm database values", () => {
    let container: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        push.mockReset();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        }));
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    it("opens and saves an invoice containing MySQL decimal strings and fixed discounts", async () => {
        await act(async () => root.render(<InvoiceForm invoiceId="invoice-1" initialData={{
            partner_id: "partner-1",
            partner_name: "Customer",
            invoice_date: "2026-11-07",
            due_date: "2026-12-07",
            notes: "First note\nSecond note",
            // MySQL returns DECIMAL as strings at runtime.
            lines: JSON.parse(JSON.stringify([
                { description: "Stay", quantity: "2.00", unit_price: "100.00", discount_type: "fixed", discount_value: "10.00", tax_rate: "15.00" },
                { description: "Service", quantity: "1.00", unit_price: "50.00", discount_type: "fixed", discount_value: "5.00", tax_rate: "15.00" },
            ])),
        }} />));

        expect(container.textContent).toContain("-15.00 ر.س");
        expect(container.textContent).toContain("270.25 ر.س");
        expect(fetch).toHaveBeenCalledWith("/api/accounting/partners");
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true, json: async () => ({ id: "invoice-1" }),
        } as Response);

        await act(async () => {
            container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        expect(push).toHaveBeenCalledWith("/accounting/invoices/invoice-1");
        const [, options] = vi.mocked(fetch).mock.calls[1];
        expect(options?.method).toBe("PUT");
        const saved = JSON.parse(options!.body as string);
        expect(saved.notes).toBe("First note\nSecond note");
        expect(saved.lines[0].discount_value).toBe(10);
        expect(saved.lines[0].quantity).toBe(2);
    });

    it("calculates a mixture of percentage and fixed decimal-string discounts", async () => {
        await act(async () => root.render(<InvoiceForm initialData={{ lines: JSON.parse(JSON.stringify([
            { description: "Stay", quantity: "2.00", unit_price: "100.00", discount_type: "percentage", discount_value: "10.00", tax_rate: "15.00" },
            { description: "Service", quantity: "1.00", unit_price: "50.00", discount_type: "fixed", discount_value: "5.00", tax_rate: "15.00" },
        ])) }} />));
        expect(container.textContent).toContain("258.75 ر.س");
    });

    it("omits tax from totals and submitted lines when disabled", async () => {
        await act(async () => root.render(<InvoiceForm invoiceId="invoice-1" initialData={{
            partner_id: "partner-1", partner_name: "Customer", invoice_date: "2026-11-07", due_date: "2026-11-07",
            lines: [{ description: "Stay", quantity: 1, unit_price: 100, discount_type: "fixed", discount_value: 0, tax_rate: 15 }],
        }} />));
        const toggle = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        await act(async () => { toggle.click(); });
        expect(container.textContent).toContain("100.00 ر.س");
        expect(container.textContent).not.toContain("الضريبة:");
        vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ id: "invoice-1" }) } as Response);
        await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
        const saved = JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string);
        expect(saved.lines[0].tax_rate).toBe(0);
    });
});
