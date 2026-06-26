import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, MessageSquare, Calendar, CheckCircle2, DollarSign, FileText } from "lucide-react";
import { formatCurrency, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Range = "today" | "week" | "month";

function rangeStart(r: Range): Date {
  const now = new Date();
  if (r === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (r === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function DashboardPage() {
  const { data: me } = useCurrentUser();
  const [range, setRange] = useState<Range>("month");
  const tenantId = me?.user.tenant_id;

  const kpis = useQuery({
    queryKey: ["dashboard-kpis", tenantId, range],
    enabled: !!tenantId,
    queryFn: async () => {
      const since = rangeStart(range).toISOString();
      const [customers, convs, bookingsAll, bookingsConfirmed, pays, unpaid] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "CONFIRMED")
          .gte("starts_at", since),
        supabase
          .from("payments")
          .select("amount_cents,currency,status,paid_at")
          .eq("status", "CONFIRMED")
          .gte("paid_at", since),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .in("status", ["unpaid", "overdue"]),
      ]);
      const revenue = (pays.data ?? []).reduce<Record<string, number>>((acc, p) => {
        acc[p.currency] = (acc[p.currency] ?? 0) + (p.amount_cents ?? 0);
        return acc;
      }, {});
      return {
        customers: customers.count ?? 0,
        openConversations: convs.count ?? 0,
        totalBookings: bookingsAll.count ?? 0,
        confirmedBookings: bookingsConfirmed.count ?? 0,
        revenue,
        unpaidInvoices: unpaid.count ?? 0,
      };
    },
  });

  const recentBookings = useQuery({
    queryKey: ["recent-bookings", tenantId, range],
    enabled: !!tenantId,
    queryFn: async () => {
      const since = rangeStart(range).toISOString();
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, ref_code, status, starts_at, amount_cents, currency, customers(display_name), services(name)",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const recentPayments = useQuery({
    queryKey: ["recent-payments", tenantId, range],
    enabled: !!tenantId,
    queryFn: async () => {
      const since = rangeStart(range).toISOString();
      const { data, error } = await supabase
        .from("payments")
        .select("id, gateway, gateway_ref, amount_cents, currency, status, paid_at, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Hello {me?.user.full_name?.split(" ")[0] ?? "there"} — here's what's happening at{" "}
            {me?.tenant.name}.
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This week</TabsTrigger>
            <TabsTrigger value="month">This month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Customers" value={kpis.data?.customers ?? "—"} icon={Users} />
        <KpiCard
          label="Active chats"
          value={kpis.data?.openConversations ?? "—"}
          icon={MessageSquare}
        />
        <KpiCard label="Total bookings" value={kpis.data?.totalBookings ?? "—"} icon={Calendar} />
        <KpiCard
          label="Confirmed"
          value={kpis.data?.confirmedBookings ?? "—"}
          icon={CheckCircle2}
        />
        <KpiCard
          label="Revenue"
          value={
            kpis.data
              ? Object.entries(kpis.data.revenue)
                  .map(([cur, amt]) => formatCurrency(amt as number, cur))
                  .join(" + ") || formatCurrency(0, me?.tenant.default_currency ?? "USD")
              : "—"
          }
          icon={DollarSign}
        />
        <KpiCard label="Unpaid invoices" value={kpis.data?.unpaidInvoices ?? "—"} icon={FileText} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent bookings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentBookings.data ?? []).map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.ref_code}</TableCell>
                    <TableCell>{b.customers?.display_name ?? "—"}</TableCell>
                    <TableCell>{b.services?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{relativeTime(b.starts_at)}</TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(b.amount_cents, b.currency)}
                    </TableCell>
                  </TableRow>
                ))}
                {recentBookings.data?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No bookings yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentPayments.data ?? []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.gateway_ref ?? "—"}</TableCell>
                    <TableCell className="text-xs">{p.gateway ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.amount_cents, p.currency)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.paid_at ? relativeTime(p.paid_at) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {recentPayments.data?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No payments yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: "bg-success-soft text-success",
    PENDING_PAYMENT: "bg-amber-soft text-amber-strong",
    PENDING: "bg-amber-soft text-amber-strong",
    CANCELLED: "bg-neutral-soft text-neutral",
    EXPIRED: "bg-danger-soft text-danger",
    COMPLETED: "bg-success-soft text-success",
    NO_SHOW: "bg-orange-soft text-orange-strong",
    FAILED: "bg-danger-soft text-danger",
    REFUNDED: "bg-info-soft text-info",
    unpaid: "bg-amber-soft text-amber-strong",
    paid: "bg-success-soft text-success",
    overdue: "bg-danger-soft text-danger",
    cancelled: "bg-neutral-soft text-neutral",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground";
  return (
    <Badge className={`${cls} border-0 font-medium text-[11px] uppercase tracking-wide`}>
      {status.replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}
