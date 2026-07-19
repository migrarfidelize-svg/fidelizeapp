import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SuccessStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function SuccessState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: SuccessStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-primary/20 bg-primary/5 px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20"
      >
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div className="space-y-1 max-w-md">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
