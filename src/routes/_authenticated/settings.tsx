import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2, CreditCard, Lock, Eye, EyeOff, Palette, Clock, Building2, Copy, ExternalLink, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { getPaymentProviders, savePaymentProviders } from "@/lib/payment-providers.functions";
import { getTenantSettings, saveTenantBranding, uploadTenantLogo } from "@/lib/tenant-settings.functions";
import { COUNTRIES, DEFAULT_BUSINESS_HOURS, DAYS } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · HolaWeb" }] }),
  component: SettingsPage,
});

const TIMEZONES = [
  "Africa/Lagos", "Africa/Accra", "Africa/Johannesburg", "Africa/Nairobi",
  "Africa/Kampala", "Africa/Dar_es_Salaam", "Africa/Kigali", "Africa/Cairo",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC",
];

function SettingsPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <PageHeader title="Settings" description="Brand your customer-facing pages, configure operations, and connect payment gateways." />
      <Tabs defaultValue="branding">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="branding"><Palette className="h-3.5 w-3.5 mr-1.5" /> Branding</TabsTrigger>
          <TabsTrigger value="business"><Building2 className="h-3.5 w-3.5 mr-1.5" /> Business</TabsTrigger>
          <TabsTrigger value="hours"><Clock className="h-3.5 w-3.5 mr-1.5" /> Hours</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="h-3.5 w-3.5 mr-1.5" /> Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="branding" className="mt-4"><BrandingPanel section="branding" /></TabsContent>
        <TabsContent value="business" className="mt-4"><BrandingPanel section="business" /></TabsContent>
        <TabsContent value="hours" className="mt-4"><BrandingPanel section="hours" /></TabsContent>
        <TabsContent value="payments" className="mt-4"><PaymentProvidersPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Branding / business / hours (shared form state) ---------- */

type Hours = Record<string, { active: boolean; open: string; close: string }>;

