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
    <div className="bg-card/90 backdrop-blur-xl border border-primary/20 p-1 rounded-full flex gap-1 shadow-2xl ring-4 ring-primary/5">
      {options.map((opt) => (
        <Button
          key={opt.id}
          variant={current === opt.id ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-full h-8 text-[10px] font-black uppercase px-4 transition-all duration-300",
            current === opt.id 
              ? "gradient-brand shadow-lg scale-105 text-white" 
              : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
          )}
        >
          <opt.icon className={cn("h-3 w-3 mr-2", current === opt.id ? "animate-pulse" : "")} />
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
