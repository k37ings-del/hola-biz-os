import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { getCalendarRange } from "@/lib/calendar-week.functions";
import { PageHeader } from "@/components/shell/PageHeader";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6">
        <p className="text-destructive">Calendar failed to load: {error.message}</p>
        <Button className="mt-3" onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am..7pm

function CalendarPage() {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor); d.setDate(d.getDate() + i); return d;
  }), [anchor]);
  const from = anchor.toISOString();
  const to = new Date(anchor.getTime() + 7 * 86400000).toISOString();
  const fetch = useServerFn(getCalendarRange);
  const { data, isLoading } = useQuery({
    queryKey: ["calendar-range", from, to],
    queryFn: () => fetch({ data: { from, to } }),
  });

  const bookings = data?.bookings ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        description="The heart of your operation — every booking, every staff member, in one view"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAnchor(startOfWeek(new Date()))}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d); }}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d); }}><ChevronRight className="h-4 w-4" /></Button>
            <div className="text-sm font-medium ml-2">
              {anchor.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {new Date(anchor.getTime() + 6 * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0 overflow-auto">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-[60px_repeat(7,minmax(140px,1fr))] min-w-[1000px]">
              <div className="border-b border-r bg-muted/30 h-12" />
              {days.map((d) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div key={d.toISOString()} className={`border-b border-r p-2 text-center ${isToday ? "bg-primary/5" : "bg-muted/30"}`}>
                    <div className="text-[10px] uppercase text-muted-foreground">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                    <div className={`text-lg font-display ${isToday ? "text-primary font-semibold" : ""}`}>{d.getDate()}</div>
                  </div>
                );
              })}

              {HOURS.map((h) => (
                <>
                  <div key={`h-${h}`} className="border-b border-r text-[10px] text-muted-foreground text-right pr-2 pt-1 h-20">
                    {h % 12 === 0 ? 12 : h % 12}{h < 12 ? "am" : "pm"}
                  </div>
                  {days.map((d) => {
                    const slotStart = new Date(d); slotStart.setHours(h, 0, 0, 0);
                    const slotEnd = new Date(d); slotEnd.setHours(h + 1, 0, 0, 0);
                    const cellBookings = bookings.filter((b: any) => {
                      const t = new Date(b.starts_at);
                      return t >= slotStart && t < slotEnd;
                    });
                    return (
                      <div key={`${d.toISOString()}-${h}`} className="border-b border-r h-20 p-1 space-y-1 relative">
                        {cellBookings.map((b: any) => (
                          <div key={b.id} className="text-[10px] rounded bg-primary/10 border-l-2 border-primary px-1.5 py-1 truncate">
                            <div className="font-medium truncate">{new Date(b.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {b.customer_name ?? "—"}</div>
                            <div className="text-muted-foreground truncate">{b.service?.name ?? "—"} {b.staff?.name ? `· ${b.staff.name}` : ""}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <span>{bookings.length} bookings this week</span>
        <Badge variant="outline" className="ml-auto">Two-way Google / Outlook sync coming in next phase</Badge>
      </div>
    </div>
  );
}
