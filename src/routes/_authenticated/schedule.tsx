import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, CalendarClock, Copy, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/PageHeader";
import { InitialsAvatar } from "@/components/shell/Avatar";
import { listSchedules, upsertSchedule } from "@/lib/staff-schedule.functions";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Schedule · HolaWeb" }] }),
  component: SchedulePage,
});

const DAYS = [
  { k: "mon", l: "Monday" },
  { k: "tue", l: "Tuesday" },
  { k: "wed", l: "Wednesday" },
  { k: "thu", l: "Thursday" },
  { k: "fri", l: "Friday" },
  { k: "sat", l: "Saturday" },
  { k: "sun", l: "Sunday" },
] as const;
type DK = (typeof DAYS)[number]["k"];

type Weekly = Record<DK, { active: boolean; open: string; close: string }>;
type TimeOff = { from: string; to: string; reason?: string };

function defaultWeekly(): Weekly {
  return DAYS.reduce((acc, d) => {
    acc[d.k] = { active: d.k !== "sat" && d.k !== "sun", open: "09:00", close: "17:00" };
    return acc;
  }, {} as Weekly);
}

function SchedulePage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listSchedules);
  const saveFn = useServerFn(upsertSchedule);
  const { data, isLoading } = useQuery({ queryKey: ["schedules"], queryFn: () => fetchFn() });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const staff = (data?.staff ?? []) as any[];
  const schedules = (data?.schedules ?? []) as any[];

  useEffect(() => {
    if (!selectedId && staff.length) setSelectedId(staff[0].id);
  }, [staff, selectedId]);

  const selectedStaff = staff.find((s) => s.id === selectedId);
  const existing = useMemo(() => schedules.find((s) => s.staff_id === selectedId), [schedules, selectedId]);

  const [weekly, setWeekly] = useState<Weekly>(defaultWeekly());
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [bufBefore, setBufBefore] = useState(0);
  const [bufAfter, setBufAfter] = useState(0);
  const [maxDaily, setMaxDaily] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (existing) {
      setWeekly({ ...defaultWeekly(), ...(existing.weekly ?? {}) } as Weekly);
      setTimeOff(Array.isArray(existing.time_off) ? existing.time_off : []);
      setBufBefore(existing.buffer_before_minutes ?? 0);
      setBufAfter(existing.buffer_after_minutes ?? 0);
      setMaxDaily(existing.max_daily_appointments != null ? String(existing.max_daily_appointments) : "");
    } else {
      setWeekly(defaultWeekly());
      setTimeOff([]);
      setBufBefore(0);
      setBufAfter(0);
      setMaxDaily("");
    }
  }, [existing?.id, selectedId]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({
      data: {
        staff_id: selectedId!,
        weekly,
        time_off: timeOff,
        buffer_before_minutes: bufBefore,
        buffer_after_minutes: bufAfter,
        max_daily_appointments: maxDaily.trim() ? Number(maxDaily) : null,
      },
    }),
    onSuccess: () => {
      toast.success("Schedule saved");
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const icsUrl = selectedStaff?.ics_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/ics/${selectedStaff.ics_token}.ics`
    : "";

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Schedule"
        description="Set working hours, breaks, time off, and per-staff calendar feeds."
      />

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* Staff list */}
        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader><CardTitle className="text-sm">Team</CardTitle></CardHeader>
          <CardContent className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {staff.length === 0 && <p className="text-sm text-muted-foreground p-3">No active staff. Add them in the Staff page.</p>}
            {staff.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm ${selectedId === s.id ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}
              >
                <InitialsAvatar name={s.name} seed={s.id} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.role}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Editor */}
        {selectedStaff && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Weekly hours</CardTitle>
                  <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                    {saveMut.isPending ? "Saving…" : "Save schedule"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {DAYS.map((d) => (
                  <div key={d.k} className="flex items-center gap-3 py-1">
                    <div className="w-28 text-sm font-medium">{d.l}</div>
                    <Switch
                      checked={weekly[d.k].active}
                      onCheckedChange={(v) => setWeekly({ ...weekly, [d.k]: { ...weekly[d.k], active: v } })}
                    />
                    <Input
                      type="time"
                      value={weekly[d.k].open}
                      disabled={!weekly[d.k].active}
                      onChange={(e) => setWeekly({ ...weekly, [d.k]: { ...weekly[d.k], open: e.target.value } })}
                      className="w-32"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={weekly[d.k].close}
                      disabled={!weekly[d.k].active}
                      onChange={(e) => setWeekly({ ...weekly, [d.k]: { ...weekly[d.k], close: e.target.value } })}
                      className="w-32"
                    />
                    {!weekly[d.k].active && <Badge variant="outline" className="text-[10px] ml-2">Off</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Buffers & limits</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Field label="Buffer before (min)">
                    <Input type="number" min={0} max={120} value={bufBefore} onChange={(e) => setBufBefore(Number(e.target.value))} />
                  </Field>
                  <Field label="Buffer after (min)">
                    <Input type="number" min={0} max={120} value={bufAfter} onChange={(e) => setBufAfter(Number(e.target.value))} />
                  </Field>
                  <Field label="Max daily appointments (blank = no limit)">
                    <Input type="number" min={0} max={100} value={maxDaily} onChange={(e) => setMaxDaily(e.target.value)} placeholder="No limit" />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Time off</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setTimeOff([...timeOff, { from: "", to: "", reason: "" }])}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {timeOff.length === 0 && <p className="text-sm text-muted-foreground">No time off scheduled.</p>}
                  {timeOff.map((t, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                      <Input type="date" value={t.from} onChange={(e) => {
                        const next = [...timeOff]; next[i] = { ...t, from: e.target.value }; setTimeOff(next);
                      }} />
                      <Input type="date" value={t.to} onChange={(e) => {
                        const next = [...timeOff]; next[i] = { ...t, to: e.target.value }; setTimeOff(next);
                      }} />
                      <Input placeholder="Reason" value={t.reason ?? ""} onChange={(e) => {
                        const next = [...timeOff]; next[i] = { ...t, reason: e.target.value }; setTimeOff(next);
                      }} />
                      <Button size="icon" variant="ghost" onClick={() => setTimeOff(timeOff.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Calendar subscription (iCal)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {selectedStaff.name} can subscribe to this private URL from Google Calendar, Outlook, or Apple Calendar. Updates every ~15 minutes. One-way sync (HolaWeb → calendar).
                </p>
                <div className="flex gap-2">
                  <Input value={icsUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" onClick={async () => {
                    await navigator.clipboard.writeText(icsUrl);
                    setCopied(true); setTimeout(() => setCopied(false), 1500);
                  }}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  In Google Calendar: <b>Other calendars → +</b> → <b>From URL</b>, paste this link.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
