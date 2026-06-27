import { initialsFor } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLORS = [
  "bg-primary/15 text-primary",
  "bg-secondary text-secondary-foreground",
  "bg-accent/20 text-accent",
  "bg-warning/15 text-warning-foreground",
  "bg-success/15 text-success",
  "bg-danger/10 text-danger",
];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function InitialsAvatar({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  seed?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = initialsFor(name);
  const cls = colorFor(seed ?? name ?? "?");
  const sizeCls =
    size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-14 w-14 text-lg" : "h-9 w-9 text-xs";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-medium shrink-0", sizeCls, cls, className)}>
      {initials}
    </div>
  );
}
