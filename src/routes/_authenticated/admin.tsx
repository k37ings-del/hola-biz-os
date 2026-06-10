import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => <ComingSoon title="Admin" description="Coming in the next build pass." />,
});
