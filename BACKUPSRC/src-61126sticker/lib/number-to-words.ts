const ones = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function underThousand(n: number): string {
  const out: string[] = [];
  if (n >= 100) { out.push(`${ones[Math.floor(n / 100)]} Hundred`); n %= 100; }
  if (n >= 20) { out.push(tens[Math.floor(n / 10)]); n %= 10; }
  if (n > 0) out.push(ones[n]);
  return out.join(" ");
}
export function rupeesInWords(value: unknown): string {
  let n = Math.max(0, Math.round(Number(value ?? 0) * 100) / 100);
  if (!Number.isFinite(n)) n = 0;
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  let remaining = rupees;
  const scales: [number, string][] = [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]];
  for (const [size, label] of scales) {
    if (remaining >= size) { parts.push(`${underThousand(Math.floor(remaining / size))} ${label}`); remaining %= size; }
  }
  if (remaining > 0) parts.push(underThousand(remaining));
  let result = `${parts.join(" ")} Rupees`;
  if (paise > 0) result += ` and ${underThousand(paise)} Paise`;
  return `${result} Only`;
}
