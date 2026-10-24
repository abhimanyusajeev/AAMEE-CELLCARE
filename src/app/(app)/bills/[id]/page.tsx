import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import PrintButton from "./PrintButton";
import WhatsAppTextButton from "@/components/repairs/WhatsAppTextButton";
import { rupeesInWords } from "@/lib/number-to-words";

const money = (value: unknown) => `₹${Number(value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Bill({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      branch: true,
      sale: { include: { customer: true, items: { include: { productVariant: { include: { product: true } } } }, payments: true } },
    },
  });
  if (!inv) notFound();
  const customer = inv.sale.customer;
  const items = inv.sale.items;
  const amount = Number(inv.sale.total);
  const message = [
    "\u{1F9FE} AAMEE CELLCARE — BILL / RECEIPT",
    `Invoice No: ${inv.invoiceNumber}`,
    `Date: ${new Date(inv.issuedAt).toLocaleDateString("en-IN")}`,
    `Customer: ${customer?.name || "Walk-in customer"}`,
    ...items.map((item, index) => `${index + 1}. ${item.productVariant.product.name} — Qty ${item.quantity} — ${money(Number(item.unitPrice) * item.quantity)}`),
    `Total Amount: ${money(amount)}`,
    "",
    "AAMEE CELLCARE",
    "\u{1F4DE} 9207277210 | 9207277770",
    "Thank you for choosing us!",
  ].join("\n");

  return <main className="invoice-page mx-auto max-w-4xl p-3 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
      <WhatsAppTextButton phone={customer?.phone} message={message} label="WhatsApp Bill" />
      <PrintButton />
    </div>
    <article className="invoice-paper border border-slate-300 bg-white p-5 text-slate-900 shadow-sm sm:p-8 print:shadow-none">
      <header className="grid grid-cols-1 items-center gap-4 border-b-2 border-slate-300 pb-4 sm:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0"><Image src="/branding/aamee-cellcare-logo.png" alt="Aamee Cellcare logo" width={1030} height={490} priority className="mb-2 h-auto w-52 object-contain"/><p className="text-xs font-semibold text-slate-600">The Complete Digital Solutions</p></div>
        <div className="text-sm leading-6 sm:text-right"><div className="font-extrabold">{inv.branch.name}</div><p>{inv.branch.address}</p><p>☎ 920 727 7210</p><p>☎ 920 727 7770</p><p>{inv.branch.email || "aameecellcare@gmail.com"}</p></div>
      </header>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><span className="text-sm font-semibold">Invoice No:</span> <strong className="text-2xl">{inv.invoiceNumber}</strong></div><div className="rounded-full bg-slate-700 px-5 py-2 text-sm font-bold tracking-wide text-white">INVOICE / RECEIPT</div><div className="text-sm"><strong>Invoice Date:</strong> {new Date(inv.issuedAt).toLocaleDateString("en-IN")}</div></div>
      <section className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <Info label="Name" value={customer?.name || "Walk-in customer"}/>
        <Info label="Phone" value={customer?.phone || ""}/>
        <Info label="Address" value={customer?.address || ""} wide/>
      </section>
      <div className="mt-6 overflow-x-auto"><table className="invoice-table w-full border-collapse text-sm"><thead><tr><th className="w-14 border border-slate-500 p-2 text-center">Sl. No</th><th className="border border-slate-500 p-2 text-left">Description</th><th className="w-24 border border-slate-500 p-2 text-center">Quantity</th><th className="w-36 border border-slate-500 p-2 text-right">Amount</th></tr></thead><tbody>{items.map((item, index) => <tr key={item.id}><td className="border border-slate-400 p-2 text-center">{index + 1}</td><td className="border border-slate-400 p-2"><div className="font-semibold">{item.productVariant.product.name}</div>{item.productVariant.name ? <div className="text-xs text-slate-500">{item.productVariant.name}</div> : null}{item.serialDeviceId ? <div className="text-xs text-slate-500">Serial / IMEI device tracked</div> : null}</td><td className="border border-slate-400 p-2 text-center">{item.quantity}</td><td className="border border-slate-400 p-2 text-right">{money(Number(item.unitPrice) * item.quantity)}</td></tr>)}{items.length < 5 && Array.from({ length: 5 - items.length }).map((_, index) => <tr key={`blank-${index}`} className="invoice-blank-row"><td className="border border-slate-400 p-2">&nbsp;</td><td className="border border-slate-400 p-2">&nbsp;</td><td className="border border-slate-400 p-2">&nbsp;</td><td className="border border-slate-400 p-2">&nbsp;</td></tr>)}</tbody><tfoot><tr><th colSpan={3} className="border border-slate-500 p-3 text-right">Total Amount</th><th className="border border-slate-500 p-3 text-right text-lg">{money(amount)}</th></tr></tfoot></table></div>
      <div className="mt-3 border border-slate-400 p-3 text-sm"><strong>Amount in Words:</strong> {rupeesInWords(amount)}</div>
      <div className="mt-6 flex flex-wrap justify-between gap-4 text-xs text-slate-600"><div><p className="font-bold text-slate-800">Thank you for your business.</p><p>Warranty is as stated on the product bill, if applicable.</p></div><div className="ml-auto mt-8 min-w-48 border-t border-slate-500 pt-2 text-center">Authorized Signature</div></div>
    </article>
    <style>{`@media print { @page { size:A4; margin:10mm; } body { background:#fff !important; } body * { visibility:hidden; } .invoice-page,.invoice-page * { visibility:visible; } .invoice-page { position:absolute; left:0; top:0; width:100%; max-width:none; margin:0 !important; padding:0 !important; } .invoice-paper { border:1px solid #777 !important; box-shadow:none !important; padding:7mm !important; } .invoice-paper header img { width:48mm !important; } .invoice-blank-row td { height:9mm; } .invoice-table { break-inside:auto; } .invoice-table tr { break-inside:avoid; } }`}</style>
  </main>;
}
function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={`min-w-0 border-b border-dotted border-slate-400 pb-2 ${wide ? "sm:col-span-2" : ""}`}><span className="font-bold">{label}: </span><span className="break-words">{value || " "}</span></div>; }
