import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, Plus, Loader2, Save, Link as LinkIcon, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard, StatCardGrid } from "@/components/shell/StatCard";
import { SlideOver } from "@/components/shell/SlideOver";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { EmptyState } from "@/components/shell/EmptyState";
import { SkeletonTable } from "@/components/shell/SkeletonTable";
import { ConfirmDialog } from "@/components/shell/ConfirmDialog";
import { formatCurrency, formatDateTime, useTenantCurrency } from "@/lib/format";
import { listBookings, upsertBooking, setBookingStatus, bookingFormOptions } from "@/lib/bookings.functions";
import { deleteBookingOwn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({ meta: [{ title: "Bookings · Holaweb Business OS" }] }),
  component: BookingsPage,
});

const STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"] as const;

type FormState = {
  id?: string;
  customer_id: string;
  service_id: string;
  staff_id: string;
  starts_at: string;
  duration_minutes: number;
  amount_cents: number;
  currency: string;
  status: typeof STATUSES[number];
  notes: string;
};

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function BookingsPage() {
  const currency = useTenantCurrency();
  const { data: me } = useCurrentUser();
  const canDelete = ["owner", "admin"].includes((me?.user as any)?.role ?? "");
  const qc = useQueryClient();
  const fetchList = useServerFn(listBookings);
  const saveBooking = useServerFn(upsertBooking);
  const updateStatus = useServerFn(setBookingStatus);
  const fetchOptions = useServerFn(bookingFormOptions);
  const deleteBooking = useServerFn(deleteBookingOwn);

  const [filter, setFilter] = useState<string>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const q = useQuery({ queryKey: ["bookings-list"], queryFn: () => fetchList() });
  const optionsQ = useQuery({ queryKey: ["bookings-options"], queryFn: () => fetchOptions(), enabled: editorOpen });

  const filtered = useMemo(() => {
    const list = q.data?.bookings ?? [];
    if (filter === "all") return list;
    return list.filter((b: any) => b.status === filter);
  }, [q.data, filter]);

  const openCreate = () => {
    setForm({
      customer_id: "", service_id: "", staff_id: "",
      starts_at: toLocalInput(), duration_minutes: 60,
      amount_cents: 0, currency, status: "PENDING_PAYMENT", notes: "",
    });
    setEditorOpen(true);
  };

  const openEdit = (b: any) => {
    setForm({
      id: b.id,
      customer_id: b.customer?.id ?? "",
      service_id: b.service?.id ?? "",
      staff_id: b.staff?.id ?? "",
      starts_at: toLocalInput(b.starts_at),
      duration_minutes: Math.max(15, Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000)),
      amount_cents: b.amount_cents,
      currency: b.currency,
      status: b.status,
      notes: b.notes ?? "",
    });
    setEditorOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("No form");
      const starts = new Date(form.starts_at);
      const ends = new Date(starts.getTime() + form.duration_minutes * 60000);
      return saveBooking({
        data: {
          id: form.id,
          customer_id: form.customer_id || null,
          service_id: form.service_id || null,
          staff_id: form.staff_id || null,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          amount_cents: Math.round(form.amount_cents),
          currency: form.currency,
          status: form.status,
          notes: form.notes || null,
        },
      });
    },
    onSuccess: () => {
      setEditorOpen(false);
      qc.invalidateQueries({ queryKey: ["bookings-list"] });
      toast.success("Booking saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const setStatusMut = useMutation({
    mutationFn: (vars: { id: string; status: typeof STATUSES[number] }) => updateStatus({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings-list"] });
      toast.success("Status updated");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBooking({ data: { bookingId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings-list"] });
      toast.success("Booking deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const stats = q.data?.stats ?? { upcoming: 0, today: 0, pending: 0, completed_week: 0 };

  // sync price/duration when service picked
  const onServiceChange = (id: string) => {
    const svc = optionsQ.data?.services.find((s: any) => s.id === id);
    setForm((f) => f ? {
      ...f,
      service_id: id,
      ...(svc ? { duration_minutes: svc.duration_minutes, amount_cents: svc.price_cents, currency: svc.currency } : {}),
    } : f);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Bookings"
        description="Manage appointments, payment status, and no-shows."
        actions={
          <div className="flex items-center gap-2">
            <PublicBookingLink />
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />New booking</Button>
          </div>
        }
      />

      <StatCardGrid>
        <StatCard label="Upcoming" value={stats.upcoming} icon={Calendar} />
        <StatCard label="Today" value={stats.today} icon={Calendar} />
        <StatCard label="Pending payment" value={stats.pending} icon={Calendar} />
        <StatCard label="Completed (7d)" value={stats.completed_week} icon={Calendar} />
      </StatCardGrid>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        {q.isLoading ? (
          <SkeletonTable rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No bookings yet"
            description="Create a booking manually or wait for one to come in via WhatsApp."
            action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />New booking</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b: any) => (
                <TableRow key={b.id} className="cursor-pointer hover:bg-accent/30" onClick={() => openEdit(b)}>
                  <TableCell className="font-mono text-xs">{b.ref_code}</TableCell>
                  <TableCell>{b.customer?.display_name ?? "—"}</TableCell>
                  <TableCell>{b.service?.name ?? "—"}</TableCell>
                  <TableCell>{b.staff?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(b.starts_at)}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="text-right">{formatCurrency(b.amount_cents, b.currency)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <Select value={b.status} onValueChange={(v) => setStatusMut.mutate({ id: b.id, status: v as any })}>
                        <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Delete booking"
                          onClick={() => {
                            if (window.confirm(`Permanently delete booking ${b.ref_code}? This cannot be undone.`)) {
                              deleteMut.mutate(b.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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
        title={form?.id ? "Edit booking" : "New booking"}
        description="Bookings sync to the customer's WhatsApp."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div>
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {(optionsQ.data?.customers ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service</Label>
              <Select value={form.service_id} onValueChange={onServiceChange}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {(optionsQ.data?.services ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Staff</Label>
              <Select value={form.staff_id} onValueChange={(v) => setForm({ ...form, staff_id: v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {(optionsQ.data?.staff ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" min={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <Label>Amount</Label>
                <Input type="number" min={0} step="0.01" value={(form.amount_cents / 100).toString()} onChange={(e) => setForm({ ...form, amount_cents: Math.round(Number(e.target.value) * 100) })} />
              </div>
              <div>
                <Label>Currency</Label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function PublicBookingLink() {
  const { data } = useCurrentUser();
  const slug = (data?.tenant as any)?.slug;
  if (!slug) return null;
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${slug}`;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => { navigator.clipboard.writeText(url); toast.success("Booking link copied"); }}
      title={url}
    >
      <LinkIcon className="h-4 w-4 mr-1" /> Copy booking link
    </Button>
  );
}
