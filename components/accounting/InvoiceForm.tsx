"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/accounting/DialogProvider";
import {
    Plus,
    Trash2,
    Save,
    X,
    Upload,
    Paperclip,
    FileText,
    Search,
    UserPlus,
} from "lucide-react";

interface InvoiceLine {
    description: string;
    quantity: number;
    unit_price: number;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    tax_rate: number;
    account_id?: string | null;
}

interface Partner {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    tax_id?: string;
    type: string;
}

interface InvoiceData {
    partner_id?: string;
    partner_name?: string;
    partner_email?: string;
    partner_phone?: string;
    partner_vat?: string;
    address?: string;
    invoice_date?: string;
    due_date?: string | null;
    reference?: string | null;
    notes?: string | null;
    payment_terms?: string | null;
    attachment_url?: string | null;
    lines?: InvoiceLine[];
}

interface InvoiceFormProps {
    initialData?: InvoiceData;
    invoiceId?: string;
    /** customer_invoice (default) | vendor_bill */
    invoiceType?: "customer_invoice" | "vendor_bill";
}

export function InvoiceForm({ initialData, invoiceId, invoiceType = "customer_invoice" }: InvoiceFormProps) {
    const router = useRouter();
    const { alert } = useDialog();
    const isVendorBill = invoiceType === "vendor_bill";
    const [loading, setLoading] = useState(false);
    const [allPartners, setAllPartners] = useState<Partner[]>([]);

    // Smart partner autocomplete state
    const [partnerQuery, setPartnerQuery] = useState(initialData?.partner_name || "");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedPartnerId, setSelectedPartnerId] = useState(initialData?.partner_id || "");
    const [isNewPartner, setIsNewPartner] = useState(false);
    const [partnerDetails, setPartnerDetails] = useState({
        email: initialData?.partner_email || "",
        phone: initialData?.partner_phone || "",
        address: initialData?.address || "",
        tax_id: initialData?.partner_vat || "",
    });
    const autocompleteRef = useRef<HTMLDivElement>(null);

    // فلترة الشركاء: عملاء لفواتير المبيعات، موردون لفواتير الشراء
    const suggestions = allPartners.filter((p) => {
        const nameMatch =
            p.name.toLowerCase().includes(partnerQuery.toLowerCase()) ||
            (p.email && p.email.toLowerCase().includes(partnerQuery.toLowerCase()));
        if (!nameMatch) return false;
        if (isVendorBill) return p.type === "supplier" || p.type === "vendor" || p.type === "both";
        return p.type === "customer" || p.type === "both";
    }).slice(0, 6);

    const [formData, setFormData] = useState({
        invoice_date: initialData?.invoice_date || new Date().toISOString().split("T")[0],
        due_date: initialData?.due_date || "",
        reference: initialData?.reference || "",
    });
    const [notes, setNotes] = useState(initialData?.notes || "");
    const [paymentTerms, setPaymentTerms] = useState(initialData?.payment_terms || "Net 30");
    const [attachmentUrl, setAttachmentUrl] = useState(initialData?.attachment_url || "");
    const [isUploading, setIsUploading] = useState(false);

    const [items, setItems] = useState<InvoiceLine[]>(
        // MySQL DECIMAL columns arrive as strings, even though the API types
        // describe numbers. Normalize before adding discounts to the totals.
        initialData?.lines?.map((line) => ({
            ...line,
            quantity: Number(line.quantity),
            unit_price: Number(line.unit_price),
            discount_value: Number(line.discount_value ?? 0),
            tax_rate: Number(line.tax_rate ?? 0),
        })) || [
            {
                description: "",
                quantity: 1,
                unit_price: 0,
                discount_type: "percentage",
                discount_value: 0,
                tax_rate: 15,
            },
        ]
    );

    async function fetchPartners() {
        const res = await fetch("/api/accounting/partners");
        if (res.ok) {
            setAllPartners(await res.json());
        }
    }

    useEffect(() => {
        fetchPartners();
        // Close suggestions on outside click
        const handler = (e: MouseEvent) => {
            if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handlePartnerSelect = (partner: Partner) => {
        setPartnerQuery(partner.name);
        setSelectedPartnerId(partner.id);
        setIsNewPartner(false);
        setPartnerDetails({
            email: partner.email || "",
            phone: partner.phone || "",
            address: partner.address || "",
            tax_id: partner.tax_id || "",
        });
        setShowSuggestions(false);
    };

    const handlePartnerQueryChange = (val: string) => {
        setPartnerQuery(val);
        setSelectedPartnerId(""); // clear selection
        setIsNewPartner(false);
        setShowSuggestions(true);
    };

    const handleCreateNewPartner = () => {
        setSelectedPartnerId("");
        setIsNewPartner(true);
        setShowSuggestions(false);
    };

    const addLine = () => {
        setItems([
            ...items,
            {
                description: "",
                quantity: 1,
                unit_price: 0,
                discount_type: "percentage",
                discount_value: 0,
                tax_rate: 15,
            },
        ]);
    };

    const removeLine = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof InvoiceLine, value: string | number) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [field]: value } as InvoiceLine;
        setItems(updated);
    };

    const calculateLineTotal = (line: InvoiceLine) => {
        const subtotal = line.quantity * line.unit_price;
        let discount = 0;
        if (line.discount_type === "percentage") {
            discount = (subtotal * line.discount_value) / 100;
        } else {
            discount = line.discount_value;
        }
        const afterDiscount = subtotal - discount;
        const tax = (afterDiscount * line.tax_rate) / 100;
        return afterDiscount + tax;
    };

    const calculateTotals = () => {
        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        items.forEach((line) => {
            const lineSubtotal = line.quantity * line.unit_price;
            subtotal += lineSubtotal;

            let discount = 0;
            if (line.discount_type === "percentage") {
                discount = (lineSubtotal * line.discount_value) / 100;
            } else {
                discount = line.discount_value;
            }
            totalDiscount += discount;

            const afterDiscount = lineSubtotal - discount;
            const tax = (afterDiscount * line.tax_rate) / 100;
            totalTax += tax;
        });

        return {
            subtotal,
            totalDiscount,
            totalTax,
            total: subtotal - totalDiscount + totalTax,
        };
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setAttachmentUrl(data.url);
            } else {
                await alert("فشل رفع الملف");
            }
        } catch (error) {
            console.error("Upload error:", error);
            await alert("حدث خطأ أثناء الرفع");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent, confirmAction = false) => {
        e.preventDefault();

        if (!partnerQuery.trim()) {
            await alert(isVendorBill ? "الرجاء إدخال اسم المورد" : "الرجاء إدخال اسم العميل");
            return;
        }

        setLoading(true);

        try {
            let resolvedPartnerId = selectedPartnerId;

            // If a new partner, create them first
            if (!resolvedPartnerId || isNewPartner) {
                const createRes = await fetch("/api/accounting/partners", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: partnerQuery.trim(),
                        email: partnerDetails.email || null,
                        phone: partnerDetails.phone || null,
                        address: partnerDetails.address || null,
                        tax_id: partnerDetails.tax_id || null,
                        type: isVendorBill ? "supplier" : "customer",
                    }),
                });
                if (!createRes.ok) {
                    const err = await createRes.json();
                    await alert(`فشل إضافة ${isVendorBill ? "المورد" : "العميل"}: ${err.error}`);
                    setLoading(false);
                    return;
                }
                const created = await createRes.json();
                resolvedPartnerId = created.id;
            }

            const body = {
                ...formData,
                invoice_type: invoiceType,
                partner_id: resolvedPartnerId,
                notes,
                payment_terms: paymentTerms,
                attachment_url: attachmentUrl,
                lines: items,
            };

            let res;
            if (invoiceId) {
                res = await fetch(`/api/accounting/invoices/${invoiceId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
            } else {
                res = await fetch("/api/accounting/invoices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
            }

            if (res.ok) {
                const invoice = await res.json();
                if (confirmAction && invoice.id) {
                    const confirmRes = await fetch(`/api/accounting/invoices/${invoice.id}/confirm`, {
                        method: "POST",
                    });
                    if (!confirmRes.ok) {
                        const error = await confirmRes.json();
                        await alert(`فشل التأكيد: ${error.error}`);
                        router.push(`/accounting/invoices/${invoice.id}`);
                        return;
                    }
                }
                router.push(`/accounting/invoices/${invoice.id || invoiceId}`);
            } else {
                const error = await res.json();
                await alert(`خطأ: ${error.error}`);
            }
        } catch (error) {
            console.error(error);
            await alert("حدث خطأ أثناء الحفظ");
        } finally {
            setLoading(false);
        }
    };

    const totals = calculateTotals();

    return (
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {/* Invoice Header */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h2 className="text-lg font-bold mb-4">معلومات الفاتورة</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Smart Partner Autocomplete */}
                    <div className="md:col-span-2" ref={autocompleteRef}>
                        <label className="block text-sm font-medium mb-1">{isVendorBill ? "المورد *" : "العميل *"}</label>
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                            <input
                                type="text"
                                value={partnerQuery}
                                onChange={(e) => handlePartnerQueryChange(e.target.value)}
                                onFocus={() => setShowSuggestions(true)}
                                className={`w-full pr-9 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${selectedPartnerId ? "border-green-400 bg-green-50" : ""}`}
                                placeholder={isVendorBill ? "ابحث باسم المورد أو البريد الإلكتروني..." : "ابحث باسم العميل أو البريد الإلكتروني..."}
                                required
                            />
                            {selectedPartnerId && (
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">✓ محدد</span>
                            )}
                            {isNewPartner && (
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-medium">+ جديد</span>
                            )}
                        </div>

                        {/* Suggestions Dropdown */}
                        {showSuggestions && partnerQuery.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full max-w-xl bg-white border rounded-xl shadow-xl overflow-hidden">
                                {suggestions.length > 0 ? (
                                    <>
                                        {suggestions.map((p) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => handlePartnerSelect(p)}
                                                className="w-full text-right px-4 py-3 hover:bg-blue-50 border-b last:border-0 flex items-start gap-3"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
                                                    {p.name.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 truncate">{p.name}</p>
                                                    {p.email && <p className="text-xs text-gray-500 truncate">{p.email}</p>}
                                                    {p.phone && <p className="text-xs text-gray-400">{p.phone}</p>}
                                                </div>
                                                <span className="text-xs text-gray-400 mt-1 flex-shrink-0">{p.type === "customer" ? "عميل" : p.type === "supplier" ? "مورد" : p.type}</span>
                                            </button>
                                        ))}
                                    </>
                                ) : null}
                                {/* Create New Option */}
                                <button
                                    type="button"
                                    onClick={handleCreateNewPartner}
                                    className="w-full text-right px-4 py-3 hover:bg-blue-50 flex items-center gap-3 text-blue-600 font-medium bg-blue-50/50"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    <span>إضافة &quot;{partnerQuery}&quot; {isVendorBill ? "كمورد جديد" : "كعميل جديد"}</span>
                                </button>
                            </div>
                        )}

                        {/* Partner Detail Fields — shown for new partner or selected */}
                        {(isNewPartner || selectedPartnerId) && (
                            <div className="mt-3 grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg border">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">البريد الإلكتروني</label>
                                    <input
                                        type="email"
                                        value={partnerDetails.email}
                                        onChange={(e) => setPartnerDetails({ ...partnerDetails, email: e.target.value })}
                                        disabled={!!selectedPartnerId && !isNewPartner}
                                        className="w-full px-3 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                                        placeholder="example@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">رقم الهاتف</label>
                                    <input
                                        type="text"
                                        value={partnerDetails.phone}
                                        onChange={(e) => setPartnerDetails({ ...partnerDetails, phone: e.target.value })}
                                        disabled={!!selectedPartnerId && !isNewPartner}
                                        className="w-full px-3 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                                        placeholder="05xxxxxxxx"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">الرقم الضريبي</label>
                                    <input
                                        type="text"
                                        value={partnerDetails.tax_id}
                                        onChange={(e) => setPartnerDetails({ ...partnerDetails, tax_id: e.target.value })}
                                        disabled={!!selectedPartnerId && !isNewPartner}
                                        className="w-full px-3 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                                        placeholder="3xxxxxxxxxxxxxxxxx"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">العنوان</label>
                                    <input
                                        type="text"
                                        value={partnerDetails.address}
                                        onChange={(e) => setPartnerDetails({ ...partnerDetails, address: e.target.value })}
                                        disabled={!!selectedPartnerId && !isNewPartner}
                                        className="w-full px-3 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
                                        placeholder="المدينة، الشارع..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">تاريخ الفاتورة *</label>
                        <input
                            type="date"
                            required
                            value={formData.invoice_date}
                            onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">تاريخ الاستحقاق *</label>
                        <input
                            type="date"
                            required
                            value={formData.due_date}
                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">المرجع</label>
                        <input
                            type="text"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="رقم أمر الشراء..."
                        />
                    </div>
                </div>
            </div>

            {/* Invoice Lines */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">بنود الفاتورة</h2>
                    <button
                        type="button"
                        onClick={addLine}
                        className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-3 py-1 rounded"
                    >
                        <Plus className="w-4 h-4" />
                        <span>إضافة بند</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-3 py-2 text-right">الوصف *</th>
                                <th className="px-3 py-2 text-right w-24">الكمية</th>
                                <th className="px-3 py-2 text-right w-32">السعر</th>
                                <th className="px-3 py-2 text-right w-32">الخصم</th>
                                <th className="px-3 py-2 text-right w-24">الضريبة %</th>
                                <th className="px-3 py-2 text-right w-32">المجموع</th>
                                <th className="px-3 py-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {items.map((line, index) => (
                                <tr key={index}>
                                    <td className="px-3 py-2">
                                        <input
                                            type="text"
                                            required
                                            value={line.description}
                                            onChange={(e) => updateLine(index, "description", e.target.value)}
                                            className="w-full px-2 py-1 border rounded"
                                            placeholder="وصف المنتج/الخدمة"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            required
                                            min="0.01"
                                            step="0.01"
                                            value={line.quantity}
                                            onChange={(e) => updateLine(index, "quantity", parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border rounded text-center"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={line.unit_price}
                                            onChange={(e) => updateLine(index, "unit_price", parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border rounded"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex gap-1">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={line.discount_value}
                                                onChange={(e) => updateLine(index, "discount_value", parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-1 border rounded"
                                            />
                                            <select
                                                value={line.discount_type}
                                                onChange={(e) => updateLine(index, "discount_type", e.target.value as InvoiceLine["discount_type"])}
                                                className="px-1 py-1 border rounded text-xs"
                                            >
                                                <option value="percentage">%</option>
                                                <option value="fixed">ر.س</option>
                                            </select>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={line.tax_rate}
                                            onChange={(e) => updateLine(index, "tax_rate", parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border rounded text-center"
                                        />
                                    </td>
                                    <td className="px-3 py-2 font-medium">
                                        {calculateLineTotal(line).toFixed(2)} ر.س
                                    </td>
                                    <td className="px-3 py-2">
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeLine(index)}
                                                className="text-red-500 hover:bg-red-50 p-1 rounded"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div className="mt-6 flex justify-end">
                    <div className="w-80 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>المجموع الفرعي:</span>
                            <span className="font-medium">{totals.subtotal.toFixed(2)} ر.س</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                            <span>الخصم:</span>
                            <span>-{totals.totalDiscount.toFixed(2)} ر.س</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                            <span>الضريبة:</span>
                            <span>+{totals.totalTax.toFixed(2)} ر.س</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t">
                            <span>الإجمالي:</span>
                            <span>{totals.total.toFixed(2)} ر.س</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notes & Attachments */}
            <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">شروط الدفع</label>
                            <textarea
                                value={paymentTerms}
                                onChange={(e) => setPaymentTerms(e.target.value)}
                                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="مثال: الدفع خلال 30 يوم"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                placeholder="ملاحظات إضافية على الفاتورة..."
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">المرفقات (صورة الفاتورة الأصلية)</label>
                        <div className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 text-center transition-colors hover:bg-gray-100">
                            {attachmentUrl ? (
                                <div className="space-y-2 w-full">
                                    <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg text-sm font-medium">
                                        <Paperclip className="w-4 h-4" />
                                        <span>تم إرفاق ملف</span>
                                    </div>
                                    <div className="flex gap-4 justify-center pt-2">
                                        <a
                                            href={attachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                        >
                                            <FileText className="w-4 h-4" />
                                            عرض الملف
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => setAttachmentUrl("")}
                                            className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                                        >
                                            <X className="w-4 h-4" />
                                            حذف
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                        <Upload className={`w-6 h-6 text-gray-400 ${isUploading ? 'animate-bounce' : ''}`} />
                                    </div>
                                    <p className="text-sm text-gray-500 mb-4">
                                        {isUploading ? 'جاري الرفع...' : 'ارفع صورة أو ملف PDF الفاتورة'}
                                    </p>
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="invoice-attachment"
                                        accept="image/*,.pdf"
                                        disabled={isUploading}
                                    />
                                    <label
                                        htmlFor="invoice-attachment"
                                        className="cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
                                    >
                                        اختر ملف
                                    </label>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                    disabled={loading}
                >
                    إلغاء
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition shadow-sm font-medium"
                >
                    <Save className="w-4 h-4" />
                    {loading ? "جاري الحفظ..." : "حفظ كمسودة"}
                </button>
                {!invoiceId && (
                    <button
                        type="button"
                        onClick={(e) => handleSubmit(e, true)}
                        disabled={loading}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-sm font-medium"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? "جاري الحفظ..." : "حفظ وتأكيد"}
                    </button>
                )}
            </div>
        </form>
    );
}
