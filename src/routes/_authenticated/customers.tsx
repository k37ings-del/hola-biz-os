import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Search, Plus, Ban, Download, MessageSquare, Loader2, Save, Upload, Trash2, CheckCircle2 } from "lucide-react";
import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard, StatCardGrid } from "@/components/shell/StatCard";
import { SlideOver } from "@/components/shell/SlideOver";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { EmptyState } from "@/components/shell/EmptyState";
import { SkeletonTable } from "@/components/shell/SkeletonTable";
import { ConfirmDialog } from "@/components/shell/ConfirmDialog";
import { InitialsAvatar } from "@/components/shell/Avatar";
import { formatCurrency, formatPhone, relativeTime, useTenantCurrency } from "@/lib/format";
import { listCustomers, getCustomer, upsertCustomer, setCustomerStatus, updateCustomerNotes, importCustomersCSV, deleteCustomers } from "@/lib/customers.functions";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers · Holaweb Business OS" }] }),
  component: CustomersPage,
});

type Customer = {
  id: string;
  display_name: string;
  wa_phone: string | null;
  email: string | null;
  status: string;
  booking_count: number;
  first_seen: string;
  last_seen_at: string | null;
  notes: string | null;
  total_spent_cents: number;
  last_booking_at: string | null;
};

