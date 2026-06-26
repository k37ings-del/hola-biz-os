import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPortalLink } from "@/lib/portal-link.functions";

export const Route = createFileRoute("/my")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Find my appointment · HolaWeb" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyPage,
});

function MyPage() {
  const submit = useServerFn(requestPortalLink);
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact.trim()) return;
    setLoading(true);
    try {
      await submit({ data: { contact: contact.trim() } });
      setSent(true);
    } catch (err) {
      console.error(err);
      setSent(true); // still show generic success — no enumeration
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-card shadow-sm p-6 sm:p-8">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/15 grid place-items-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h1 className="text-xl font-display font-semibold">Check your inbox</h1>
              <p className="text-sm text-muted-foreground">
                If we found an appointment matching that contact, we've emailed you a secure link to
                view, reschedule, or cancel it.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSent(false);
                  setContact("");
                }}
              >
                Try a different contact
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-display font-semibold">Find my appointment</h1>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Enter the email or phone you used when booking. We'll send you a secure link to your
                appointment.
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact">Email or phone</Label>
                  <Input
                    id="contact"
                    type="text"
                    autoFocus
                    autoComplete="email"
                    placeholder="you@example.com or +234 800 000 0000"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || contact.trim().length < 4}
                  className="w-full"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send me my link"}
                </Button>
              </form>
            </>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          Your link is private — don't share it.
        </p>
      </div>
    </div>
  );
}
