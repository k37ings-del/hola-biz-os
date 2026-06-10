import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye, Users, Calendar, DollarSign, Scissors, UserCog, FileText } from "lucide-react";
import { formatCurrency, relativeTime } from "@/lib/format";
import { getDemoSnapshot } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "./dashboard";

export const Route = createFileRoute("/_authenticated/demo")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: row } = await supabase
      .from("users")
      .select("admin_access, role")
      .eq("supabase_auth_id", u.user.id)
      .maybeSingle();
    if (!row?.admin_access || !["owner", "admin"].includes(row.role)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: DemoPage,
});

function DemoPage() {
  const fetchSnap = useServerFn(getDemoSnapshot);
  const { data, isLoading, error } = useQuery({
    queryKey: ["demo-snapshot"],
    queryFn: () => fetchSnap(),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <div className="text-sm text-danger">Failed to load demo data: {(error as Error)?.message ?? "unknown"}</div>;
  }

  const customerById = new Map(data.customers.map((c: any) => [c.id, c]));
  const serviceById = new Map(data.services.map((s: any) => [s.id, s]));
  const revenueLabel = Object.entries(data.revenue).map(([cur, amt]) => formatCurrency(amt as number, cur)).join(" + ") || "—";

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="bg-amber-soft text-amber-strong border-0"><Eye className="h-3 w-3 mr-1" /> Read-only demo</Badge>
            <Badge variant="outline">{data.tenant.plan_tier}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.tenant.name}</h1>
          <p className="text-sm text-muted-foreground">Demo workspace seeded for sales walkthroughs. Browse anything — nothing can be edited.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Customers" value={data.customers.length} icon={Users} />
        <Kpi label="Bookings" value={data.bookings.length} icon={Calendar} />
        <Kpi label="Services" value={data.services.length} icon={Scissors} />
        <Kpi label="Staff" value={data.staff.length} icon={UserCog} />
        <Kpi label="Revenue" value={revenueLabel} icon={DollarSign} />
        <Kpi label="Invoices" value={data.invoices.length} icon={FileText} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Bookings</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Customer</TableHead><TableHead>Service</TableHead><TableHead>When</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.bookings.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.ref_code}</TableCell>
                    <TableCell>{(customerById.get(b.customer_id) as any)?.display_name ?? "—"}</TableCell>
                    <TableCell>{(serviceById.get(b.service_id) as any)?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{relativeTime(b.starts_at)}</TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                    <TableCell className="text-right">{formatCurrency(b.amount_cents, b.currency)}</TableCell>
                  </TableRow>
                ))}
                {data.bookings.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No bookings</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Services</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Duration</TableHead><TableHead className="text-right">Price</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.services.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-xs">{s.duration_minutes} min</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.price_cents, s.currency)}</TableCell>
                    <TableCell>{s.active ? <Badge className="bg-success-soft text-success border-0">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Customers</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.customers.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.display_name}</TableCell>
                    <TableCell className="text-xs">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-xs">{relativeTime(c.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Staff</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.staff.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.full_name}</TableCell>
                    <TableCell className="text-xs capitalize">{s.role}</TableCell>
                    <TableCell>{s.active ? <Badge className="bg-success-soft text-success border-0">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
