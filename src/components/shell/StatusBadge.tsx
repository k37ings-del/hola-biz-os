import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = "success" | "warning" | "danger" | "info" | "muted";

const STATUS_MAP: Record<string, { variant: Variant; label: string }> = {
  // Bookings
  CONFIRMED: { variant: "success", label: "Confirmed" },
  PENDING_PAYMENT: { variant: "warning", label: "Pending payment" },
  CANCELLED: { variant: "danger", label: "Cancelled" },
  COMPLETED: { variant: "info", label: "Completed" },
  NO_SHOW: { variant: "danger", label: "No-show" },
  EXPIRED: { variant: "muted", label: "Expired" },
  // Payments
  CONFIRMED_PAYMENT: { variant: "success", label: "Paid" },
  PENDING: { variant: "warning", label: "Pending" },
  FAILED: { variant: "danger", label: "Failed" },
  REFUNDED: { variant: "muted", label: "Refunded" },
  // Customers
  active: { variant: "success", label: "Active" },
  inactive: { variant: "muted", label: "Inactive" },
  blocked: { variant: "danger", label: "Blocked" },
  // Conversations
  open: { variant: "warning", label: "Open" },
  waiting: { variant: "warning", label: "Waiting" },
  resolved: { variant: "info", label: "Resolved" },
  // Tenants / subscriptions
  trial: { variant: "warning", label: "Trial" },
  suspended: { variant: "danger", label: "Suspended" },
  cancelled: { variant: "danger", label: "Cancelled" },
  // Invoices
  paid: { variant: "success", label: "Paid" },
  unpaid: { variant: "warning", label: "Unpaid" },
  overdue: { variant: "danger", label: "Overdue" },
};

const VARIANT_CLASS: Record<Variant, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  danger: "bg-danger/15 text-danger border-danger/30",
  info: "bg-primary/10 text-primary border-primary/20",
  muted: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, override }: { status: string; override?: string }) {
  const cfg = STATUS_MAP[status] ?? { variant: "muted" as Variant, label: status };
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] font-medium border", VARIANT_CLASS[cfg.variant])}
    >
      {override ?? cfg.label}
    </Badge>
  );
}
