import { Button } from "@/components/ui/button";
import { LayoutGrid, Briefcase, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewSelectorProps {
  current: string;
  onChange: (val: string) => void;
}

export function PreviewSelector({ current, onChange }: PreviewSelectorProps) {
  const options = [
    { id: 'command', label: 'Command', icon: LayoutGrid },
    { id: 'workspace', label: 'Workspace', icon: Briefcase },
    { id: 'nexus', label: 'Nexus', icon: Zap },
  ];

  return (
    <div className="bg-card/80 backdrop-blur-md border border-border p-1 rounded-full flex gap-1 shadow-xl">
      {options.map((opt) => (
        <Button
          key={opt.id}
          variant={current === opt.id ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-full h-8 text-[10px] font-bold uppercase px-4",
            current === opt.id ? "gradient-brand shadow-md" : "hover:bg-primary/10"
          )}
        >
          <opt.icon className="h-3 w-3 mr-2" />
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