function BrandingPanel({ section }: { section: "branding" | "business" | "hours" }) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getTenantSettings);
  const saveFn = useServerFn(saveTenantBranding);
  const { data, isLoading } = useQuery({ queryKey: ["tenant-settings"], queryFn: () => fetchFn() });

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? "",
        slug: data.slug ?? "",
        brand_color: data.brand_color ?? "#C5283D",
        logo_url: data.logo_url ?? "",
        email: data.email ?? "",
        whatsapp_number: data.whatsapp_number ?? "",
        timezone: data.timezone ?? "Africa/Lagos",
        default_currency: data.default_currency ?? "NGN",
        buffer_minutes: data.buffer_minutes ?? 0,
        business_hours: (data.business_hours as Hours) ?? (DEFAULT_BUSINESS_HOURS as Hours),
      });
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { ...form, buffer_minutes: Number(form.buffer_minutes) } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["tenant-settings"] }); },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  if (isLoading || !form) {
    return <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  const set = (patch: any) => setForm({ ...form, ...patch });
  const bookingUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${form.slug}` : `/book/${form.slug}`;

  return (
    <div className="space-y-6">
      {section === "branding" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brand identity</CardTitle>
              <CardDescription>Shown on your booking page, customer portal, waitlist, and emails.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Business name</Label>
                  <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Booking page URL</Label>
                  <div className="mt-1 flex">
                    <span className="inline-flex items-center px-2 rounded-l-md border border-r-0 bg-muted text-xs text-muted-foreground">/book/</span>
                    <Input
                      value={form.slug}
                      onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                      className="rounded-l-none"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <button type="button" onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success("Copied"); }} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Copy className="h-3 w-3" /> {bookingUrl}
                    </button>
                    <a href={bookingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><ExternalLink className="h-3 w-3" /> Open</a>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Brand color</Label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="color"
                      value={form.brand_color}
                      onChange={(e) => set({ brand_color: e.target.value })}
                      className="h-10 w-14 rounded-md border bg-background cursor-pointer"
                    />
                    <Input
                      value={form.brand_color}
                      onChange={(e) => set({ brand_color: e.target.value })}
                      className="font-mono uppercase"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Logo</Label>
                  <LogoUploader value={form.logo_url} onChange={(url) => set({ logo_url: url })} />
                  <div className="mt-2">
                    <Input
                      value={form.logo_url}
                      onChange={(e) => set({ logo_url: e.target.value })}
                      placeholder="https://your-website.com/logo.png"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <strong>Upload</strong> a square PNG/JPG/SVG (max 2&nbsp;MB) — it becomes your booking page logo and favicon.
                      Or paste an <strong>image link</strong>: upload the image to your website / Google Drive (set sharing to "Anyone with the link") / Imgur, then right-click → "Copy image address" and paste the URL here.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div className="mt-2 rounded-xl overflow-hidden border">
                <div className="p-4" style={{ background: form.brand_color }}>
                  <div className="flex items-center gap-3">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="" className="h-10 w-10 rounded-md bg-white p-1 object-contain" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-white/20 grid place-items-center text-white font-semibold">{(form.name || "?").slice(0, 1).toUpperCase()}</div>
                    )}
                    <div className="text-white">
                      <div className="text-[11px] uppercase tracking-wider opacity-80">Booking page</div>
                      <div className="font-semibold">{form.name || "Your business"}</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-background flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Customers will see this header on every public page.</div>
                  <button type="button" className="rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: form.brand_color }}>Book now</button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {section === "business" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business details</CardTitle>
            <CardDescription>Contact info and operational defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Contact email (reply-to on automated emails)</Label>
                <Input value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="hello@yourbiz.com" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">WhatsApp number</Label>
                <Input value={form.whatsapp_number} onChange={(e) => set({ whatsapp_number: e.target.value })} placeholder="+234…" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => set({ timezone: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Default currency</Label>
                <Select value={form.default_currency} onValueChange={(v) => set({ default_currency: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c.currency} value={c.currency}>{c.currency} — {c.symbol} {c.name}</SelectItem>)}
                    <SelectItem value="USD">USD — $ United States</SelectItem>
                    <SelectItem value="EUR">EUR — € Eurozone</SelectItem>
                    <SelectItem value="GBP">GBP — £ United Kingdom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Buffer between bookings (minutes)</Label>
                <Input type="number" min={0} max={240} value={form.buffer_minutes} onChange={(e) => set({ buffer_minutes: e.target.value })} className="mt-1" />
                <p className="text-[11px] text-muted-foreground mt-1">Padding automatically added after each appointment.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {section === "hours" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business hours</CardTitle>
            <CardDescription>Used to compute available booking slots on your public page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {DAYS.map((day) => {
              const d = form.business_hours?.[day.key] ?? { active: false, open: "09:00", close: "17:00" };
              const update = (patch: any) => set({ business_hours: { ...form.business_hours, [day.key]: { ...d, ...patch } } });
              return (
                <div key={day.key} className="grid grid-cols-[110px_90px_1fr_1fr] items-center gap-3 py-1.5 border-b last:border-0">
                  <span className="text-sm">{day.label}</span>
                  <div className="flex items-center gap-2"><Switch checked={d.active} onCheckedChange={(v) => update({ active: v })} /><span className="text-[11px] text-muted-foreground">{d.active ? "Open" : "Closed"}</span></div>
                  <Input type="time" value={d.open} onChange={(e) => update({ open: e.target.value })} disabled={!d.active} />
                  <Input type="time" value={d.close} onChange={(e) => update({ close: e.target.value })} disabled={!d.active} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} size="lg">
          {saveMut.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Payment providers (unchanged behavior) ---------- */

type ProviderKey = "payfast" | "yoco" | "ozow" | "paystack" | "stripe";

const PROVIDERS: { key: ProviderKey; name: string; country: string; fields: { id: string; label: string; secret?: boolean; placeholder?: string }[] }[] = [
  { key: "payfast", name: "PayFast", country: "South Africa", fields: [
    { id: "merchant_id", label: "Merchant ID", placeholder: "10000100" },
    { id: "merchant_key", label: "Merchant Key", secret: true },
    { id: "passphrase", label: "Passphrase", secret: true },
  ]},
  { key: "yoco", name: "Yoco", country: "South Africa", fields: [
    { id: "public_key", label: "Public Key", placeholder: "pk_test_…" },
    { id: "secret_key", label: "Secret Key", secret: true, placeholder: "sk_test_…" },
  ]},
  { key: "ozow", name: "Ozow", country: "South Africa", fields: [
    { id: "site_code", label: "Site Code" },
    { id: "private_key", label: "Private Key", secret: true },
    { id: "api_key", label: "API Key", secret: true },
  ]},
  { key: "paystack", name: "Paystack", country: "Nigeria · Ghana · Kenya", fields: [
    { id: "public_key", label: "Public Key", placeholder: "pk_live_…" },
    { id: "secret_key", label: "Secret Key", secret: true, placeholder: "sk_live_…" },
  ]},
  { key: "stripe", name: "Stripe", country: "Global", fields: [
    { id: "public_key", label: "Publishable Key", placeholder: "pk_live_…" },
    { id: "secret_key", label: "Secret Key", secret: true, placeholder: "sk_live_…" },
  ]},
];

function PaymentProvidersPanel() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getPaymentProviders);
  const saveFn = useServerFn(savePaymentProviders);
  const { data, isLoading } = useQuery({ queryKey: ["payment-providers"], queryFn: () => fetchFn() });

  const [state, setState] = useState<Record<string, any>>({});
  useEffect(() => { if (data) setState(data); }, [data]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: state as any }),
    onSuccess: () => { toast.success("Payment providers saved"); qc.invalidateQueries({ queryKey: ["payment-providers"] }); },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  if (isLoading) return <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
        <Lock className="h-4 w-4 shrink-0 mt-0.5" />
        <div>Secret keys are stored in your workspace. Only owners and admins can view this page.</div>
      </div>

      {PROVIDERS.map((p) => {
        const cfg = state[p.key] ?? {};
        const enabled = !!cfg.enabled;
        const update = (patch: any) => setState({ ...state, [p.key]: { ...cfg, ...patch } });
        return (
          <Card key={p.key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {p.name}
                    {enabled && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">Active</Badge>}
                    {enabled && cfg.test_mode && <Badge variant="outline" className="text-[10px]">Test mode</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{p.country}</p>
                </div>
                <Switch checked={enabled} onCheckedChange={(v) => update({ enabled: v })} />
              </div>
            </CardHeader>
            {enabled && (
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 pb-2">
                  <Switch checked={!!cfg.test_mode} onCheckedChange={(v) => update({ test_mode: v })} />
                  <Label className="text-xs">Test / sandbox mode</Label>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {p.fields.map((f) => (
                    <SecretField key={f.id} label={f.label} secret={f.secret} placeholder={f.placeholder} value={cfg[f.id] ?? ""} onChange={(v) => update({ [f.id]: v })} />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} size="lg">
          {saveMut.isPending ? "Saving…" : "Save providers"}
        </Button>
      </div>
    </div>
  );
}

function SecretField({ label, value, onChange, secret, placeholder }: { label: string; value: string; onChange: (v: string) => void; secret?: boolean; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 relative">
        <Input
          type={secret && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={secret ? "pr-9 font-mono text-xs" : ""}
          autoComplete="off"
        />
        {secret && (
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function LogoUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const uploadFn = useServerFn(uploadTenantLogo);
  const [busy, setBusy] = useState(false);
  const inputId = "logo-upload-input";

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2 MB or smaller");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      // Convert to base64 in chunks to avoid call-stack overflow on large files.
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const res = await uploadFn({
        data: { filename: file.name, content_type: file.type || "image/png", data_base64: base64 },
      });
      onChange(res.logo_url);
      toast.success("Logo uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 flex items-center gap-3">
      <div className="h-16 w-16 rounded-md border bg-white grid place-items-center overflow-hidden shrink-0">
        {value ? (
          <img src={value} alt="Logo preview" className="h-full w-full object-contain p-1.5" />
        ) : (
          <span className="text-[10px] text-muted-foreground">No logo</span>
        )}
      </div>
      <div className="flex-1">
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => document.getElementById(inputId)?.click()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            {value ? "Replace logo" : "Upload logo"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>Remove</Button>
          )}
        </div>
      </div>
    </div>
  );
}
