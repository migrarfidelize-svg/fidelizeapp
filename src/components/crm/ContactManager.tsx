import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCRMContacts, saveCRMContact, deleteCRMContact } from "@/lib/atendimento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, User, Trash2, Tag, Search, MoreHorizontal, Phone, Mail, Archive, UserPlus, Send, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div className="space-y-1">
            <h3 className="text-lg font-bold">Diretório de Contatos</h3>
            <p className="text-xs text-muted-foreground">Gerencie contatos manuais e leads do WhatsApp.</p>
         </div>
         
         <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar nome ou telefone..." 
                    className="pl-9 h-10 text-xs" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setEditingContact(null); }}>
                <DialogTrigger asChild>
                    <Button className="gradient-brand shadow-lg shadow-primary/20 h-10">
                        <UserPlus className="h-4 w-4 mr-2" /> Novo Contato
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato Manual"}</DialogTitle>
                            <DialogDescription>
                                Preencha as informações do contato. Contatos manuais não criam conta de usuário no sistema.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome Completo</Label>
                                <Input id="name" name="name" defaultValue={editingContact?.name} required placeholder="Ex: João Silva" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">WhatsApp / Telefone</Label>
                                <Input id="phone" name="phone" defaultValue={editingContact?.phone} required placeholder="Ex: 5511999999999" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail (Opcional)</Label>
                                <Input id="email" name="email" type="email" defaultValue={editingContact?.email} placeholder="joao@exemplo.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Notas / Observações</Label>
                                <Textarea id="notes" name="notes" defaultValue={editingContact?.notes} placeholder="Informações adicionais sobre o contato..." />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="gradient-brand" disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                {editingContact ? "Salvar Alterações" : "Criar Contato"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
         </div>
       </div>

       <div className="grid gap-4">
         {isLoading ? (
            <div className="text-center py-20 opacity-50">Carregando contatos...</div>
         ) : filteredContacts?.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl">
                <div className="bg-primary/10 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="h-8 w-8 text-primary opacity-40" />
                </div>
                <h4 className="font-bold text-foreground">Nenhum contato encontrado</h4>
                <p className="text-xs text-muted-foreground mt-1">Tente ajustar sua busca ou adicione um novo contato manual.</p>
            </div>
         ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts?.map((c: any) => (
                    <Card key={c.id} className="dash-card overflow-hidden hover:border-primary/40 transition-all group">
                        <div className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                    <User className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex gap-1">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                            <DropdownMenuItem onClick={() => handleEdit(c)}>
                                                <Edit3 className="h-4 w-4 mr-2" /> Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => { if(confirm("Excluir este contato?")) deleteMutation.mutate(c.id); }}>
                                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h4 className="font-bold text-sm truncate">{c.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3" /> {c.phone}
                                </div>
                                {c.email && (
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                        <Mail className="h-3 w-3" /> {c.email}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-1 min-h-[20px]">
                                {c.tags?.map((t: any) => (
                                    <Badge key={t.tag.id} variant="secondary" className="text-[8px] uppercase px-1.5 h-4 bg-muted/50 border-border/50">
                                        {t.tag.name}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div className="bg-muted/30 p-2 flex gap-2 border-t border-border/40">
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                className="flex-1 text-[10px] h-7 font-bold uppercase tracking-wider"
                                onClick={() => {
                                    // Iniciar conversa via WhatsApp logic
                                    // No CRM real, isso criaria uma conversa se não existisse
                                    toast.info("Iniciando conversa no CRM...");
                                    if(onSelectConversation) onSelectConversation(c);
                                }}
                            >
                                <Send className="h-3 w-3 mr-2" /> Iniciar Conversa
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
         )}
       </div>
    </div>
  );
}