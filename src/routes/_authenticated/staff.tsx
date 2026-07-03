import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Save,
  MoreVertical,
  Pencil,
  Eye,
  Power,
  Trash2,
  CalendarDays,
  Star,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard, StatCardGrid } from "@/components/shell/StatCard";
import { SlideOver } from "@/components/shell/SlideOver";
import { InitialsAvatar } from "@/components/shell/Avatar";
import { EmptyState } from "@/components/shell/EmptyState";
import { SkeletonTable } from "@/components/shell/SkeletonTable";
import { ConfirmDialog } from "@/components/shell/ConfirmDialog";
import { formatPhone, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  listStaff,
  upsertStaff,
  setStaffActive,
  deleteStaff,
  uploadStaffPhoto,
} from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff · Holaweb Business OS" }] }),
  component: StaffPage,
});

const ROLES = ["Owner", "Senior Staff", "Staff", "Contractor"] as const;
type Role = (typeof ROLES)[number];

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

type Availability = Record<DayKey, { active: boolean; open: string; close: string }>;

function defaultAvailability(): Availability {
  return DAYS.reduce((acc, d) => {
    acc[d.key] = {
      active: d.key !== "sat" && d.key !== "sun",
      open: "09:00",
      close: "18:00",
    };
    return acc;
  }, {} as Availability);
}

type FormState = {
  id?: string;
  name: string;
  wa_number: string;
  email: string;
  role: Role;
  bio: string;
  photo_url: string;
  active: boolean;
  availability: Availability;
  service_ids: string[];
};

function emptyForm(): FormState {
  return {
    name: "",
    wa_number: "",
    email: "",
    role: "Staff",
    bio: "",
    photo_url: "",
    active: true,
    availability: defaultAvailability(),
    service_ids: [],
  };
}

function StaffPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listStaff);
  const saveFn = useServerFn(upsertStaff);
  const toggleFn = useServerFn(setStaffActive);
  const removeFn = useServerFn(deleteStaff);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "role" | "bookings">("name");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm());
  const [slideId, setSlideId] = useState<string | null>(null);
  const [editorForm, setEditorForm] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["staff-list"], queryFn: () => fetchList() });

  const staffList: any[] = q.data?.staff ?? [];
  const services: any[] = q.data?.services ?? [];
  const links: { staff_id: string; service_id: string }[] = q.data?.links ?? [];
  const bookings: any[] = q.data?.bookings ?? [];

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const servicesByStaff = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of links) {
      const arr = map.get(l.staff_id) ?? [];
      arr.push(l.service_id);
      map.set(l.staff_id, arr);
    }
    return map;
  }, [links]);

  const bookingsTodayByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (!b.staff_id) continue;
      if (b.starts_at >= startOfToday && b.starts_at < endOfToday) {
        map.set(b.staff_id, (map.get(b.staff_id) ?? 0) + 1);
      }
    }
    return map;
  }, [bookings, startOfToday, endOfToday]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = staffList.filter((s) => {
      if (!term) return true;
      return (
        s.name?.toLowerCase().includes(term) ||
        s.role?.toLowerCase().includes(term) ||
        s.wa_number?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term)
      );
    });
    list = [...list].sort((a, b) => {
      if (sortKey === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sortKey === "role") return (a.role ?? "").localeCompare(b.role ?? "");
      return (bookingsTodayByStaff.get(b.id) ?? 0) - (bookingsTodayByStaff.get(a.id) ?? 0);
    });
    return list;
  }, [staffList, search, sortKey, bookingsTodayByStaff]);

  const activeToday = staffList.filter((s) => s.active).length;

  const selected = slideId ? staffList.find((s) => s.id === slideId) ?? null : null;

  const openSlideOver = (s: any) => {
    setSlideId(s.id);
    setEditorForm({
      id: s.id,
      name: s.name ?? "",
      wa_number: s.wa_number ?? "",
      email: s.email ?? "",
      role: (ROLES as readonly string[]).includes(s.role) ? (s.role as Role) : "Staff",
      bio: s.bio ?? "",
      photo_url: s.photo_url ?? "",
      active: !!s.active,
      availability: { ...defaultAvailability(), ...(s.availability ?? {}) } as Availability,
      service_ids: servicesByStaff.get(s.id) ?? [],
    });
  };

  const closeSlideOver = () => {
    setSlideId(null);
    setEditorForm(null);
  };

  const saveMut = useMutation({
    mutationFn: (payload: FormState) =>
      saveFn({
        data: {
          ...(payload.id ? { id: payload.id } : {}),
          name: payload.name.trim(),
          wa_number: payload.wa_number.trim() || null,
          email: payload.email.trim() || null,
          role: payload.role,
          bio: payload.bio.trim() || null,
          photo_url: payload.photo_url.trim() || null,
          active: payload.active,
          availability: payload.availability,
          service_ids: payload.service_ids,
        } as any,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-list"] });
      toast.success("Staff saved");
      setCreateOpen(false);
      setCreateForm(emptyForm());
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-list"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-list"] });
      setConfirmDelete(null);
      closeSlideOver();
      toast.success("Staff removed");
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Staff"
        description="Manage your team members and their assignments"
        actions={
          <Button onClick={() => { setCreateForm(emptyForm()); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Add staff member
          </Button>
        }
      />

      <StatCardGrid>
        <StatCard label="Total staff" value={staffList.length} icon={Users} />
        <StatCard label="Active today" value={activeToday} icon={Users} />
        <StatCard label="Bookings this week" value={q.data?.weekCount ?? 0} icon={CalendarDays} />
        <StatCard label="Avg rating" value="—" icon={Star} hint="Coming soon" />
      </StatCardGrid>

      <div className="rounded-xl border bg-card">
        <div className="p-3 flex items-center gap-2 border-b">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role, phone…"
              className="pl-9"
            />
          </div>
          <Select value={sortKey} onValueChange={(v: any) => setSortKey(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="role">Sort: Role</SelectItem>
              <SelectItem value="bookings">Sort: Bookings today</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {q.isLoading ? (
          <SkeletonTable rows={6} cols={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff yet"
            description="Add your first team member to start assigning bookings."
            action={
              <Button onClick={() => { setCreateForm(emptyForm()); setCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />Add staff member
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Bookings today</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const svcCount = servicesByStaff.get(s.id)?.length ?? 0;
                const todayCount = bookingsTodayByStaff.get(s.id) ?? 0;
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => openSlideOver(s)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={s.name} seed={s.id} />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.name}</p>
                          {s.email && (
                            <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">{s.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatPhone(s.wa_number)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px]">{svcCount}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{todayCount}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleMut.mutate({ id: s.id, active: !s.active })}
                        className={cn(
                          "text-[11px] px-2 py-1 rounded-md border font-medium transition-colors",
                          s.active
                            ? "bg-success/15 text-success border-success/30"
                            : "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {s.active ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openSlideOver(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openSlideOver(s)}>
                              <Eye className="h-3.5 w-3.5 mr-2" />View profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSlideOver(s)}>
                              <Users className="h-3.5 w-3.5 mr-2" />Assign services
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleMut.mutate({ id: s.id, active: !s.active })}
                            >
                              <Power className="h-3.5 w-3.5 mr-2" />
                              {s.active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-danger"
                              onClick={() => setConfirmDelete(s.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add staff modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="font-display">Add staff member</DialogTitle>
            <DialogDescription>Create a new team member and assign services.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Full name">
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input
                  value={createForm.wa_number}
                  onChange={(e) => setCreateForm({ ...createForm, wa_number: e.target.value })}
                  placeholder="+27 82 000 0000"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="jane@example.com"
                />
              </Field>
            </div>
            <Field label="Role">
              <Select
                value={createForm.role}
                onValueChange={(v: Role) => setCreateForm({ ...createForm, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Services assigned">
              <ServiceMultiSelect
                services={services}
                value={createForm.service_ids}
                onChange={(ids) => setCreateForm({ ...createForm, service_ids: ids })}
              />
            </Field>
            <div className="flex items-center justify-between pt-1">
              <Label className="text-sm">Active</Label>
              <Switch
                checked={createForm.active}
                onCheckedChange={(v) => setCreateForm({ ...createForm, active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMut.mutate(createForm)}
              disabled={saveMut.isPending || !createForm.name.trim()}
            >
              {saveMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slide-over: profile / schedule / bookings */}
      <SlideOver
        open={!!slideId}
        onOpenChange={(v) => { if (!v) closeSlideOver(); }}
        title={selected?.name ?? "Staff"}
        description={selected?.role}
        widthClassName="sm:max-w-[560px]"
        footer={
          editorForm && (
            <>
              <Button variant="outline" onClick={closeSlideOver}>Close</Button>
              <Button
                onClick={() => saveMut.mutate(editorForm)}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save changes
              </Button>
            </>
          )
        }
      >
        {editorForm && selected && (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-3 pt-4">
              <div className="flex items-center gap-3">
                {editorForm.photo_url ? (
                  <img src={editorForm.photo_url} alt={editorForm.name} className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <InitialsAvatar name={editorForm.name} seed={selected.id} size="lg" />
                )}
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Profile photo</Label>
                  <PhotoUploader
                    staffId={editorForm.id}
                    value={editorForm.photo_url}
                    onChange={(url) => setEditorForm({ ...editorForm, photo_url: url })}
                  />
                </div>
              </div>
              <Field label="Full name">
                <Input
                  value={editorForm.name}
                  onChange={(e) => setEditorForm({ ...editorForm, name: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input
                    value={editorForm.wa_number}
                    onChange={(e) => setEditorForm({ ...editorForm, wa_number: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={editorForm.email}
                    onChange={(e) => setEditorForm({ ...editorForm, email: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Role">
                <Select
                  value={editorForm.role}
                  onValueChange={(v: Role) => setEditorForm({ ...editorForm, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Bio">
                <Textarea
                  value={editorForm.bio}
                  onChange={(e) => setEditorForm({ ...editorForm, bio: e.target.value })}
                  rows={3}
                />
              </Field>
              <Field label="Services assigned">
                <ServiceMultiSelect
                  services={services}
                  value={editorForm.service_ids}
                  onChange={(ids) => setEditorForm({ ...editorForm, service_ids: ids })}
                />
              </Field>
              <div className="flex items-center justify-between pt-1">
                <Label className="text-sm">Active</Label>
                <Switch
                  checked={editorForm.active}
                  onCheckedChange={(v) => setEditorForm({ ...editorForm, active: v })}
                />
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="pt-4">
              <p className="text-xs text-muted-foreground mb-3">
                Toggle each day on or off and set the available time window.
              </p>
              <div className="space-y-2">
                {DAYS.map((d) => {
                  const slot = editorForm.availability[d.key];
                  return (
                    <div
                      key={d.key}
                      className="grid grid-cols-[80px_auto_1fr_1fr] items-center gap-2 rounded-md border p-2"
                    >
                      <Switch
                        checked={slot.active}
                        onCheckedChange={(v) =>
                          setEditorForm({
                            ...editorForm,
                            availability: {
                              ...editorForm.availability,
                              [d.key]: { ...slot, active: v },
                            },
                          })
                        }
                      />
                      <span className="text-sm font-medium">{d.label}</span>
                      <Input
                        type="time"
                        value={slot.open}
                        disabled={!slot.active}
                        onChange={(e) =>
                          setEditorForm({
                            ...editorForm,
                            availability: {
                              ...editorForm.availability,
                              [d.key]: { ...slot, open: e.target.value },
                            },
                          })
                        }
                      />
                      <Input
                        type="time"
                        value={slot.close}
                        disabled={!slot.active}
                        onChange={(e) =>
                          setEditorForm({
                            ...editorForm,
                            availability: {
                              ...editorForm.availability,
                              [d.key]: { ...slot, close: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="bookings" className="pt-4">
              <StaffBookings staffId={selected.id} bookings={bookings} />
            </TabsContent>
          </Tabs>
        )}
      </SlideOver>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}
        title="Remove staff member?"
        description="This will permanently delete the staff record and unassign their services."
        confirmLabel="Remove"
        destructive
        onConfirm={() => { if (confirmDelete) deleteMut.mutate(confirmDelete); }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ServiceMultiSelect({
  services,
  value,
  onChange,
}: {
  services: any[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!services.length) {
    return (
      <p className="text-xs text-muted-foreground border rounded-md px-3 py-2">
        No services yet. Add services first.
      </p>
    );
  }
  return (
    <div className="border rounded-md max-h-44 overflow-y-auto divide-y">
      {services.map((s) => {
        const checked = value.includes(s.id);
        return (
          <label
            key={s.id}
            className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => {
                if (v) onChange([...value, s.id]);
                else onChange(value.filter((x) => x !== s.id));
              }}
            />
            <span className="flex-1 truncate">{s.name}</span>
            {!s.active && (
              <Badge variant="outline" className="text-[10px]">inactive</Badge>
            )}
          </label>
        );
      })}
    </div>
  );
}

function StaffBookings({ staffId, bookings }: { staffId: string; bookings: any[] }) {
  const upcoming = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((b) => b.staff_id === staffId && new Date(b.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [bookings, staffId]);

  if (!upcoming.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No upcoming bookings.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {upcoming.map((b) => (
        <div key={b.id} className="rounded-md border p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{formatDateTime(b.starts_at)}</p>
            <p className="text-xs text-muted-foreground">{b.status}</p>
          </div>
          <Badge variant="outline" className="text-[11px]">{b.status}</Badge>
        </div>
      ))}
    </div>
  );
}
