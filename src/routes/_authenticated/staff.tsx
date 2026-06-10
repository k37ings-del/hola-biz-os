import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/staff")({
  component: () => <ComingSoon title="Staff" description="Coming in the next build pass." />,
});
