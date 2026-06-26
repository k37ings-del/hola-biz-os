import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Zap, Plus, Loader2, Save, Trash2, MessageSquare, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard, StatCardGrid } from "@/components/shell/StatCard";
import { SlideOver } from "@/components/shell/SlideOver";
import { EmptyState } from "@/components/shell/EmptyState";
import { SkeletonTable } from "@/components/shell/SkeletonTable";
import {
  listAutomations,
  upsertAutomation,
  deleteAutomation,
  setAutomationActive,
  TRIGGERS,
  CHANNELS,
} from "@/lib/automations.functions";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({ meta: [{ title: "Automations · HolaWeb Appointments & Commerce OS" }] }),
  component: AutomationsPage,
});

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmed: "Booking confirmed",
  before_appointment: "Before appointment",
  after_appointment: "After appointment",
  payment_overdue: "Payment overdue",
  post_visit_review: "Post-visit review",
  follow_up: "Follow-up campaign",
};

const CHANNEL_ICONS = {
  whatsapp: MessageSquare,
  email: Mail,
  sms: Phone,
} as const;

const PRESETS = [
  {
    name: "Booking confirmation",
    trigger: "booking_confirmed",
    offset_minutes: 0,
    channel: "whatsapp",
    subject: null,
    template:
      "Hi {{customer_name}}, your booking for {{service}} on {{date}} at {{time}} is confirmed. Ref: {{ref_code}}.",
  },
  {
    name: "24h reminder",
    trigger: "before_appointment",
    offset_minutes: -1440,
    channel: "whatsapp",
    subject: null,
    template: "Reminder: you have {{service}} tomorrow at {{time}} with {{business_name}}.",
  },
  {
    name: "Payment overdue nudge",
    trigger: "payment_overdue",
    offset_minutes: 0,
    channel: "email",
    subject: "Payment due for your booking",
    template:
      "Hi {{customer_name}}, your booking {{ref_code}} is awaiting payment. Please complete payment to confirm.",
  },
  {
    name: "Post-visit review",
    trigger: "post_visit_review",
    offset_minutes: 120,
    channel: "whatsapp",
    subject: null,
    template: "Thanks for visiting {{business_name}}! Would you mind leaving us a quick review?",
  },
] as const;

type FormState = {
  id?: string;
  name: string;
  trigger: (typeof TRIGGERS)[number];
  offset_minutes: number;
  channel: (typeof CHANNELS)[number];
  subject: string;
  template: string;
  active: boolean;
};

function AutomationsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listAutomations);
  const save = useServerFn(upsertAutomation);
  const remove = useServerFn(deleteAutomation);
  const toggle = useServerFn(setAutomationActive);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  const q = useQuery({ queryKey: ["automations"], queryFn: () => fetchList() });

  const startNew = (preset?: (typeof PRESETS)[number]) => {
    setForm({
      name: preset?.name ?? "New automation",
      trigger: (preset?.trigger ?? "booking_confirmed") as any,
      offset_minutes: preset?.offset_minutes ?? 0,
      channel: (preset?.channel ?? "whatsapp") as any,
      subject: preset?.subject ?? "",
      template: preset?.template ?? "",
      active: true,
    });
    setOpen(true);
  };

  const startEdit = (a: any) => {
    const cfg = a.config || {};
    setForm({
      id: a.id,
      name: a.name ?? "",
      trigger: a.trigger_type ?? "booking_confirmed",
      offset_minutes: cfg.offset_minutes ?? 0,
      channel: cfg.channel ?? a.action_type ?? "whatsapp",
      subject: cfg.subject ?? "",
      template: cfg.template ?? "",
      active: a.active,
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: form?.id,
          name: form!.name,
          trigger: form!.trigger,
          offset_minutes: form!.offset_minutes,
          channel: form!.channel,
          subject: form!.subject || null,
          template: form!.template,
          active: form!.active,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      setOpen(false);
      toast.success("Automation saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Deleted");
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggle({ data: { id, active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });

  const automations = q.data?.automations ?? [];
  const runs = q.data?.runs ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Automations"
        description="Trigger WhatsApp, email or SMS messages on booking and payment events."
        actions={
          <Button onClick={() => startNew()}>
            <Plus className="h-4 w-4 mr-1" />
            New automation
          </Button>
        }
      />

      <StatCardGrid>
        <StatCard
          label="Active rules"
          value={automations.filter((a: any) => a.active).length}
          icon={Zap}
        />
        <StatCard label="Total rules" value={automations.length} icon={Zap} />
        <StatCard
          label="Sent (7d)"
          value={
            runs.filter(
              (r: any) =>
                r.status === "sent" && new Date(r.sent_at ?? 0).getTime() > Date.now() - 7 * 864e5,
            ).length
          }
        />
        <StatCard label="Pending" value={runs.filter((r: any) => r.status === "pending").length} />
      </StatCardGrid>

      {automations.length === 0 && !q.isLoading && (
        <div>
          <h3 className="text-sm font-medium mb-3">Start from a template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PRESETS.map((p) => (
              <Card
                key={p.name}
                className="cursor-pointer hover:border-primary"
                onClick={() => startNew(p)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {p.template}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-card">
        {q.isLoading ? (
          <SkeletonTable rows={4} />
        ) : automations.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No automations yet"
            description="Pick a template above or create your own."
          />
        ) : (
          <div className="divide-y">
            {automations.map((a: any) => {
              const cfg = a.config || {};
              const Icon =
                CHANNEL_ICONS[(cfg.channel ?? a.action_type) as keyof typeof CHANNEL_ICONS] ??
                MessageSquare;
              return (
                <div
                  key={a.id}
                  className="p-4 flex items-center gap-4 hover:bg-accent/20 cursor-pointer"
                  onClick={() => startEdit(a)}
                >
                  <div className="h-10 w-10 rounded-lg bg-accent grid place-items-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TRIGGER_LABELS[a.trigger_type] ?? a.trigger_type}
                      {cfg.offset_minutes ? ` · ${formatOffset(cfg.offset_minutes)}` : ""}
                      {" · "}
                      {(cfg.channel ?? a.action_type ?? "").toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={a.active}
                      onCheckedChange={(v) => toggleMut.mutate({ id: a.id, active: v })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this automation?")) deleteMut.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title={form?.id ? "Edit automation" : "New automation"}
        description="Triggers run via the scheduled worker."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !form?.name || !form?.template}
            >
              {saveMut.isPending ? (
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
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Trigger</Label>
                <Select
                  value={form.trigger}
                  onValueChange={(v) => setForm({ ...form, trigger: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TRIGGER_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Channel</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm({ ...form, channel: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Send offset (minutes)</Label>
              <Input
                type="number"
                value={form.offset_minutes}
                onChange={(e) => setForm({ ...form, offset_minutes: Number(e.target.value) || 0 })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Negative = before trigger (e.g. -1440 for 24h before). Positive = after.
              </p>
            </div>
            {form.channel === "email" && (
              <div>
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Message template</Label>
              <Textarea
                rows={6}
                value={form.template}
                onChange={(e) => setForm({ ...form, template: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Variables: <code>{"{{customer_name}}"}</code>, <code>{"{{service}}"}</code>,{" "}
                <code>{"{{date}}"}</code>, <code>{"{{time}}"}</code>, <code>{"{{ref_code}}"}</code>,{" "}
                <code>{"{{business_name}}"}</code>
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function formatOffset(min: number): string {
  if (min === 0) return "immediately";
  const abs = Math.abs(min);
  const when = min < 0 ? "before" : "after";
  if (abs % 1440 === 0) return `${abs / 1440}d ${when}`;
  if (abs % 60 === 0) return `${abs / 60}h ${when}`;
  return `${abs}m ${when}`;
}
