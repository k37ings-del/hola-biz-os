import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";
import { getBookingByToken, cancelBookingByToken } from "@/lib/booking-token.functions";

export const Route = createFileRoute("/cancel/$token")({
  component: CancelPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Booking not found.</div>,
});

function CancelPage() {
  const { token } = Route.useParams();
  const router = useRouter();
  const fetchFn = useServerFn(getBookingByToken);
  const cancelFn = useServerFn(cancelBookingByToken);
  const { data, isLoading } = useQuery({ queryKey: ["booking-token", "cancel", token], queryFn: () => fetchFn({ data: { token, kind: "cancel" } }) });
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Booking link invalid or expired.</div>;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{done ? "Cancelled" : "Cancel your appointment"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <div className="font-medium">{(data as any).tenant?.name}</div>
            <div>{(data as any).service?.name}</div>
            <div className="text-muted-foreground">{new Date((data as any).starts_at).toLocaleString()}</div>
          </div>
          {done ? (
            <div className="flex items-center gap-2 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" /> Your appointment has been cancelled.</div>
          ) : (
            <>
              <Textarea placeholder="Optional reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true); setErr(null);
                  try {
                    await cancelFn({ data: { token, reason } });
                    setDone(true);
                    router.invalidate();
                  } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
                }}
              >{busy ? "Cancelling…" : "Cancel appointment"}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
