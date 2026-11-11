import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { AccountingInvoice, AccountingInvoiceLine, CompanySettings } from "@/lib/types/accounting";
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);
const money = (value: unknown) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount = (value: unknown) => `<span class="ltr">${money(value)}</span> ر.س`;
const date = (value: unknown) => escapeHtml(String(value ?? "").slice(0, 10));
const mixedText = (value: unknown) => String(value ?? "")
    .split(/(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}:\d{2}|\d[\d,.]*|[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*)*)/g)
    .map((part) => /^[\dA-Za-z]/.test(part) ? `<bdi dir="ltr">${escapeHtml(part)}</bdi>` : escapeHtml(part))
    .join("");

function logoDataUrl(logoUrl?: string | null): string | null {
    if (!logoUrl) return null;
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(logoUrl)) return logoUrl;
    const publicRoot = path.resolve(process.cwd(), "public");
    const logoFile = path.resolve(publicRoot, logoUrl.replace(/^\/+/, ""));
    if (!logoFile.startsWith(publicRoot + path.sep) || !fs.existsSync(logoFile)) return null;
    const ext = path.extname(logoFile).toLowerCase();
    const mime = ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" } as Record<string, string>)[ext];
    return mime ? `data:${mime};base64,${fs.readFileSync(logoFile).toString("base64")}` : null;
}

