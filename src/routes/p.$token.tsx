import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Clock, MapPin, Phone, Mail, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { getCustomerPortal } from "@/lib/customer-portal.functions";
import { useTenantFavicon } from "@/lib/use-tenant-favicon";

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your appointment · HolaWeb" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-display font-semibold">Booking not found</h1>
        <p className="text-sm text-muted-foreground mt-2">This portal link is no longer valid.</p>
      </div>
    </div>
  ),
});

function PortalPage() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(getCustomerPortal);
  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-portal", token],
    queryFn: () => fetchFn({ data: { token } }),
  });

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) throw notFound();

  const { booking, service, staff, tenant, history } = data as any;
  useTenantFavicon(tenant?.logo_url);
  const brand = tenant.brand_color || "#C5283D";
  const startsAt = new Date(booking.starts_at);
  const upcoming = (history as any[]).filter((h) => new Date(h.starts_at) >= new Date() && h.status !== "CANCELLED");
  const past = (history as any[]).filter((h) => new Date(h.starts_at) < new Date() || h.status === "CANCELLED");

  const statusTone: Record<string, string> = {
    CONFIRMED: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    PENDING_PAYMENT: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    CANCELLED: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    COMPLETED: "bg-slate-500/15 text-slate-700 border-slate-500/30",
    NO_SHOW: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b" style={{ background: `linear-gradient(135deg, ${brand} 0%, color-mix(in oklab, ${brand} 70%, black) 100%)` }}>
        <div className="max-w-3xl mx-auto px-4 py-6 text-white">
          <div className="flex items-center gap-3">
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt={tenant.name} className="h-10 w-10 rounded-md bg-white p-1 object-contain" />
            )}
            <div className="min-w-0">
              <p className="text-xs uppercase opacity-80 tracking-wider">Your portal</p>
              <h1 className="text-xl font-display font-semibold truncate">{tenant.name}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Confirmation card */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Reference</p>
              <p className="font-mono font-semibold text-sm">{booking.ref_code}</p>
            </div>
            <Badge variant="outline" className={statusTone[booking.status] ?? ""}>{booking.status.replace("_", " ")}</Badge>
          </div>
          <h2 className="font-display font-semibold text-2xl mt-3">Hi {booking.customer_name.split(" ")[0]} 👋</h2>
          <p className="text-sm text-muted-foreground">Here's everything about your appointment with {tenant.name}.</p>

          <div className="mt-5 space-y-3 text-sm">
            <Line icon={Calendar} label="When">
              <span className="font-medium">{startsAt.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              <span className="text-muted-foreground"> · {startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
            </Line>
            <Line icon={Clock} label="Service">
              <span className="font-medium">{service.name}</span>
              <span className="text-muted-foreground"> · {service.duration_minutes} min · {formatCurrency(booking.amount_cents, booking.currency)}</span>
            </Line>
            {staff && (
              <Line icon={MapPin} label="With">
                <span className="font-medium">{staff.name}</span>
              </Line>
            )}
            {booking.customer_email && <Line icon={Mail} label="Email"><span>{booking.customer_email}</span></Line>}
            {booking.customer_phone && <Line icon={Phone} label="Phone"><span>{booking.customer_phone}</span></Line>}
          </div>

          {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/reschedule/$token" params={{ token: booking.reschedule_token }}>Reschedule</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                <Link to="/cancel/$token" params={{ token: booking.cancel_token }}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/book/$slug" params={{ slug: tenant.slug }}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Book another
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Upcoming */}
        {upcoming.length > 1 && (
          <Section title="Other upcoming appointments">
            <div className="space-y-2">
              {upcoming.filter((h) => h.id !== booking.id).map((h) => <HistoryRow key={h.id} h={h} statusTone={statusTone} />)}
            </div>
          </Section>
        )}

        {/* History */}
        {past.length > 0 && (
          <Section title="Past visits">
            <div className="space-y-2">
              {past.slice(0, 10).map((h) => <HistoryRow key={h.id} h={h} statusTone={statusTone} />)}
            </div>
          </Section>
        )}
      </main>

      <footer className="text-center text-xs text-muted-foreground pt-8">
        Powered by <span className="font-display font-medium">HolaWeb Business OS</span>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      {children}
    </section>
  );
}

function Line({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase text-muted-foreground tracking-wider">{label}</p>
        <p className="text-sm">{children}</p>
      </div>
    </div>
  );
}

function HistoryRow({ h, statusTone }: { h: any; statusTone: Record<string, string> }) {
  const d = new Date(h.starts_at);
  return (
    <Link
      to="/p/$token"
      params={{ token: h.portal_token }}
      className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 hover:border-primary transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{h.service_name ?? "Service"}</p>
        <p className="text-xs text-muted-foreground">
          {d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · {d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          {h.staff_name && <> · {h.staff_name}</>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {h.status === "COMPLETED" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
        <Badge variant="outline" className={`text-[10px] ${statusTone[h.status] ?? ""}`}>{h.status.replace("_", " ")}</Badge>
      </div>
    </Link>
  );
}
