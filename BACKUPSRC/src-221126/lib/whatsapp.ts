const DEFAULT_COUNTRY = "91";

/** Normalize an Indian customer number for a WhatsApp click-to-chat URL. */
export function normalizeWhatsAppPhone(value: string, countryCode = DEFAULT_COUNTRY) {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return digits;
  if (digits.startsWith(countryCode) && digits.length >= countryCode.length + 8) return digits;
  if (digits.length === 10) return `${countryCode}${digits}`;
  return digits;
}

/** Build a WhatsApp click-to-chat URL. No API credentials are required. */
export function buildWhatsAppLink(phone: string, message: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function isWhatsAppPhoneValid(phone: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  return normalized.length >= 10;
}
