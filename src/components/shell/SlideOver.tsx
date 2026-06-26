import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  widthClassName = "sm:max-w-[480px]",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={`${widthClassName} p-0 flex flex-col`}>
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <SheetTitle className="font-display">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t px-5 py-3 flex items-center justify-end gap-2 shrink-0 bg-background">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
