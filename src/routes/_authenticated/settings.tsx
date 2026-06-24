import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, CreditCard, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shell/PageHeader";
import { getPaymentProviders, savePaymentProviders } from "@/lib/payment-providers.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · HolaWeb" }] }),
  component: SettingsPage,
});

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

function SettingsPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <PageHeader title="Settings" description="Configure your workspace and integrations." />
      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments"><CreditCard className="h-3.5 w-3.5 mr-1.5" /> Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="mt-4">
          <PaymentProvidersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentProvidersPanel() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getPaymentProviders);
  const saveFn = useServerFn(savePaymentProviders);
  const { data, isLoading } = useQuery({ queryKey: ["payment-providers"], queryFn: () => fetchFn() });

  const [state, setState] = useState<Record<string, any>>({});

  useEffect(() => {
    if (data) setState(data);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: state as any }),
    onSuccess: () => {
      toast.success("Payment providers saved");
      qc.invalidateQueries({ queryKey: ["payment-providers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  if (isLoading) return <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
        <Lock className="h-4 w-4 shrink-0 mt-0.5" />
        <div>Secret keys are stored encrypted in your workspace. Only owners and admins can view this page.</div>
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
                    <SecretField
                      key={f.id}
                      label={f.label}
                      secret={f.secret}
                      placeholder={f.placeholder}
                      value={cfg[f.id] ?? ""}
                      onChange={(v) => update({ [f.id]: v })}
                    />
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
