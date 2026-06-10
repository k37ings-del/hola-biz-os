export const COUNTRIES = [
  { code: "NG", name: "Nigeria", currency: "NGN", symbol: "₦" },
  { code: "GH", name: "Ghana", currency: "GHS", symbol: "GH₵" },
  { code: "ZA", name: "South Africa", currency: "ZAR", symbol: "R" },
  { code: "KE", name: "Kenya", currency: "KES", symbol: "KSh" },
  { code: "UG", name: "Uganda", currency: "UGX", symbol: "USh" },
  { code: "TZ", name: "Tanzania", currency: "TZS", symbol: "TSh" },
  { code: "RW", name: "Rwanda", currency: "RWF", symbol: "RF" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export const INDUSTRIES = [
  "Beauty & Wellness",
  "Healthcare",
  "Education",
  "Professional Services",
  "Retail",
  "Food & Beverage",
  "Real Estate",
  "NGO / Nonprofit",
  "Other",
] as const;

export const PLAN_TIERS = ["free", "starter", "growth", "enterprise"] as const;

export const BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
  "COMPLETED",
  "NO_SHOW",
] as const;

export const PAYMENT_STATUSES = ["PENDING", "CONFIRMED", "FAILED", "EXPIRED", "REFUNDED"] as const;

export const INVOICE_STATUSES = ["unpaid", "paid", "overdue", "cancelled"] as const;

export const DEFAULT_BUSINESS_HOURS = {
  mon: { active: true, open: "09:00", close: "18:00" },
  tue: { active: true, open: "09:00", close: "18:00" },
  wed: { active: true, open: "09:00", close: "18:00" },
  thu: { active: true, open: "09:00", close: "18:00" },
  fri: { active: true, open: "09:00", close: "18:00" },
  sat: { active: false, open: "09:00", close: "13:00" },
  sun: { active: false, open: "09:00", close: "13:00" },
};

export const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

export function getCurrencyForCountry(code: string): { currency: string; symbol: string } {
  const c = COUNTRIES.find((x) => x.code === code);
  return c ? { currency: c.currency, symbol: c.symbol } : { currency: "USD", symbol: "$" };
}
