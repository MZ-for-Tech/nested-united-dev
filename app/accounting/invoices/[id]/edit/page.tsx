"use client";

import { useState, useEffect, useCallback } from "react";
import { AccountingInvoice } from "@/lib/types/accounting";
import { useParams } from "next/navigation";
import { InvoiceForm } from "@/components/accounting/InvoiceForm";

export default function EditInvoicePage() {
    const params = useParams();
    const [invoice, setInvoice] = useState<AccountingInvoice | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchInvoice = useCallback(async () => {
        try {
            const res = await fetch(`/api/accounting/invoices/${params.id}`);
            if (res.ok) {
                setInvoice(await res.json());
            }
        } finally {
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        if (params.id) {
            void fetchInvoice();
        }
    }, [params.id, fetchInvoice]);

    if (loading) {
        return <div className="p-8 text-center">جاري التحميل...</div>;
    }

    if (!invoice) {
        return <div className="p-8 text-center text-red-600">الفاتورة غير موجودة</div>;
    }

    if (invoice.state !== "draft" && invoice.state !== "cancelled") {
        return (
            <div className="p-8 text-center text-red-600">
                لا يمكن تعديل الفاتورة. يمكن تعديل المسودات أو الفواتير الملغاة فقط.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">تعديل الفاتورة {invoice.invoice_number}</h1>
                <p className="text-gray-600 mt-1">تعديل بيانات الفاتورة</p>
            </div>

            <InvoiceForm
                initialData={invoice}
                invoiceId={invoice.id}
                invoiceType={invoice.invoice_type === "vendor_bill" || invoice.invoice_type === "supplier_bill" ? "vendor_bill" : "customer_invoice"}
            />
        </div>
    );
}
