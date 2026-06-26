import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <Card>
        <CardContent className="p-12 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
            <Construction className="h-6 w-6 text-accent-foreground" />
          </div>
          <h2 className="text-lg font-medium">Module in progress</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            This module's schema is live and ready. The full interface ships in the next build pass
            — your data is safe and waiting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
