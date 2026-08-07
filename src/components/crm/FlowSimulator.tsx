import React, { useState } from "react";
import { Send, User, Bot, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function FlowSimulator({ flow }: { flow: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState("");
  const [currentState, setCurrentState] = useState<any>(null);

  const steps = flow?.steps || [];

  const startSimulator = () => {
    setMessages([]);
    const firstStep = steps[0];
    if (firstStep) {
      processStep(firstStep);
    }
  };

  const processStep = (step: any) => {
    if (!step) return;
    
    const payload = step.payload || {};
    setMessages(prev => [...prev, { role: "bot", text: payload.text }]);
    setCurrentState(step);
  };

  const handleSend = () => {
    if (!userInput.trim()) return;
    
    const userMsg = userInput.trim();
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setUserInput("");

    if (currentState?.step_key === 'options') {
      const option = currentState.payload.options?.find((o: any) => o.value === userMsg || o.label === userMsg);
      if (option) {
        const next = steps.find((s: any) => s.id === option.nextStepId);
        if (next) {
          setTimeout(() => processStep(next), 500);
          return;
        }
      }
    }

    // Default next if not options or no match
    const currentIdx = steps.findIndex((s: any) => s.id === currentState?.id);
    const next = steps[currentIdx + 1];
    if (next) {
      setTimeout(() => processStep(next), 500);
    }
  };

  return (
    <Card className="flex flex-col h-[500px] bg-muted/20 border-2 border-primary/20 shadow-xl rounded-2xl overflow-hidden">
      <div className="p-3 bg-primary text-primary-foreground flex justify-between items-center">
        <h4 className="text-sm font-bold flex items-center gap-2"><Bot className="h-4 w-4" /> Simulador de Fluxo</h4>
        <Button variant="ghost" size="sm" onClick={startSimulator} className="h-7 text-xs hover:bg-white/10"><RefreshCcw className="h-3 w-3 mr-2" /> Reiniciar</Button>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 mt-20">
            <RefreshCcw className="h-10 w-10 mb-4" />
            <p className="text-sm">Clique em reiniciar para testar</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((m, idx) => (
            <div key={idx} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] p-3 rounded-2xl text-xs",
                m.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border rounded-tl-none"
              )}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-card flex gap-2">
        <Input 
          placeholder="Simular resposta..." 
          value={userInput} 
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="h-8 text-xs"
        />
        <Button size="icon" className="h-8 w-8 rounded-lg" onClick={handleSend}><Send className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}
