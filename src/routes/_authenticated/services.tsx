import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/services")({
  component: () => <ComingSoon title="Services" description="Coming in the next build pass." />,
});
