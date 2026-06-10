const SYMBOLS: Record<string, string> = {
  NGN: "₦",
  GHS: "GH₵",
  ZAR: "R",
  KES: "KSh",
  UGX: "USh",
  TZS: "TSh",
  RWF: "RF",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function formatCurrency(amountCents: number | null | undefined, currency: string): string {
  const amount = (amountCents ?? 0) / 100;
  const symbol = SYMBOLS[currency] ?? currency + " ";
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRefCode(prefix: "BP" | "INV" = "BP"): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  return `${prefix}-${s}`;
}

export function relativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}
