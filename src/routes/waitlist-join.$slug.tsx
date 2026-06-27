import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getBookingPage } from "@/lib/public-booking.functions";
import { joinWaitlist } from "@/lib/waitlist.functions";
import { useTenantFavicon } from "@/lib/use-tenant-favicon";

export const Route = createFileRoute("/waitlist-join/$slug")({
  ssr: false,
  component: WaitlistJoinPage,
});

function WaitlistJoinPage() {
  const { slug } = Route.useParams();
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const fetchPage = useServerFn(getBookingPage);
  const join = useServerFn(joinWaitlist);

  const { data: page, isLoading } = useQuery({
    queryKey: ["waitlist-page", slug],
    queryFn: () => fetchPage({ data: { slug } }),
  });
  useTenantFavicon((page as any)?.tenant?.logo_url);

  const [serviceId, setServiceId] = useState(search.get("service") ?? "");
  const [staffId] = useState(search.get("staff"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [from, setFrom] = useState(search.get("from") ?? "");
  const [to, setTo] = useState("");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () => join({
      data: {
        tenant_id: page.tenant.id, service_id: serviceId, staff_id: staffId,
        customer_name: name, customer_email: email || null, customer_phone: phone || null,
        desired_from: from ? new Date(from).toISOString() : null,
        desired_to: to ? new Date(to).toISOString() : null,
        notes: notes || null,
      },
    }),
    onSuccess: () => { setDone(true); toast.success("You're on the list — we'll notify you."); },
    onError: (e: Error) => toast.error(e.message.replace(/^.*?:\s*/, "")),
  });

  if (isLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!page) throw notFound();
  const brand = page.tenant.brand_color || "#C5283D";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b" style={{ background: brand, color: "white" }}>
        <div className="max-w-lg mx-auto px-4 py-5 flex items-center gap-3">
          {page.tenant.logo_url && <img src={page.tenant.logo_url} alt="" className="h-9 w-9 rounded bg-white p-1" />}
          <div>
            <h1 className="font-display font-semibold">Join {page.tenant.name}'s waiting list</h1>
            <p className="text-xs opacity-90">We'll text or email you the moment a slot opens.</p>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        {done ? (
          <Card><CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-3" />
            <h2 className="font-semibold text-lg">You're on the list</h2>
            <p className="text-sm text-muted-foreground mt-1">When a matching slot opens we'll send you a link to claim it within 2 hours.</p>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-6 space-y-4">
            <div>
              <Label>Service *</Label>
              <select className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">Choose a service</option>
                {page.services.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><Label>Full name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Earliest date</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><Label>Latest date</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div><Label>Notes (optional)</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any time preferences" /></div>
            <Button className="w-full" size="lg" disabled={mut.isPending || !serviceId || !name || (!email && !phone)} onClick={() => mut.mutate()}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join waiting list"}
            </Button>
          </CardContent></Card>
        )}
      </main>
    </div>
  );
}
