import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/invoices")({
  component: () => <ComingSoon title="Invoices" description="Coming in the next build pass." />,
});
