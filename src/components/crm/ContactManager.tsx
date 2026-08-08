import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCRMContacts, saveCRMContact, deleteCRMContact } from "@/lib/atendimento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { User, Trash2, Search, MoreHorizontal, Phone, Mail, UserPlus, Send, Loader2, Edit3, Filter, Tag } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ContactManager({ onSelectConversation }: { onSelectConversation?: (contact: any) => void }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);

  const { data: contacts, isLoading } = useQuery({ 
    queryKey: ["crm-contacts"], 
    queryFn: () => getCRMContacts() 
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => saveCRMContact({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      setIsDialogOpen(false);
      setEditingContact(null);
      toast.success("Contato salvo com sucesso");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (contactId: string) => deleteCRMContact({ data: { contactId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast.success("Contato excluído");
    }
  });

  const filteredContacts = contacts?.filter((c: any) => 
    (c.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
    (c.phone?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const handleEdit = (contact: any) => {
    setEditingContact(contact);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      id: editingContact?.id,
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || null,
      notes: (formData.get("notes") as string) || null,
    };
    saveMutation.mutate(data);
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Barra de Ações Superior */}
      <div className="p-6 border-b bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar por nome, WhatsApp ou e-mail..." 
              className="pl-9 h-11 text-sm bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/20" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="crm-button-secondary h-11 px-4">
            <Filter className="h-4 w-4" />
          </button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setEditingContact(null); }}>
          <DialogTrigger asChild>
            <button className="crm-button-primary px-8">
              <UserPlus className="h-4 w-4" /> Novo Contato
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-lg crm-enterprise-layout">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {editingContact ? "Configurar Cadastro" : "Cadastro Manual de Lead"}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Insira os dados cadastrais do cliente para gestão no CRM.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider opacity-70">Nome Completo</Label>
                  <Input id="name" name="name" defaultValue={editingContact?.name} required placeholder="Ex: Rodrigo Oliveira" className="h-11 bg-muted/20 border-border/50 font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider opacity-70">WhatsApp</Label>
                    <Input id="phone" name="phone" defaultValue={editingContact?.phone} required placeholder="5511999999999" className="h-11 bg-muted/20 border-border/50 font-medium" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider opacity-70">E-mail (Institucional)</Label>
                    <Input id="email" name="email" type="email" defaultValue={editingContact?.email} placeholder="rodrigo@empresa.com" className="h-11 bg-muted/20 border-border/50 font-medium" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-wider opacity-70">Observações Operacionais</Label>
                  <Textarea id="notes" name="notes" defaultValue={editingContact?.notes} placeholder="Notas internas sobre o perfil ou histórico do cliente..." className="bg-muted/20 border-border/50 resize-none min-h-[100px]" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-11 font-bold">Cancelar</Button>
                <button type="submit" className="crm-button-primary px-8 h-11" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  {editingContact ? "Salvar Cadastro" : "Confirmar Cadastro"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabela de Contatos Estilo Enterprise */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="crm-table-header flex shrink-0">
          <div className="w-12 px-4"></div>
          <div className="flex-1 px-4">Nome do Cliente</div>
          <div className="w-48 px-4">WhatsApp</div>
          <div className="w-64 px-4">Tags / Perfil</div>
          <div className="w-40 px-4">Ações</div>
        </div>

        <div className="flex-1 overflow-y-auto crm-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full opacity-40 py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <span className="text-sm font-bold uppercase tracking-widest text-foreground">Sincronizando Base de Clientes...</span>
            </div>
          ) : filteredContacts?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-20">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <User className="h-10 w-10 text-muted-foreground opacity-30" />
              </div>
              <h4 className="text-xl font-bold tracking-tight text-foreground">Base de dados vazia</h4>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">Nenhum registro encontrado para os critérios informados.</p>
            </div>
          ) : (
            filteredContacts?.map((c: any) => (
              <div key={c.id} className="crm-table-row group">
                <div className="w-12 px-4 shrink-0">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 px-4 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{c.name}</div>
                  {c.email && <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>}
                </div>
                <div className="w-48 px-4 font-mono text-xs text-muted-foreground flex items-center gap-2">
                  <Phone className="h-3 w-3 opacity-40" /> {c.phone}
                </div>
                <div className="w-64 px-4 flex flex-wrap gap-1">
                  {c.tags?.length > 0 ? (
                    c.tags.map((t: any) => (
                      <Badge key={t.tag.id} variant="outline" className="text-[9px] uppercase px-1.5 h-4 border-primary/20 bg-primary/5 text-primary font-bold">
                        {t.tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic opacity-50">Sem tags</span>
                  )}
                </div>
                <div className="w-40 px-4 flex items-center gap-2 justify-end">
                  <button 
                    onClick={() => {
                        toast.info("Acessando terminal de conversa...");
                        if(onSelectConversation) onSelectConversation(c);
                    }}
                    className="crm-button-secondary h-8 px-3 text-[10px] font-black uppercase tracking-widest text-primary border-primary/20 hover:bg-primary/5 transition-all"
                  >
                    <Send className="h-3 w-3 mr-1.5" /> Chat
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-all">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleEdit(c)} className="text-xs font-bold uppercase tracking-tight py-2.5">
                        <Edit3 className="h-3.5 w-3.5 mr-2 opacity-50" /> Configurar Cadastro
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive text-xs font-bold uppercase tracking-tight py-2.5" onClick={() => { if(confirm("Confirmar exclusão definitiva do registro?")) deleteMutation.mutate(c.id); }}>
                        <Trash2 className="h-3.5 w-3.5 mr-2 opacity-50" /> Excluir Registro
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer com Metadados da Tabela */}
        <div className="p-4 border-t bg-muted/20 flex justify-between items-center shrink-0">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
            Total de registros: {filteredContacts?.length || 0}
          </div>
        </div>
      </div>
    </div>
  );
}
