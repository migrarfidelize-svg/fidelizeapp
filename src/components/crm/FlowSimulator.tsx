import React, { useMemo, useState } from "react";
import { Bot, RefreshCcw, User, UserCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SimulationMessage = { role: "bot" | "user" | "system"; text: string };

export function getSimulationTransition(step: any, steps: any[], optionValue?: string) {
  const type = step?.payload?.type || step?.step_key;
  if (type === "options") {
    const option = (step.payload?.options || []).find(
      (item: any) => item.value === optionValue || item.label === optionValue,
    );
    if (!option) return null;
    if (option.nextStepId === "transfer") return { terminal: "handoff" as const };
    return steps.find((candidate: any) => candidate.id === option.nextStepId) || null;
  }
  if (step?.payload?.nextStepId) {
    return steps.find((candidate: any) => candidate.id === step.payload.nextStepId) || null;
  }
  const index = steps.findIndex((candidate: any) => candidate.id === step?.id);
  return index >= 0 ? steps[index + 1] || null : null;
}

export function FlowSimulator({ flow, onClose }: { flow: any; onClose?: () => void }) {
  const steps = useMemo(
    () => [...(flow?.steps || [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [flow],
  );
  const [messages, setMessages] = useState<SimulationMessage[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [finished, setFinished] = useState(false);
  const append = (message: SimulationMessage) => setMessages((previous) => [...previous, message]);

  const visit = (step: any) => {
    if (!step) {
      append({ role: "system", text: "Fim do fluxo." });
      setFinished(true);
      setCurrent(null);
      return;
    }
    const type = step.payload?.type || step.step_key;
    setCurrent(step);
    if (step.payload?.text) append({ role: "bot", text: step.payload.text });
    if (type === "agent") {
      append({ role: "system", text: `Agent assumiria aqui, sem consumir IA. Contexto: ${step.payload?.context || "não informado"}` });
      setFinished(true);
    } else if (type === "transfer_to_queue") {
      append({ role: "system", text: "A conversa seria transferida para a fila humana." });
      setFinished(true);
    } else if (type === "close") {
      append({ role: "system", text: "A conversa seria encerrada." });
      setFinished(true);
    } else if (type !== "options") {
      const next = getSimulationTransition(step, steps);
      if (next) queueMicrotask(() => visit(next));
      else {
        append({ role: "system", text: "Fim do fluxo." });
        setFinished(true);
      }
    }
  };

  const start = () => {
    setMessages([]);
    setFinished(false);
    setCurrent(null);
    queueMicrotask(() => visit(steps[0]));
  };

  const choose = (option: any) => {
    append({ role: "user", text: option.label || option.value });
    const next = getSimulationTransition(current, steps, option.value);
    if ((next as any)?.terminal === "handoff") {
      append({ role: "system", text: "A conversa seria transferida diretamente para a fila humana." });
      setFinished(true);
      return;
    }
    queueMicrotask(() => visit(next));
  };

  const options = current?.payload?.type === "options" || current?.step_key === "options"
    ? current.payload?.options || []
    : [];

  return (
    <Card className="flex h-[560px] flex-col overflow-hidden rounded-2xl border-2 border-primary/20 bg-muted/20 shadow-xl">
      <div className="flex items-center justify-between bg-primary p-3 text-primary-foreground">
        <h4 className="flex items-center gap-2 text-sm font-bold"><Bot className="h-4 w-4" /> Simulação local</h4>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={start} className="h-7 text-xs hover:bg-white/10"><RefreshCcw className="mr-2 h-3 w-3" /> Reiniciar</Button>
          {onClose && <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 hover:bg-white/10" aria-label="Fechar simulador"><XCircle className="h-4 w-4" /></Button>}
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        {!messages.length && <div className="mt-20 text-center text-sm text-muted-foreground">Clique em Reiniciar para percorrer o fluxo sem WhatsApp ou IA.</div>}
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div key={index} className={cn("flex items-start gap-2", message.role === "user" && "justify-end")}>
              {message.role === "bot" && <Bot className="mt-2 h-4 w-4 text-primary" />}
              <div className={cn(
                "max-w-[85%] rounded-2xl p-3 text-xs",
                message.role === "user" ? "rounded-tr-none bg-primary text-primary-foreground" :
                message.role === "system" ? "mx-auto border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200" : "rounded-tl-none border bg-card",
              )}>{message.text}</div>
              {message.role === "user" && <User className="mt-2 h-4 w-4" />}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t bg-card p-3">
        {options.length > 0 && !finished ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((option: any, index: number) => <Button key={`${option.value}-${index}`} variant="outline" className="h-auto min-h-9 whitespace-normal text-xs" onClick={() => choose(option)}>{option.label || option.value || `Opção ${index + 1}`}</Button>)}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><UserCheck className="h-4 w-4" /> Nenhuma mensagem real será enviada.</div>
        )}
      </div>
    </Card>
  );
}
