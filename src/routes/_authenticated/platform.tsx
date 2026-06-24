import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Users, Calendar, DollarSign, TrendingDown, TrendingUp, AlertTriangle, Activity, Clock, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPlatformMetrics } from "@/lib/platform-admin.functions";
import { formatCurrency, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/platform")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: row } = await supabase.from("users").select("admin_access, role").eq("supabase_auth_id", u.user.id).maybeSingle();
    if (!row?.admin_access || !["owner", "admin"].includes(row.role)) throw redirect({ to: "/dashboard" });
  },
  component: PlatformDashboard,
});

function PlatformDashboard() {
  const fetchMetrics = useServerFn(getPlatformMetrics);
  const { data: m, isLoading } = useQuery({ queryKey: ["platform-metrics"], queryFn: () => fetchMetrics(), refetchInterval: 60000 });

  if (isLoading || !m) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const revenue = Object.entries(m.platform_revenue ?? {}) as [string, number][];
  const revenue30 = Object.entries(m.platform_revenue_30d ?? {}) as [string, number][];
  const failedAmt = Object.entries(m.failed_payments_amount_7d ?? {}) as [string, number][];
  const systemOk = (m.automation_failed_24h ?? 0) < 5;

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 mb-2"><Shield className="h-3 w-3 mr-1" /> Super admin</Badge>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Platform dashboard</h1>
          <p className="text-sm text-muted-foreground">Health, growth and revenue across all HolaWeb workspaces.</p>
        </div>
        <Link to="/admin" className="text-sm text-primary hover:underline">Manage companies →</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="MRR (USD)" value={`$${(m.mrr ?? 0).toLocaleString()}`} icon={DollarSign} hint="From active subscriptions" />
        <Kpi label="Companies" value={`${m.companies_active ?? 0} / ${m.companies_total ?? 0}`} icon={Building2} hint={`${m.companies_trial ?? 0} on trial`} />
        <Kpi label="Churn (30d)" value={`${m.churn_30d_pct ?? 0}%`} icon={TrendingDown} hint={`${m.companies_cancelled_30d ?? 0} cancellations`} />
        <Kpi label="Active users (30d)" value={(m.users_active_30d ?? 0).toLocaleString()} icon={Users} hint={`${m.users_total ?? 0} total`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Bookings (30d)" value={(m.bookings_30d ?? 0).toLocaleString()} icon={Calendar} hint={`${(m.bookings_total ?? 0).toLocaleString()} all-time`} />
        <Kpi label="Revenue (30d)" value={revenue30.length === 0 ? "—" : revenue30.map(([c, v]) => formatCurrency(v, c)).join(" · ")} icon={TrendingUp} hint="Confirmed payments" />
        <Kpi label="Failed payments (7d)" value={(m.failed_payments_7d ?? 0).toLocaleString()} icon={AlertTriangle} hint={failedAmt.length ? failedAmt.map(([c, v]) => formatCurrency(v, c)).join(" · ") : "No losses"} />
        <Kpi label="Waitlist active" value={(m.waitlist_active ?? 0).toLocaleString()} icon={Clock} hint="Across all tenants" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> System health</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Row label="Automations pending" value={(m.automation_pending ?? 0).toLocaleString()} />
            <Row label="Automations failed (24h)" value={(m.automation_failed_24h ?? 0).toLocaleString()} tone={systemOk ? "ok" : "warn"} />
            <Row label="Status" value={systemOk ? "Operational" : "Degraded"} tone={systemOk ? "ok" : "warn"} />
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-base">Plan breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(m.plan_breakdown ?? {}).length === 0 && <p className="text-sm text-muted-foreground">No plans yet.</p>}
            {Object.entries(m.plan_breakdown ?? {}).map(([plan, count]) => (
              <Row key={plan} label={<span className="capitalize">{plan}</span>} value={String(count)} />
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-base">Total platform revenue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {revenue.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            {revenue.map(([c, v]) => <Row key={c} label={c} value={formatCurrency(v, c)} />)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent signups</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(m.recent_signups ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between px-6 py-3 text-sm">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.country ?? "—"} · <span className="capitalize">{t.plan_tier}</span></div>
                </div>
                <div className="text-xs text-muted-foreground">{relativeTime(t.created_at)}</div>
              </div>
            ))}
            {(m.recent_signups ?? []).length === 0 && <div className="px-6 py-8 text-center text-sm text-muted-foreground">No signups yet.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-xl font-display font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, tone }: { label: React.ReactNode; value: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "warn" ? "font-medium text-amber-600" : tone === "ok" ? "font-medium text-green-600" : "font-medium"}>{value}</span>
    </div>
  );
}
