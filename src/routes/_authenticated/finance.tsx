import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, Receipt, RotateCcw, Wallet } from "lucide-react";
import { getFinanceOverview } from "@/lib/finance.functions";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard, StatCardGrid } from "@/components/shell/StatCard";

export const Route = createFileRoute("/_authenticated/finance")({
  component: FinancePage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6">
        <p className="text-destructive">Finance failed to load: {error.message}</p>
        <Button className="mt-3" onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function money(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
}

function FinancePage() {
  const fetch = useServerFn(getFinanceOverview);
  const { data, isLoading } = useQuery({ queryKey: ["finance-overview"], queryFn: () => fetch() });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const d = data!;
  const currency = d.invoices[0]?.currency ?? d.payments[0]?.currency ?? "ZAR";

  return (
    <div className="space-y-4">
      <PageHeader title="Finance" subtitle="Invoices, payments, refunds and payouts in one place" />

      <StatCardGrid>
        <StatCard label="Revenue" value={money(d.stats.revenue, currency)} icon={DollarSign} />
        <StatCard label="Outstanding" value={money(d.stats.outstanding, currency)} icon={Receipt} />
        <StatCard label="Refunded" value={money(d.stats.refunded, currency)} icon={RotateCcw} />
        <StatCard label="Paid out" value={money(d.stats.payouts, currency)} icon={Wallet} />
      </StatCardGrid>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices ({d.invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({d.payments.length})</TabsTrigger>
          <TabsTrigger value="refunds">Refunds ({d.refunds.length})</TabsTrigger>
          <TabsTrigger value="payouts">Payouts ({d.payouts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <FinanceTable
            rows={d.invoices}
            columns={[
              { key: "number", label: "Number" },
              { key: "status", label: "Status", render: (v: string) => <Badge variant="outline">{v}</Badge> },
              { key: "amount_cents", label: "Amount", render: (v: number, r: any) => money(v, r.currency) },
              { key: "due_at", label: "Due", render: (v: string) => v ? new Date(v).toLocaleDateString() : "—" },
            ]}
          />
        </TabsContent>
        <TabsContent value="payments">
          <FinanceTable
            rows={d.payments}
            columns={[
              { key: "provider", label: "Provider" },
              { key: "status", label: "Status", render: (v: string) => <Badge variant="outline">{v}</Badge> },
              { key: "amount_cents", label: "Amount", render: (v: number, r: any) => money(v, r.currency) },
              { key: "created_at", label: "Date", render: (v: string) => new Date(v).toLocaleDateString() },
            ]}
          />
        </TabsContent>
        <TabsContent value="refunds">
          <FinanceTable
            rows={d.refunds}
            columns={[
              { key: "reason", label: "Reason", render: (v: string) => v ?? "—" },
              { key: "status", label: "Status", render: (v: string) => <Badge variant="outline">{v}</Badge> },
              { key: "amount_cents", label: "Amount", render: (v: number, r: any) => money(v, r.currency) },
              { key: "created_at", label: "Date", render: (v: string) => new Date(v).toLocaleDateString() },
            ]}
          />
        </TabsContent>
        <TabsContent value="payouts">
          <FinanceTable
            rows={d.payouts}
            columns={[
              { key: "provider", label: "Provider" },
              { key: "destination", label: "Destination", render: (v: string) => v ?? "—" },
              { key: "status", label: "Status", render: (v: string) => <Badge variant="outline">{v}</Badge> },
              { key: "amount_cents", label: "Amount", render: (v: number, r: any) => money(v, r.currency) },
              { key: "paid_at", label: "Paid", render: (v: string) => v ? new Date(v).toLocaleDateString() : "—" },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FinanceTable({ rows, columns }: { rows: any[]; columns: { key: string; label: string; render?: (v: any, r: any) => any }[] }) {
  return (
    <Card>
      <CardContent className="p-0 overflow-auto">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nothing here yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {columns.map((c) => <th key={c.key} className="text-left px-4 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  {columns.map((c) => <td key={c.key} className="px-4 py-2">{c.render ? c.render(r[c.key], r) : r[c.key] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
