import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: () => <ComingSoon title="Inbox" description="Coming in the next build pass." />,
});
