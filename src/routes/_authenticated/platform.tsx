import { createFileRoute, redirect } from "@tanstack/react-router";

// Platform overview was rolled into /admin — keep the route as a permanent redirect
// so any existing bookmarks/links don't 404.
export const Route = createFileRoute("/_authenticated/platform")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  component: () => null,
});
