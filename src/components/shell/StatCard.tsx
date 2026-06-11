import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="mt-2 text-xl font-display font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function StatCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>;
}
