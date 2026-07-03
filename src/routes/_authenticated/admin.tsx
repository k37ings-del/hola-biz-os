import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shell/ConfirmDialog";
import { Loader2, Shield, Building2, Users, Calendar, DollarSign, Trash2 } from "lucide-react";
import { formatCurrency, relativeTime } from "@/lib/format";
import { listAllTenants, updateTenantStatus, deleteTenant } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: row } = await supabase
      .from("users").select("admin_access, role").eq("supabase_auth_id", u.user.id).maybeSingle();
    if (!row?.admin_access || !["owner", "admin"].includes(row.role)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPage,
});

const PLAN_TIERS = ["starter", "growth", "pro", "enterprise"] as const;
const STATUSES = ["active", "trial", "suspended", "cancelled"] as const;

function AdminPage() {
  const qc = useQueryClient();
  const fetchTenants = useServerFn(listAllTenants);
  const mutateTenant = useServerFn(updateTenantStatus);
  const removeTenant = useServerFn(deleteTenant);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { data, isLoading, error } = useQuery({
    queryKey: ["all-tenants"],
    queryFn: () => fetchTenants(),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { tenantId: string; plan_tier?: typeof PLAN_TIERS[number]; subscription_status?: typeof STATUSES[number] }) =>
      mutateTenant({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-tenants"] });
      toast.success("Tenant updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (tenantId: string) => removeTenant({ data: { tenantId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-tenants"] }); toast.success("Company deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <div className="text-sm text-danger">Failed to load: {(error as Error)?.message ?? "unknown"}</div>;
  }

  const real = data.tenants.filter((t) => !t.is_demo && !t.is_admin_workspace);
  const totalCustomers = real.reduce((a, t) => a + t.customers_count, 0);
  const totalBookings = real.reduce((a, t) => a + t.bookings_count, 0);
  const totalRevenue: Record<string, number> = {};
  real.forEach((t) => Object.entries(t.revenue).forEach(([c, v]) => { totalRevenue[c] = (totalRevenue[c] ?? 0) + (v as number); }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0"><Shield className="h-3 w-3 mr-1" /> Super admin</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform control</h1>
        <p className="text-sm text-muted-foreground">Monitor every client workspace and manage their subscription state.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Active tenants" value={real.length} icon={Building2} />
        <Kpi label="Total customers" value={totalCustomers} icon={Users} />
        <Kpi label="Total bookings" value={totalBookings} icon={Calendar} />
        <Kpi label="Total revenue" value={Object.entries(totalRevenue).map(([c, v]) => formatCurrency(v, c)).join(" + ") || "—"} icon={DollarSign} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All workspaces</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {t.name}
                      {t.is_demo && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
                      {t.is_admin_workspace && <Badge variant="outline" className="text-[10px]">HQ</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.email ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs">{t.industry ?? "—"}</TableCell>
                  <TableCell className="text-xs">{t.country}</TableCell>
                  <TableCell className="text-right text-xs">{t.users_count}</TableCell>
                  <TableCell className="text-right text-xs">{t.customers_count}</TableCell>
                  <TableCell className="text-right text-xs">{t.bookings_count}</TableCell>
                  <TableCell className="text-right text-xs">{Object.entries(t.revenue).map(([c, v]) => formatCurrency(v as number, c)).join(" + ") || "—"}</TableCell>
                  <TableCell>
                    <Select value={t.plan_tier} onValueChange={(v) => updateMut.mutate({ tenantId: t.id, plan_tier: v as any })}>
                      <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{PLAN_TIERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={t.subscription_status} onValueChange={(v) => updateMut.mutate({ tenantId: t.id, subscription_status: v as any })}>
                      <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs">{relativeTime(t.created_at)}</TableCell>
                  <TableCell>
                    {!t.is_admin_workspace && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete company"
                        onClick={() => setConfirmDelete({ id: t.id, name: t.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.tenants.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">No tenants yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name ?? "company"}?`}
        description="Every booking, customer and payment record for this company will be removed. You'll have 6 seconds to undo."
        confirmLabel="Delete company"
        destructive
        onConfirm={() => {
          const target = confirmDelete;
          if (!target) return;
          setConfirmDelete(null);
          const timer = setTimeout(() => {
            pendingDeletes.current.delete(target.id);
            deleteMut.mutate(target.id);
          }, 6000);
          pendingDeletes.current.set(target.id, timer);
          toast(`${target.name} will be deleted`, {
            duration: 6000,
            action: {
              label: "Undo",
              onClick: () => {
                const t = pendingDeletes.current.get(target.id);
                if (t) clearTimeout(t);
                pendingDeletes.current.delete(target.id);
                toast.success("Deletion cancelled");
              },
            },
          });
        }}
      />
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

// Suppress unused import warnings (Button is reserved for future actions like impersonation)
void Button;