function CustomersPage() {
  const currency = useTenantCurrency();
  const qc = useQueryClient();
  const fetchList = useServerFn(listCustomers);
  const setStatus = useServerFn(setCustomerStatus);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "bookings" | "spend">("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCustomer, setEditorCustomer] = useState<Partial<Customer> | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<null | "block" | "activate">(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => fetchList(),
  });

  const filtered = useMemo(() => {
    let rows = (data?.customers ?? []) as Customer[];
    if (statusFilter !== "all") rows = rows.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.display_name.toLowerCase().includes(q) ||
          (c.wa_phone ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "bookings") rows = [...rows].sort((a, b) => b.booking_count - a.booking_count);
    else if (sortBy === "spend") rows = [...rows].sort((a, b) => b.total_spent_cents - a.total_spent_cents);
    else rows = [...rows].sort((a, b) => new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime());
    return rows;
  }, [data, search, statusFilter, sortBy]);

  const bulkStatus = useMutation({
    mutationFn: (vars: { ids: string[]; status: "active" | "inactive" | "blocked" }) => setStatus({ data: vars }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(`${vars.ids.length} customer(s) ${vars.status === "blocked" ? "blocked" : "updated"}`);
      setSelected(new Set());
      setBulkConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const ids = selected.size ? new Set(selected) : new Set(filtered.map((c) => c.id));
    const rows = filtered.filter((c) => ids.has(c.id));
    const header = "Name,Phone,Email,Status,Bookings,Total spent,First seen,Last booking\n";
    const csv =
      header +
      rows
        .map((c) =>
          [
            JSON.stringify(c.display_name),
            JSON.stringify(formatPhone(c.wa_phone)),
            JSON.stringify(c.email ?? ""),
            c.status,
            c.booking_count,
            (c.total_spent_cents / 100).toFixed(2),
            new Date(c.first_seen).toISOString(),
            c.last_booking_at ? new Date(c.last_booking_at).toISOString() : "",
          ].join(",")
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} customer(s)`);
  };

  const toggleAll = (v: boolean) => setSelected(v ? new Set(filtered.map((c) => c.id)) : new Set());
  const toggleOne = (id: string, v: boolean) => {
    const next = new Set(selected);
    v ? next.add(id) : next.delete(id);
    setSelected(next);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Customers"
        description="Everyone who has ever messaged or booked through this business."
        actions={
          <div className="flex items-center gap-2">
            <CsvImportButton onDone={() => qc.invalidateQueries({ queryKey: ["customers-list"] })} />
            <Button onClick={() => { setEditorCustomer({ display_name: "", wa_phone: "", email: "", notes: "", status: "active" }); setEditorOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Add customer
            </Button>
          </div>
        }
      />

      <StatCardGrid>
        <StatCard label="Total customers" value={data?.stats.total ?? 0} icon={Users} />
        <StatCard label="Active this month" value={data?.stats.active_month ?? 0} />
        <StatCard label="Repeat (2+ bookings)" value={data?.stats.repeat ?? 0} />
        <StatCard label="New this week" value={data?.stats.new_week ?? 0} />
      </StatCardGrid>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email…" className="pl-8 h-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="bookings">Most bookings</SelectItem>
              <SelectItem value="spend">Highest spend</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="px-4 py-2 border-b bg-secondary/40 flex items-center gap-2 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1.5" /> Export</Button>
            <Button size="sm" variant="outline" className="text-danger" onClick={() => setBulkConfirm("block")}>
              <Ban className="h-3.5 w-3.5 mr-1.5" /> Block
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        <CardContent className="p-0">
          {isLoading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={data?.customers.length === 0 ? "No customers yet" : "No matches"}
              description={
                data?.customers.length === 0
                  ? "When someone books through your WhatsApp number, they'll appear here."
                  : "Try a different search or filter."
              }
              action={
                data?.customers.length === 0 ? (
                  <Button onClick={() => { setEditorCustomer({ display_name: "", wa_phone: "", email: "", notes: "", status: "active" }); setEditorOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1.5" /> Add customer
                  </Button>
                ) : null
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={(v) => toggleAll(!!v)}
                    />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Total spent</TableHead>
                  <TableHead>Last booking</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setActiveId(c.id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => toggleOne(c.id, !!v)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar name={c.display_name} seed={c.id} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{c.display_name}</div>
                          <div className="text-xs text-muted-foreground">{formatPhone(c.wa_phone)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{relativeTime(c.first_seen)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{c.booking_count ?? 0}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatCurrency(c.total_spent_cents, currency)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.last_booking_at ? relativeTime(c.last_booking_at) : "—"}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => setActiveId(c.id)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomerDetail
        id={activeId}
        open={!!activeId}
        onOpenChange={(v) => { if (!v) setActiveId(null); }}
        onEdit={(c) => { setActiveId(null); setEditorCustomer(c); setEditorOpen(true); }}
      />

      <CustomerEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorCustomer}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["customers"] }); }}
      />

      <ConfirmDialog
        open={bulkConfirm === "block"}
        onOpenChange={(v) => { if (!v) setBulkConfirm(null); }}
        title={`Block ${selected.size} customer(s)?`}
        description="Blocked customers will not be able to book or message your business via WhatsApp until you unblock them."
        confirmLabel="Block"
        destructive
        onConfirm={() => bulkStatus.mutate({ ids: Array.from(selected), status: "blocked" })}
      />
    </div>
  );
}

function CustomerDetail({
  id, open, onOpenChange, onEdit,
}: { id: string | null; open: boolean; onOpenChange: (v: boolean) => void; onEdit: (c: any) => void }) {
  const currency = useTenantCurrency();
  const fetchOne = useServerFn(getCustomer);
  const saveNotes = useServerFn(updateCustomerNotes);
  const setStatus = useServerFn(setCustomerStatus);
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    enabled: !!id && open,
    queryFn: () => fetchOne({ data: { id: id! } }),
  });

  useEffect(() => { if (data) setNotes(data.customer.notes ?? ""); }, [data]);

  const notesMut = useMutation({
    mutationFn: saveNotes,
    onSuccess: () => { setSavedAt(new Date()); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const blockMut = useMutation({
    mutationFn: setStatus,
    onSuccess: () => {
      toast.success("Customer blocked");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", id] });
      setConfirmBlock(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title={data?.customer.display_name ?? "Customer"}
      description={data?.customer.wa_phone ? formatPhone(data.customer.wa_phone) : undefined}
    >
      {isLoading || !data ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={data.customer.display_name} seed={data.customer.id} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-lg truncate">{data.customer.display_name}</div>
              <div className="text-xs text-muted-foreground">{formatPhone(data.customer.wa_phone)}</div>
              <div className="mt-1"><StatusBadge status={data.customer.status} /></div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(data.customer)}>Edit</Button>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="conv">Conversation</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Bookings" value={data.stats.total_bookings} />
                <StatCard label="Total spent" value={formatCurrency(data.stats.total_spent_cents, currency)} />
                <StatCard label="No-shows" value={data.stats.no_shows} />
                <StatCard label="Cancellations" value={data.stats.cancellations} />
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent bookings</div>
                {data.bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.bookings.slice(0, 3).map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between p-2 rounded-md border text-sm">
                        <div>
                          <div className="font-medium font-mono text-xs">{b.ref_code}</div>
                          <div className="text-xs text-muted-foreground">{new Date(b.starts_at).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs tabular-nums">{formatCurrency(b.amount_cents, b.currency || currency)}</span>
                          <StatusBadge status={b.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="conv" className="pt-4 space-y-2">
              {data.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                data.messages.map((m: any) => (
                  <div key={m.id} className={`max-w-[80%] p-2 rounded-lg text-sm ${m.direction === "outbound" ? "ml-auto bg-primary/10" : "bg-muted"}`}>
                    <div>{m.body}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{relativeTime(m.created_at)}</div>
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent value="notes" className="pt-4 space-y-2">
              <Textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this customer…" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{savedAt ? `Saved ${relativeTime(savedAt)}` : "Auto-saves on click"}</span>
                <Button size="sm" variant="outline" onClick={() => notesMut.mutate({ data: { id: data.customer.id, notes } })} disabled={notesMut.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Save notes
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {data.customer.status !== "blocked" && (
            <div className="pt-2 border-t">
              <Button variant="outline" className="w-full text-danger" onClick={() => setConfirmBlock(true)}>
                <Ban className="h-4 w-4 mr-1.5" /> Block customer
              </Button>
            </div>
          )}

          <ConfirmDialog
            open={confirmBlock}
            onOpenChange={setConfirmBlock}
            title="Block this customer?"
            description="They won't be able to book or message your business until unblocked."
            confirmLabel="Block"
            destructive
            onConfirm={() => blockMut.mutate({ data: { ids: [data.customer.id], status: "blocked" } })}
          />
        </div>
      )}
    </SlideOver>
  );
}

function CustomerEditor({
  open, onOpenChange, initial, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial: any; onSaved: () => void }) {
  const save = useServerFn(upsertCustomer);
  const [form, setForm] = useState<any>({ display_name: "", wa_phone: "", email: "", notes: "", status: "active" });

  useEffect(() => {
    if (open && initial) setForm({
      id: initial.id,
      display_name: initial.display_name ?? "",
      wa_phone: initial.wa_phone ?? "",
      email: initial.email ?? "",
      notes: initial.notes ?? "",
      status: initial.status ?? "active",
    });
  }, [open, initial]);

  const mut = useMutation({
    mutationFn: save,
    onSuccess: () => { toast.success(form.id ? "Customer updated" : "Customer added"); onSaved(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.display_name.trim()) { toast.error("Name is required"); return; }
    mut.mutate({ data: { ...form, email: form.email || null, wa_phone: form.wa_phone || null } });
  };

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title={form.id ? "Edit customer" : "Add customer"}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save customer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Full name *</Label>
          <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>WhatsApp number</Label>
          <Input value={form.wa_phone} onChange={(e) => setForm({ ...form, wa_phone: e.target.value })} placeholder="+234..." />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything the team should know…" />
        </div>
      </div>
    </SlideOver>
  );
}

void MessageSquare;

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else { cur += c; }
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") { out.push(cur); cur = ""; }
        else cur += c;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

function CsvImportButton({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(importCustomersCSV);
  const mut = useMutation({
    mutationFn: (rows: any[]) => importFn({ data: { rows } }),
    onSuccess: (res) => {
      toast.success(`Imported ${res.imported} customers${res.skipped ? ` · ${res.skipped} duplicates skipped` : ""}`);
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Import failed"),
  });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("CSV must be under 2 MB");
    const text = await file.text();
    const raw = parseCsv(text);
    const rows = raw
      .map((r) => ({
        display_name: (r.display_name || r.name || r.full_name || "").trim(),
        email: (r.email || "").trim() || null,
        wa_phone: (r.wa_phone || r.phone || r.whatsapp || r.mobile || "").trim() || null,
        notes: (r.notes || "").trim() || null,
      }))
      .filter((r) => r.display_name && (r.email || r.wa_phone));
    if (!rows.length) return toast.error("No valid rows. Need a name column plus email or phone.");
    mut.mutate(rows);
  };

  return (
    <>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
      <Button variant="outline" onClick={() => ref.current?.click()} disabled={mut.isPending}>
        {mut.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
        Import CSV
      </Button>
    </>
  );
}