function invoiceHtml(invoice: AccountingInvoice, company: CompanySettings, logo: string | null, theme: string): string {
    const taxed = Number(invoice.tax_amount) > 0;
    const dark = theme === "dark";
    const warm = theme === "eye-friendly";
    const bg = dark ? "#111827" : warm ? "#fdfbf7" : "#fff";
    const fg = dark ? "#f9fafb" : "#172033";
    const soft = dark ? "#9ca3af" : "#64748b";
    const border = dark ? "#374151" : "#d8dce2";
    const status = ({ draft: "مسودة", confirmed: "مؤكدة", paid: "مدفوعة", partial: "مدفوعة جزئيًا", cancelled: "ملغاة" } as Record<string, string>)[invoice.state] || invoice.state;
    const terms = (company.invoice_terms || "").split(/\r?\n/).map((line) => line.replace(/^[-•·]\s*/, "").trim()).filter(Boolean);
    const notes = (invoice.notes || "").split(/\r?\n/).filter((line) => line.trim());
    const rows = (invoice.lines || []).map((line: AccountingInvoiceLine) => `<tr>
      <td>${mixedText(line.description)}</td><td class="center"><span class="ltr">${escapeHtml(Number(line.quantity))}</span></td>
      <td class="center"><span class="ltr">${money(line.unit_price)}</span></td>
      ${taxed ? `<td class="center"><span class="ltr">${escapeHtml(Number(line.tax_rate))}%</span></td>` : ""}
      <td class="center">${amount(line.line_total_with_tax)}</td></tr>`).join("");
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;width:793px;height:1122px;overflow:hidden}body{font-family:Arial,Tahoma,sans-serif;color:${fg};background:${bg};font-size:11px;line-height:1.6}#sheet{position:absolute;top:0;left:0;width:793px;padding:44px 52px 48px;transform-origin:top center}.head{display:flex;justify-content:space-between;border-bottom:1px solid ${border};padding-bottom:12px}.brand{text-align:right}.brand img{max-width:88px;max-height:62px;object-fit:contain;display:block;margin-bottom:4px}.brand h1{font-size:18px;margin:0;direction:ltr}.meta{text-align:left;direction:ltr}.meta h2{font-size:15px;margin:0;direction:rtl}.number{font-size:23px;font-weight:700}.badge{display:inline-block;background:${dark ? "#1f3c36" : "#edf5f2"};color:${dark ? "#6ee7b7" : "#047857"};padding:2px 8px;border-radius:4px;direction:rtl}.muted,.label{color:${soft}}.details{display:grid;grid-template-columns:2fr 1fr 1fr;gap:15px;margin:16px 0}.label{font-size:10px}.value{font-weight:700}.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}.section{font-size:12px;font-weight:700;border-bottom:1px solid ${border};padding-bottom:4px;margin:14px 0 6px}table{width:100%;table-layout:fixed;border-collapse:collapse}th{text-align:right;color:${soft};font-size:10px;border-bottom:1px solid ${border};padding:7px 5px}td{border-bottom:1px solid ${border};padding:8px 5px;vertical-align:top}.center{text-align:center}.summary{display:flex;gap:20px;margin-top:13px}.terms{width:55%}.totals{width:45%}.row{display:flex;justify-content:space-between;padding:3px 0}.grand{border-top:1px solid ${border};margin-top:4px;padding-top:7px;font-size:14px;font-weight:700}.notes{white-space:pre-wrap;overflow-wrap:anywhere}ul{padding-right:17px;margin:4px 0}li{margin:2px 0}.footer{border-top:1px solid ${border};margin-top:16px;padding-top:7px;text-align:center;color:${soft};font-size:10px}
      body{font-size:13px;line-height:1.65}#sheet{padding:38px 42px 42px}.brand img{max-width:126px;max-height:82px}.brand h1{font-size:20px}.meta h2{font-size:17px}.number{font-size:26px}.label{font-size:11px}.section{font-size:14px}th,td{font-size:12px}.center{white-space:nowrap}.notes{font-size:12px}.footer{font-size:11px}
    </style></head><body><main id="sheet"><header class="head"><div class="brand">
      ${logo ? `<img id="company-logo" src="${escapeHtml(logo)}" alt="شعار الشركة">` : ""}
      <h1>${escapeHtml(company.company_name || "Nested United")}</h1>
      ${taxed && company.tax_number ? `<div class="muted">الرقم الضريبي: <span class="ltr">${escapeHtml(company.tax_number)}</span></div>` : ""}
      ${company.commercial_registration ? `<div class="muted">السجل التجاري: ${escapeHtml(company.commercial_registration)}</div>` : ""}
      ${company.address ? `<div class="muted">${escapeHtml(company.address)}</div>` : ""}
      ${company.phone ? `<div class="muted ltr">${escapeHtml(company.phone)}</div>` : ""}</div>
      <div class="meta"><h2>${escapeHtml(taxed ? company.invoice_type_label || "فاتورة ضريبية" : "فاتورة خدمات")}</h2><div class="number">${escapeHtml(invoice.invoice_number)}</div><span class="badge">${escapeHtml(status)}</span></div></header>
      <div class="details"><div><div class="label">${invoice.invoice_type === "vendor_bill" ? "المورد" : "العميل"}</div><div class="value">${escapeHtml(invoice.partner_name)}</div>${invoice.partner_email ? `<div>${escapeHtml(invoice.partner_email)}</div>` : ""}${invoice.partner_phone ? `<div class="ltr">${escapeHtml(invoice.partner_phone)}</div>` : ""}</div>
      <div><div class="label">تاريخ الفاتورة</div><div class="value ltr">${date(invoice.invoice_date)}</div><div class="label">تاريخ الاستحقاق</div><div class="value ltr">${date(invoice.due_date)}</div></div>
      <div>${invoice.reference ? `<div class="label">المرجع</div><div class="value">${escapeHtml(invoice.reference)}</div>` : ""}</div></div>
      <table><thead><tr><th style="width:${taxed ? 44 : 52}%">الوصف</th><th style="width:10%">الكمية</th><th style="width:17%">السعر</th>${taxed ? '<th style="width:10%">الضريبة</th>' : ""}<th>المجموع</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="summary"><div class="terms">${terms.length ? `<div class="section">الشروط والأحكام</div><ul>${terms.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}</div><div class="totals">
      <div class="row"><span>المجموع الفرعي</span><strong>${amount(invoice.subtotal)}</strong></div>
      ${Number(invoice.discount_amount) > 0 ? `<div class="row"><span>الخصم</span><strong>-${amount(invoice.discount_amount)}</strong></div>` : ""}
      ${taxed ? `<div class="row"><span>ضريبة القيمة المضافة</span><strong>${amount(invoice.tax_amount)}</strong></div>` : ""}
      <div class="row grand"><span>الإجمالي</span><span>${amount(invoice.total_amount)}</span></div>
      ${Number(invoice.amount_paid) > 0 ? `<div class="row"><span>المدفوع</span><strong>${amount(invoice.amount_paid)}</strong></div>` : ""}
      ${Number(invoice.amount_due) > 0 ? `<div class="row"><span>المتبقي</span><strong>${amount(invoice.amount_due)}</strong></div>` : ""}</div></div>
      ${notes.length ? `<div class="section">ملاحظات</div><div class="notes">${notes.map(mixedText).join("<br>")}</div>` : ""}
      <div class="footer">${invoice.payment_terms ? `شروط الدفع: ${escapeHtml(invoice.payment_terms)}<br>` : ""}${escapeHtml(company.invoice_footer || "شكرًا لتعاملكم معنا")}<br>${escapeHtml(company.company_name || "Nested United")}</div>
    </main></body></html>`;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser();
        if (!user?.id) return NextResponse.json({ error: "يرجى تسجيل الدخول أولاً" }, { status: 401 });
        const { id } = await context.params;
        const [invoice] = await query<AccountingInvoice>(`SELECT i.*, p.name AS partner_name, p.email AS partner_email, p.phone AS partner_phone
            FROM accounting_invoices i LEFT JOIN accounting_partners p ON i.partner_id = p.id
            WHERE i.id = ? AND i.deleted_at IS NULL`, [id]);
        if (!invoice) return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
        invoice.lines = await query<AccountingInvoiceLine>("SELECT * FROM accounting_invoice_lines WHERE invoice_id = ? ORDER BY created_at", [id]);
        const [company] = await query<CompanySettings>("SELECT * FROM company_settings LIMIT 1");
        const theme = new URL(req.url).searchParams.get("theme") || "default";
        const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        let bytes: Uint8Array;
        try {
            const page = await browser.newPage();
            await page.setContent(invoiceHtml(invoice, company || {} as CompanySettings, logoDataUrl(company?.logo_url), theme), { waitUntil: "networkidle0" });
            await page.evaluate(async () => {
                await document.fonts.ready;
                const logo = document.getElementById("company-logo") as HTMLImageElement | null;
                if (logo) {
                    await logo.decode();
                    const canvas = document.createElement("canvas");
                    canvas.width = logo.naturalWidth;
                    canvas.height = logo.naturalHeight;
                    const ctx = canvas.getContext("2d")!;
                    ctx.drawImage(logo, 0, 0);
                    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
                    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
                        const i = (y * canvas.width + x) * 4;
                        if (pixels[i + 3] > 24 && (pixels[i] < 245 || pixels[i + 1] < 245 || pixels[i + 2] < 245)) {
                            left = Math.min(left, x); right = Math.max(right, x);
                            top = Math.min(top, y); bottom = Math.max(bottom, y);
                        }
                    }
                    if (right >= left && bottom >= top) {
                        const pad = Math.max(4, Math.round(Math.max(canvas.width, canvas.height) * 0.02));
                        left = Math.max(0, left - pad); top = Math.max(0, top - pad);
                        right = Math.min(canvas.width - 1, right + pad); bottom = Math.min(canvas.height - 1, bottom + pad);
                        const cropped = document.createElement("canvas");
                        cropped.width = right - left + 1; cropped.height = bottom - top + 1;
                        cropped.getContext("2d")!.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
                        logo.src = cropped.toDataURL("image/png");
                        await logo.decode();
                    }
                }
                const sheet = document.getElementById("sheet")!;
                const availableHeight = 1122;
                const scale = Math.min(1, availableHeight / sheet.scrollHeight);
                sheet.style.transform = `scale(${scale})`;
            });
            bytes = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
        } finally {
            await browser.close();
        }
        return new NextResponse(Buffer.from(bytes), { headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
        } });
    } catch (error) {
        console.error("Error generating PDF:", error);
        return NextResponse.json({ error: "فشل في إنشاء ملف PDF" }, { status: 500 });
    }
}
