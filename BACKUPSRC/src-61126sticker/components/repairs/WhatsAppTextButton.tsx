"use client";
import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
export default function WhatsAppTextButton({ phone, message, label = "WhatsApp Bill" }: { phone?: string | null; message: string; label?: string }) {
  function open() {
    if (!phone) { window.alert("Customer phone number is missing."); return; }
    const url = buildWhatsAppLink(phone, message);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }
  return <button type="button" onClick={open} disabled={!phone} title={!phone ? "Customer phone number is missing" : label} className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 print:hidden"><MessageCircle size={16}/>{label}</button>;
}
