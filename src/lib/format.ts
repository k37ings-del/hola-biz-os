import { useCurrentUser } from "@/lib/auth";

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

export const SUPPORTED_CURRENCIES = [
  "NGN",
  "GHS",
  "ZAR",
  "KES",
  "UGX",
  "TZS",
  "RWF",
  "USD",
  "EUR",
  "GBP",
] as const;

export function formatCurrency(amountCents: number | null | undefined, currency: string): string {
  const amount = (amountCents ?? 0) / 100;
  const symbol = SYMBOLS[currency] ?? currency + " ";
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Reads the signed-in tenant's default_currency, falls back to USD. */
export function useTenantCurrency(): string {
  const { data } = useCurrentUser();
  return data?.tenant.default_currency ?? "USD";
}

const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRefCode(prefix: "BP" | "INV" | "BK" = "BK"): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  return `${prefix}-${s}`;
}

export function relativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return sec <= 1 ? "just now" : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const t = raw.trim();
  if (t.startsWith("+")) return t;
  return `+${t.replace(/\D/g, "")}`;
}

export function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
