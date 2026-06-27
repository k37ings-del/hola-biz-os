import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Check, ChevronLeft, Clock, User, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { formatCurrency } from "@/lib/format";
import { getBookingPage, getAvailability, createPublicBooking } from "@/lib/public-booking.functions";
import { useTenantFavicon } from "@/lib/use-tenant-favicon";

export const Route = createFileRoute("/book/$slug")({
  ssr: false,
  loader: async ({ params }) => {
    const data = await getBookingPage({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Book with ${loaderData.tenant.name}` : "Book online" },
      { name: "description", content: loaderData ? `Book an appointment with ${loaderData.tenant.name} online.` : "Book an appointment online." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: PublicBookingPage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="text-2xl font-display font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground mt-2">This booking link is no longer active.</p>
      </div>
    </div>
  ),
});

type Step = "service" | "staff" | "date" | "time" | "info" | "intake" | "review" | "pay" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "staff", label: "Staff" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "info", label: "Your details" },
  { key: "intake", label: "Intake" },
  { key: "review", label: "Review" },
  { key: "pay", label: "Pay" },
];

function PublicBookingPage() {
  const page = Route.useLoaderData() as any;
  const tenant = page.tenant;
  useTenantFavicon(tenant?.logo_url);
  const services: any[] = page.services ?? [];
  const staffAll: any[] = page.staff ?? [];
  const intakeForm: { id: string; label: string; type: "text" | "textarea"; required?: boolean }[] = page.tenant.intake_form ?? [];

  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string>("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [intake, setIntake] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{ id: string; ref_code: string; portal_token?: string } | null>(null);
  const navigate = useNavigate();

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const eligibleStaff = useMemo(() =>
    staffAll.filter((s) => !serviceId || (s.service_ids as string[]).includes(serviceId)),
  [staffAll, serviceId]);

  const fetchAvail = useServerFn(getAvailability);
  const submit = useServerFn(createPublicBooking);

  const availQ = useQuery({
    queryKey: ["pub-avail", tenant.id, serviceId, staffId, date?.toDateString()],
    enabled: !!(serviceId && date && (step === "time")),
    queryFn: () => fetchAvail({
      data: {
        tenant_id: tenant.id,
        service_id: serviceId,
        staff_id: staffId,
        day: date!.toISOString().slice(0, 10),
      },
    }),
  });

  const slots = useMemo(() => {
    if (!availQ.data || !date || !service) return [];
    const hours = availQ.data.business_hours ?? {};
    const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
    const cfg = hours[dayKey];
    if (!cfg?.active) return [];
    const [oh, om] = cfg.open.split(":").map(Number);
    const [ch, cm] = cfg.close.split(":").map(Number);
    const dur = availQ.data.duration_minutes;
    const buffer = availQ.data.buffer_minutes || 0;
    const existing = (availQ.data.existing ?? []).map((b: any) => ({
      start: new Date(b.starts_at).getTime(),
      end: new Date(b.ends_at).getTime(),
    }));
    const out: { iso: string; label: string; taken: boolean }[] = [];
    const start = new Date(date); start.setHours(oh, om, 0, 0);
    const end = new Date(date); end.setHours(ch, cm, 0, 0);
    for (let t = start.getTime(); t + dur * 60000 <= end.getTime(); t += 30 * 60000) {
      const slotStart = t;
      const slotEnd = t + dur * 60000;
      const taken = existing.some((b: any) => slotStart < b.end + buffer * 60000 && slotEnd + buffer * 60000 > b.start);
      const past = slotStart < Date.now();
      const d = new Date(slotStart);
      out.push({
        iso: d.toISOString(),
        label: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        taken: taken || past,
      });
    }
    return out;
  }, [availQ.data, date, service]);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!service || !slot) throw new Error("Missing data");
      return submit({
        data: {
          tenant_id: tenant.id,
          service_id: serviceId,
          staff_id: staffId,
          starts_at: slot,
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          intake,
          timezone: tz,
        },
      });
    },
    onSuccess: (r: any) => {
      setConfirmation(r);
      setStep("done");
      // Auto-redirect to the customer portal after a short celebration moment
      if (r?.portal_token) {
        setTimeout(() => {
          navigate({ to: "/p/$token", params: { token: r.portal_token } });
        }, 2200);
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Booking failed"),
  });

  const brand = tenant.brand_color || "#C5283D";
  const next = (s: Step) => setStep(s);
  const back = (s: Step) => setStep(s);

  return (
    <div className="min-h-screen bg-background">
      {/* Branded header */}
      <header className="border-b" style={{ background: `linear-gradient(135deg, ${brand} 0%, color-mix(in oklab, ${brand} 70%, black) 100%)` }}>
        <div className="max-w-2xl mx-auto px-4 py-6 text-white">
          <div className="flex items-center gap-3">
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt={tenant.name} className="h-10 w-10 rounded-md bg-white p-1 object-contain" />
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-display font-semibold truncate">{tenant.name}</h1>
              <p className="text-xs opacity-90">Book your appointment online</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      {step !== "done" && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-[11px] text-muted-foreground">
            {STEPS.map((s, i) => {
              const idx = STEPS.findIndex((x) => x.key === step);
              const done = i < idx;
              const active = i === idx;
              return (
                <div key={s.key} className="flex items-center gap-1.5 shrink-0">
                  <div className={`h-5 w-5 rounded-full grid place-items-center text-[10px] font-semibold ${done ? "bg-primary text-primary-foreground" : active ? "border-2 border-primary text-primary" : "border border-border"}`}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className={active ? "font-medium text-foreground" : ""}>{s.label}</span>
                  {i < STEPS.length - 1 && <span className="text-border">›</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {step === "service" && (
          <Section title="Pick a service">
            <div className="space-y-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setServiceId(s.id); setStaffId(null); next("staff"); }}
                  className="w-full text-left p-4 border rounded-lg hover:border-primary hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <Clock className="h-3 w-3" /> {s.duration_minutes} min
                      </p>
                    </div>
                    <span className="font-display font-semibold text-sm">{formatCurrency(s.price_cents, s.currency)}</span>
                  </div>
                </button>
              ))}
              {services.length === 0 && <Empty text="No services available right now." />}
            </div>
          </Section>
        )}

        {step === "staff" && (
          <Section title="Pick a team member (optional)" onBack={() => back("service")}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => { setStaffId(null); next("date"); }}
                className="p-4 border rounded-lg hover:border-primary text-center"
              >
                <div className="h-12 w-12 rounded-full bg-accent mx-auto grid place-items-center"><User className="h-5 w-5" /></div>
                <p className="text-xs mt-2 font-medium">Any available</p>
              </button>
              {eligibleStaff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setStaffId(s.id); next("date"); }}
                  className="p-4 border rounded-lg hover:border-primary text-center"
                >
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={s.name} className="h-12 w-12 rounded-full object-cover mx-auto" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-accent mx-auto grid place-items-center text-sm font-medium">{s.name[0]}</div>
                  )}
                  <p className="text-xs mt-2 font-medium truncate">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{s.role}</p>
                </button>
              ))}
            </div>
          </Section>
        )}

        {step === "date" && (
          <Section title="Pick a date" onBack={() => back("staff")}>
            <div className="border rounded-lg p-2 inline-block">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { if (d) { setDate(d); next("time"); } }}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
          </Section>
        )}

        {step === "time" && (
          <Section title={`Pick a time · ${date?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`} onBack={() => back("date")}>
            {availQ.isLoading ? (
              <div className="py-8 text-center text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : slots.length === 0 ? (
              <Empty text="No slots available on this day. Try another date." />
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.iso}
                      disabled={s.taken}
                      onClick={() => { setSlot(s.iso); next("info"); }}
                      className="py-3 px-2 rounded-md border text-sm font-medium hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:line-through"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground flex items-center justify-between gap-2">
                  <span>Don't see a time that works?</span>
                  <a
                    href={`/waitlist-join/${tenant.slug}?service=${serviceId}${staffId ? `&staff=${staffId}` : ""}${date ? `&from=${date.toISOString().slice(0,10)}` : ""}`}
                    className="text-primary font-medium hover:underline"
                  >Join the waiting list →</a>
                </div>
              </>
            )}
          </Section>
        )}

        {step === "info" && (
          <Section title="Your contact details" onBack={() => back("time")}>
            <div className="space-y-4">
              <Field label="Full name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </Field>
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
              </Field>
              <Field label="Phone (WhatsApp)">
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 82 123 4567" />
              </Field>
              <p className="text-xs text-muted-foreground">We need an email or phone number to send your confirmation.</p>
            </div>
            <FooterBar
              disabled={name.trim().length < 2 || (!email && !phone)}
              label="Continue"
              onClick={() => next(intakeForm.length > 0 ? "intake" : "review")}
            />
          </Section>
        )}

        {step === "intake" && (
          <Section title="A few questions" onBack={() => back("info")}>
            <div className="space-y-4">
              {intakeForm.map((q) => (
                <Field key={q.id} label={q.label} required={q.required}>
                  {q.type === "textarea" ? (
                    <Textarea rows={3} value={intake[q.id] || ""} onChange={(e) => setIntake({ ...intake, [q.id]: e.target.value })} />
                  ) : (
                    <Input value={intake[q.id] || ""} onChange={(e) => setIntake({ ...intake, [q.id]: e.target.value })} />
                  )}
                </Field>
              ))}
            </div>
            <FooterBar label="Continue" onClick={() => next("review")} />
          </Section>
        )}

        {step === "review" && (
          <Section title="Review your booking" onBack={() => back(intakeForm.length > 0 ? "intake" : "info")}>
            <div className="border rounded-lg divide-y bg-card">
              <Row k="Service" v={service?.name ?? "—"} />
              <Row k="Duration" v={`${service?.duration_minutes} min`} />
              <Row k="With" v={staffId ? eligibleStaff.find((s) => s.id === staffId)?.name ?? "—" : "Any available"} />
              <Row k="When" v={slot ? new Date(slot).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"} />
              <Row k="Name" v={name} />
              {email && <Row k="Email" v={email} />}
              {phone && <Row k="Phone" v={phone} />}
              <div className="p-4 flex items-center justify-between bg-accent/20">
                <span className="text-sm font-medium">Total</span>
                <span className="font-display font-semibold">{service && formatCurrency(service.price_cents, service.currency)}</span>
              </div>
            </div>
            <FooterBar label="Continue to payment" onClick={() => next("pay")} />
          </Section>
        )}

        {step === "pay" && (
          <Section title="Payment" onBack={() => back("review")}>
            <div className="border rounded-lg p-6 text-center bg-card">
              <CreditCard className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium mt-3">Online payment coming soon</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your booking will be reserved and you'll receive payment instructions by {email ? "email" : "WhatsApp"}.
              </p>
            </div>
            <FooterBar
              label={submitMut.isPending ? "Reserving…" : "Confirm booking"}
              disabled={submitMut.isPending}
              onClick={() => submitMut.mutate()}
            />
          </Section>
        )}

        {step === "done" && confirmation && (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full mx-auto grid place-items-center" style={{ background: `${brand}20` }}>
              <Check className="h-8 w-8" style={{ color: brand }} />
            </div>
            <h2 className="font-display font-semibold text-2xl mt-4">You're booked!</h2>
            <p className="text-sm text-muted-foreground mt-2">Your reference is</p>
            <p className="font-mono font-semibold text-lg mt-1">{confirmation.ref_code}</p>
            <p className="text-sm text-muted-foreground mt-6 max-w-sm mx-auto">
              Opening your personal booking portal…
            </p>
            {confirmation.portal_token && (
              <a
                href={`/p/${confirmation.portal_token}`}
                className="inline-block mt-4 text-sm font-medium text-primary hover:underline"
              >
                Open my portal now →
              </a>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-muted-foreground py-6 border-t">
        Powered by <span className="font-display font-medium">HolaWeb Appointments & Commerce OS</span>
      </footer>
    </div>
  );
}

function Section({ title, children, onBack }: { title: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        {onBack && (
          <button onClick={onBack} className="p-1 -ml-1 rounded hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <h2 className="font-display font-semibold text-lg">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}{required && <span className="text-danger ml-0.5">*</span>}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="p-3 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-sm text-muted-foreground py-8">{text}</p>;
}

function FooterBar({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-4 py-3 z-50">
      <div className="max-w-2xl mx-auto">
        <Button className="w-full" size="lg" disabled={disabled} onClick={onClick}>
          {label}
        </Button>
      </div>
    </div>
  );
}
