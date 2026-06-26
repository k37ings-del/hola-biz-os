import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Briefcase, Plus, Loader2, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard, StatCardGrid } from "@/components/shell/StatCard";
import { SlideOver } from "@/components/shell/SlideOver";
import { EmptyState } from "@/components/shell/EmptyState";
import { SkeletonTable } from "@/components/shell/SkeletonTable";
import { ConfirmDialog } from "@/components/shell/ConfirmDialog";
import { formatCurrency, useTenantCurrency } from "@/lib/format";
import { listServices, upsertService, deleteService } from "@/lib/services.functions";

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({ meta: [{ title: "Services · Holaweb Business OS" }] }),
  component: ServicesPage,
});

type FormState = {
  id?: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  active: boolean;
};

function ServicesPage() {
  const tenantCurrency = useTenantCurrency();
  const qc = useQueryClient();
  const fetchList = useServerFn(listServices);
  const saveSvc = useServerFn(upsertService);
  const removeSvc = useServerFn(deleteService);

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["services-list"], queryFn: () => fetchList() });

  const openCreate = () => {
    setForm({
      name: "",
      duration_minutes: 60,
      price_cents: 0,
      currency: tenantCurrency,
      active: true,
    });
    setEditorOpen(true);
  };
  const openEdit = (s: any) => {
    setForm({
      id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      price_cents: s.price_cents,
      currency: s.currency,
      active: s.active,
    });
    setEditorOpen(true);
  };

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("No form");
      return saveSvc({ data: { ...form, name: form.name.trim() } });
    },
    onSuccess: () => {
      setEditorOpen(false);
      qc.invalidateQueries({ queryKey: ["services-list"] });
      toast.success("Service saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeSvc({ data: { id } }),
    onSuccess: () => {
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["services-list"] });
      toast.success("Service deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const services = q.data?.services ?? [];
  const activeCount = services.filter((s: any) => s.active).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Services"
        description="The catalogue customers can book through WhatsApp."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New service
          </Button>
        }
      />

      <StatCardGrid>
        <StatCard label="Total services" value={services.length} icon={Briefcase} />
        <StatCard label="Active" value={activeCount} icon={Briefcase} />
        <StatCard label="Inactive" value={services.length - activeCount} icon={Briefcase} />
        <StatCard
          label="Avg price"
          value={
            services.length
              ? formatCurrency(
                  Math.round(
                    services.reduce((s: number, x: any) => s + x.price_cents, 0) / services.length,
                  ),
                  services[0]?.currency ?? tenantCurrency,
                )
              : "—"
          }
          icon={Briefcase}
        />
      </StatCardGrid>

      <div className="border rounded-lg overflow-hidden bg-card">
        {q.isLoading ? (
          <SkeletonTable rows={5} />
        ) : services.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No services yet"
            description="Add your first service so customers can book through WhatsApp."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                New service
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s: any) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-accent/30"
                  onClick={() => openEdit(s)}
                >
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.duration_minutes} min</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(s.price_cents, s.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={s.active ? "default" : "secondary"}
                      className="text-[10px] uppercase"
                    >
                      {s.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <SlideOver
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={form?.id ? "Edit service" : "New service"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form?.name.trim()}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Box Braids"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={5}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <div>
              <Label>Price</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={(form.price_cents / 100).toString()}
                onChange={(e) =>
                  setForm({ ...form, price_cents: Math.round(Number(e.target.value) * 100) })
                }
              />
            </div>
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Customers can book this service</p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete service?"
        description="This cannot be undone. Existing bookings will keep their reference."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (confirmDelete) remove.mutate(confirmDelete);
        }}
      />
    </div>
  );
}
