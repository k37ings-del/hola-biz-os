import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { getWaitlistOffer, claimWaitlistSlot } from "@/lib/waitlist.functions";

export const Route = createFileRoute("/waitlist/$token")({
  ssr: false,
  component: WaitlistClaim,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Offer not found</h1>
        <p className="text-sm text-muted-foreground mt-2">This waitlist link is invalid or has expired.</p>
      </div>
    </div>
  ),
});

function WaitlistClaim() {
  const { token } = Route.useParams();
  const fetchOffer = useServerFn(getWaitlistOffer);
  const claim = useServerFn(claimWaitlistSlot);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["waitlist-offer", token],
    queryFn: () => fetchOffer({ data: { token } }),
  });

  const mut = useMutation({
    mutationFn: () => claim({ data: { token } }),
    onSuccess: (r) => { toast.success(`Booked! Ref ${r.ref_code}`); refetch(); },
    onError: (e: Error) => toast.error(e.message.replace(/^.*?:\s*/, "")),
  });

  if (isLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) throw notFound();

  const expired = data.expires_at && new Date(data.expires_at) < new Date();
  const status = data.status as string;
  const slot = new Date(data.offered_starts_at);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="mb-6 text-center">
          {data.tenant.logo_url && <img src={data.tenant.logo_url} alt="" className="h-12 mx-auto mb-3" />}
          <h1 className="text-xl font-display font-semibold">A spot opened up at {data.tenant.name}</h1>
          <p className="text-sm text-muted-foreground">Hi {data.customer_name}, you're next in line.</p>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="rounded-md bg-muted/50 p-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Your service</div>
              <div className="font-medium">{data.service.name}</div>
              <div className="text-sm text-muted-foreground">{data.service.duration_minutes} min · {formatCurrency(data.service.price_cents, data.service.currency)}</div>
            </div>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
              <div className="text-xs uppercase tracking-wide text-primary mb-1">Offered slot</div>
              <div className="text-lg font-display font-semibold">{slot.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              {data.expires_at && !expired && status === "notified" && (
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Hold expires {new Date(data.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
              )}
            </div>

            {status === "booked" ? (
              <div className="text-center py-4">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-600 mb-2" />
                <p className="font-medium">You're booked!</p>
                <p className="text-sm text-muted-foreground">A confirmation has been sent.</p>
              </div>
            ) : expired || status === "expired" ? (
              <div className="text-center text-sm text-destructive">This offer has expired. You're still on the waitlist for the next opening.</div>
            ) : status === "notified" ? (
              <Button className="w-full" size="lg" disabled={mut.isPending} onClick={() => mut.mutate()}>
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim this slot"}
              </Button>
            ) : (
              <div className="text-center text-sm text-muted-foreground">You're on the waitlist — we'll notify you the moment a spot opens.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
