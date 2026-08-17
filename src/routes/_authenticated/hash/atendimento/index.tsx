import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  getCRMStats,
  getWhatsAppInstanceStatus,
  getCRMConversations,
  getCRMConversationMessages,
  sendCRMMessage,
  updateCRMConversationStatus,
} from "@/lib/atendimento.functions";
import { useCRMRealtime } from "@/hooks/use-crm-realtime";
import { cn } from "@/lib/utils";
import { TemplateManager } from "@/components/crm/TemplateManager";
import { OTPEditor } from "@/components/crm/OTPEditor";
import { AgentConfig } from "@/components/crm/AgentConfig";
import { ContactManager } from "@/components/crm/ContactManager";
import { FlowEditor } from "@/components/crm/FlowEditor";
import { FlowsView } from "@/components/crm/FlowsView";
import { WhatsAppManager } from "@/components/crm/WhatsAppManager";

import { BroadcastManager } from "@/components/crm/broadcasts/BroadcastManager";
import { MessageSquare, History, Contact, UserCheck, GitBranch, FileText, Smartphone, Settings2, Moon, Sun, Search, Bell, Plus, Filter, SendHorizontal } from "lucide-react";
import { useTheme } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/hash/atendimento/")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  useCRMRealtime();
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState("conversas");
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  
  const navItems = [
    { group: "Operação", items: [
      { id: "conversas", label: "Conversas", icon: MessageSquare },
      { id: "fila", label: "Fila", icon: History },
      { id: "contatos", label: "Contatos", icon: Contact },
      { id: "disparos", label: "Disparos", icon: SendHorizontal },
    ]},
    { group: "Automação", items: [
      { id: "agente", label: "Agente", icon: UserCheck },
      { id: "fluxos", label: "Fluxos", icon: GitBranch, subId: "fluxos_editor" },
    ]},
    { group: "Comunicação", items: [
      { id: "templates", label: "Templates", icon: FileText },
      { id: "otp", label: "OTP", icon: MessageSquare },
      { id: "whatsapp", label: "WhatsApp", icon: Smartphone },
    ]},
    { group: "Sistema", items: [
      { id: "config", label: "Configurações", icon: Settings2 },
    ]},
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Object Dock Superior */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center h-full gap-6">
          {navItems.map((group, gIdx) => (
            <div key={group.group} className="flex items-center gap-1 h-full">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSelectedFlow(null); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all border border-transparent",
                    activeTab === item.id 
                      ? "bg-primary/10 text-primary border-primary/20 shadow-sm" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
              {gIdx < navItems.length - 1 && <div className="w-[1px] h-4 bg-border mx-2" />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
            <button onClick={toggle} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
        </div>
      </header>

      {/* Conteúdo CRM */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === "conversas" ? (
          <ConversationQueue />
        ) : (
          <div className="h-full overflow-y-auto p-8">
            {activeTab === "fila" && <p>Visualização de Fila</p>}
            {activeTab === "contatos" && <ContactManager />}
            {activeTab === "disparos" && <BroadcastManager />}
            {activeTab === "agente" && <AgentConfig />}
            {activeTab === "fluxos" && (
              <FlowsView 
                onEdit={(flow) => {
                  setSelectedFlow(flow);
                  setActiveTab("fluxos_editor");
                }} 
              />
            )}
            {activeTab === "fluxos_editor" && (
              <FlowEditor 
                flow={selectedFlow} 
                onBack={() => { 
                  setActiveTab("fluxos"); 
                  setSelectedFlow(null); 
                }} 
              />
            )}


            {activeTab === "templates" && <TemplateManager />}
            {activeTab === "otp" && <OTPEditor />}
            {activeTab === "whatsapp" && <WhatsAppManager />}
            {activeTab === "config" && <p>Configurações de atendimento</p>}
          </div>
        )}
      </main>
    </div>
  );
}

function ConversationQueue() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [body, setBody] = useState("");
  const conversations = useQuery({ queryKey: ["crm-conversations"], queryFn: () => getCRMConversations({ data: { status: "all" } }) });
  const selected = conversations.data?.find((item: any) => item.id === selectedId);
  const messages = useQuery({
    queryKey: ["crm-messages", selectedId],
    queryFn: () => getCRMConversationMessages({ data: { conversationId: selectedId! } }),
    enabled: !!selectedId,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ["crm-messages", selectedId] });
  };
  const send = useMutation({ mutationFn: () => sendCRMMessage({ data: { conversationId: selectedId!, body } }), onSuccess: () => { setBody(""); refresh(); } });
  const status = useMutation({ mutationFn: (value: "assigned" | "closed") => updateCRMConversationStatus({ data: { conversationId: selectedId!, status: value } }), onSuccess: refresh });
  const supportActive = Boolean((selected?.metadata as any)?.support?.active);
  return <div className="flex h-full w-full">
    <aside className="w-80 border-r bg-card overflow-y-auto">
      <div className="h-12 border-b flex items-center px-4 gap-2"><Search className="h-4 w-4" /><span className="text-xs">Fila de atendimento</span></div>
      {(conversations.data || []).map((conversation: any) => {
        const support = Boolean(conversation.metadata?.support?.active);
        const last = [...(conversation.messages || [])].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        return <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={cn("w-full border-b p-3 text-left", selectedId === conversation.id && "bg-muted") }>
          <div className="flex justify-between gap-2"><strong className="text-sm">{conversation.customer_phone}</strong>{support && <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-black text-red-600">SUPORTE</span>}</div>
          <p className="truncate text-xs text-muted-foreground">{last?.body || "Nova conversa"}</p>
          <span className="text-[10px] uppercase text-muted-foreground">{conversation.status}</span>
        </button>;
      })}
      {!conversations.isLoading && !conversations.data?.length && <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma conversa.</p>}
    </aside>
    <section className="flex min-w-0 flex-1 flex-col">
      {!selected ? <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Selecione uma conversa.</div> : <>
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div><strong>{selected.customer_phone}</strong>{supportActive && <span className="ml-3 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-1 text-xs font-black text-red-600">SUPORTE</span>}</div>
          <div className="flex gap-2">{selected.status === "waiting" && <button onClick={() => status.mutate("assigned")} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Assumir</button>}<button onClick={() => status.mutate("closed")} className="rounded border px-3 py-1 text-xs">Resolver</button></div>
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">{(messages.data || []).map((message: any) => <div key={`${message.type}-${message.id}`} className={cn("max-w-[75%] rounded-lg p-3 text-sm", message.direction === "outbound" ? "ml-auto bg-primary text-primary-foreground" : message.direction === "internal" ? "mx-auto bg-amber-500/10" : "bg-muted")}>{message.body || message.content}</div>)}</div>
        <footer className="flex gap-2 border-t p-3"><textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-12 flex-1 rounded border bg-background p-2 text-sm" placeholder="Responder pelo WhatsApp..." /><button disabled={!body.trim() || send.isPending} onClick={() => send.mutate()} className="rounded bg-primary px-4 text-sm text-primary-foreground">Enviar</button></footer>
      </>}
    </section>
  </div>;
}
