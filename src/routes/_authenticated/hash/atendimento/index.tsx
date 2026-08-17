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
  getCRMEstablishments,
} from "@/lib/atendimento.functions";
import { useCRMRealtime } from "@/hooks/use-crm-realtime";
import { CRMEstablishmentContext } from "@/components/crm/CRMEstablishmentContext";
import { cn } from "@/lib/utils";
import { TemplateManager } from "@/components/crm/TemplateManager";
import { OTPEditor } from "@/components/crm/OTPEditor";
import { AgentConfig } from "@/components/crm/AgentConfig";
import { ContactManager } from "@/components/crm/ContactManager";
import { FlowEditor } from "@/components/crm/FlowEditor";
import { FlowsView } from "@/components/crm/FlowsView";
import { WhatsAppManager } from "@/components/crm/WhatsAppManager";

import { BroadcastManager } from "@/components/crm/broadcasts/BroadcastManager";
import { MessageSquare, Contact, UserCheck, GitBranch, FileText, Smartphone, Settings2, Moon, Sun, SendHorizontal, Bot, Headphones, Clock3, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/components/ThemeToggle";
import { getCRMConversationBadge, getCRMOperationalTab, type CRMOperationalTab } from "@/lib/crm/conversation-presentation";

export const Route = createFileRoute("/_authenticated/hash/atendimento/")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  useCRMRealtime();
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState("conversas");
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const establishments = useQuery({ queryKey: ["crm-establishments"], queryFn: () => getCRMEstablishments() });
  const [establishmentId, setEstablishmentId] = useState("");
  const selectedEstablishmentId = establishmentId || (establishments.data?.length === 1 ? establishments.data[0].id : "");
  
  const navItems = [
    { group: "Operação", items: [
      { id: "conversas", label: "Conversas", icon: MessageSquare },
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
            <select value={selectedEstablishmentId} onChange={(event) => setEstablishmentId(event.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value="">Selecione o estabelecimento</option>
              {(establishments.data || []).map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}</option>)}
            </select>
            <button onClick={toggle} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
        </div>
      </header>

      {/* Conteúdo CRM */}
      <CRMEstablishmentContext.Provider value={selectedEstablishmentId || null}>
      <main className="flex-1 overflow-hidden relative">
        {!selectedEstablishmentId ? <div className="grid h-full place-items-center text-sm text-muted-foreground">Selecione um estabelecimento com WhatsApp ativo.</div> :
        activeTab === "conversas" ? (
          <ConversationQueue establishmentId={selectedEstablishmentId} establishmentName={establishments.data?.find((item) => item.id === selectedEstablishmentId)?.name} />
        ) : (
          <div className="h-full overflow-y-auto p-8">
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
      </CRMEstablishmentContext.Provider>
    </div>
  );
}

function ConversationQueue({ establishmentId, establishmentName }: { establishmentId: string; establishmentName?: string }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [operation, setOperation] = useState<CRMOperationalTab>("open");
  const [body, setBody] = useState("");
  const conversations = useQuery({ queryKey: ["crm-conversations", establishmentId], queryFn: () => getCRMConversations({ data: { status: "all", establishment_id: establishmentId } }) });
  const selected = conversations.data?.find((item: any) => item.id === selectedId);
  const messages = useQuery({
    queryKey: ["crm-messages", selectedId],
    queryFn: () => getCRMConversationMessages({ data: { conversationId: selectedId!, establishment_id: establishmentId } }),
    enabled: !!selectedId,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ["crm-messages", selectedId] });
  };
  const send = useMutation({ mutationFn: () => sendCRMMessage({ data: { conversationId: selectedId!, body } }), onSuccess: () => { setBody(""); refresh(); } });
  const status = useMutation({ mutationFn: (value: "assigned" | "closed") => updateCRMConversationStatus({ data: { conversationId: selectedId!, status: value } }), onSuccess: refresh });
  const tabs: Array<{ id: CRMOperationalTab; label: string; icon: typeof Bot }> = [
    { id: "open", label: "EM ABERTO", icon: Bot }, { id: "assigned", label: "EM ATENDIMENTO", icon: Headphones },
    { id: "queue", label: "FILA", icon: Clock3 }, { id: "closed", label: "ENCERRADOS", icon: CheckCircle2 },
  ];
  const visible = (conversations.data || []).filter((item: any) => getCRMOperationalTab(item) === operation);
  const ticket = selected?.support_tickets?.find((item: any) => item.status !== "resolved" && item.status !== "closed") || selected?.support_tickets?.[0];
  const contact = selected?.contact;
  const badgeClass = (tone: string) => cn("rounded-full border px-2 py-0.5 text-[10px] font-black", tone === "success" && "border-green-500/40 bg-green-500/10 text-green-700", tone === "danger" && "border-red-500/40 bg-red-500/10 text-red-600", tone === "info" && "border-blue-500/40 bg-blue-500/10 text-blue-700", tone === "neutral" && "border-border bg-muted text-muted-foreground");
  return <div className="flex h-full min-h-0 flex-col bg-muted/20">
    <nav className="flex h-14 shrink-0 items-end gap-1 border-b bg-card px-5" aria-label="Estados das conversas">
      {tabs.map((tab) => { const count = (conversations.data || []).filter((item: any) => getCRMOperationalTab(item) === tab.id).length; return <button key={tab.id} onClick={() => { setOperation(tab.id); setSelectedId(undefined); }} className={cn("flex h-11 items-center gap-2 border-b-2 px-4 text-xs font-black tracking-wide", operation === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}><tab.icon className="h-4 w-4" />{tab.label}<span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{count}</span></button>; })}
    </nav>
    <div className="flex min-h-0 flex-1">
    <aside className="w-80 shrink-0 border-r bg-card overflow-y-auto">
      <div className="border-b px-4 py-3"><strong className="text-sm">{tabs.find((tab) => tab.id === operation)?.label}</strong><p className="text-xs text-muted-foreground">Conversas do estabelecimento selecionado</p></div>
      {visible.map((conversation: any) => {
        const badge = getCRMConversationBadge(conversation);
        const last = [...(conversation.messages || [])].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        const unread = Number(conversation.metadata?.unread_count || 0);
        return <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={cn("w-full border-b p-4 text-left transition-colors hover:bg-muted/50", selectedId === conversation.id && "border-l-4 border-l-primary bg-primary/5") }>
          <div className="flex justify-between gap-2"><strong className="truncate text-sm">{conversation.contact?.name || conversation.customer_name || conversation.customer_phone}</strong><span className="text-[10px] text-muted-foreground">{last?.created_at ? new Date(last.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span></div>
          {(conversation.contact?.name || conversation.customer_name) && <p className="text-[11px] text-muted-foreground">{conversation.customer_phone}</p>}
          <p className="my-2 truncate text-xs text-muted-foreground">{last?.body || "Nova conversa"}</p>
          <div className="flex items-center gap-1.5"><span className="rounded-full border bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-700">WhatsApp</span><span className={badgeClass(badge.tone)}>{badge.label}</span>{unread > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread}</span>}</div>
        </button>;
      })}
      {!conversations.isLoading && !visible.length && <p className="p-8 text-center text-xs text-muted-foreground">Nenhuma conversa neste estado.</p>}
    </aside>
    <section className="flex min-w-0 flex-1 flex-col">
      {!selected ? <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Selecione uma conversa.</div> : <>
        <header className="flex h-16 items-center justify-between border-b bg-card px-5">
          <div><strong>{contact?.name || selected.customer_name || selected.customer_phone}</strong><p className="text-xs text-muted-foreground">{selected.customer_phone}</p></div>
          <div className="flex gap-2">{selected.status === "waiting" && <button onClick={() => status.mutate("assigned")} className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Assumir atendimento</button>}{selected.status !== "closed" && selected.status !== "bot" && <button onClick={() => status.mutate("closed")} className="rounded-md border px-3 py-2 text-xs font-bold">Resolver</button>}</div>
        </header>
        {selected.status === "bot" && <div className="border-b border-green-500/30 bg-green-500/10 px-5 py-2 text-xs font-medium text-green-700">IA está atendendo esta conversa.</div>}
        {selected.status === "waiting" && <div className="border-b border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-medium text-red-700">Cliente aguardando atendimento humano.</div>}
        {selected.status === "assigned" && <div className="border-b border-blue-500/30 bg-blue-500/10 px-5 py-2 text-xs font-medium text-blue-700">Atendimento humano em andamento.</div>}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">{(messages.data || []).map((message: any) => <div key={`${message.type}-${message.id}`} className={cn("max-w-[75%] rounded-lg p-3 text-sm", message.direction === "outbound" ? "ml-auto bg-primary text-primary-foreground" : message.direction === "internal" ? "mx-auto bg-amber-500/10" : "bg-muted")}>{message.body || message.content}</div>)}</div>
        <footer className="flex gap-2 border-t bg-card p-3"><textarea disabled={selected.status !== "assigned"} value={body} onChange={(event) => setBody(event.target.value)} className="min-h-12 flex-1 rounded-md border bg-background p-2 text-sm disabled:cursor-not-allowed disabled:opacity-60" placeholder={selected.status === "assigned" ? "Responder pelo WhatsApp..." : "Assuma o atendimento para responder"} /><button disabled={selected.status !== "assigned" || !body.trim() || send.isPending} onClick={() => send.mutate()} className="rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Enviar</button></footer>
      </>}
    </section>
    {selected && <aside className="hidden w-72 shrink-0 overflow-y-auto border-l bg-card p-5 xl:block"><h3 className="mb-5 text-xs font-black uppercase tracking-widest">Contato e contexto</h3><dl className="space-y-4 text-xs">{[["Nome", contact?.name || selected.customer_name], ["Telefone", selected.customer_phone], ["E-mail", contact?.email], ["Estabelecimento", establishmentName], ["Origem / canal", "WhatsApp"], ["Status", getCRMConversationBadge(selected).label], ["Responsável", selected.assigned_to], ["Ticket de suporte", ticket ? `${ticket.status} · ${ticket.id}` : undefined], ["Início", selected.created_at ? new Date(selected.created_at).toLocaleString("pt-BR") : undefined], ["Último atendimento", selected.last_message_at ? new Date(selected.last_message_at).toLocaleString("pt-BR") : undefined]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="font-bold text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-foreground">{value}</dd></div>)}</dl></aside>}
    </div>
  </div>;
}
