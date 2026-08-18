import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCRMTemplates, saveCRMTemplate, deleteCRMTemplate } from "@/lib/atendimento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Search, MoreHorizontal, Edit3, Trash2, Copy, Eye, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function TemplateManager({ establishmentId }: { establishmentId: string }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");

  const { data: templates, isLoading } = useQuery({ 
    queryKey: ["crm-templates", establishmentId],
    queryFn: () => getCRMTemplates({ data: { establishmentId } })
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => saveCRMTemplate({ data: { ...data, establishmentId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-templates"] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      toast.success("Template salvo com sucesso");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) => deleteCRMTemplate({ data: { establishmentId, templateId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-templates"] });
      toast.success("Template excluído");
    }
  });

  const filteredTemplates = templates?.filter((t: any) => {
    const matchesSearch = (t.name?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "all" || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: "all", label: "Todos" },
    { id: "welcome", label: "Boas-vindas" },
    { id: "support", label: "Suporte" },
    { id: "sales", label: "Vendas" },
    { id: "marketing", label: "Marketing" },
    { id: "closing", label: "Finalização" }
  ];

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleDuplicate = (template: any) => {
    const data = {
      name: `${template.name} (Cópia)`,
      content: template.body,
      category: template.category,
      is_active: false
    };
    saveMutation.mutate(data);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      id: editingTemplate?.id,
      name: formData.get("name") as string,
      content: formData.get("content") as string,
      category: formData.get("category") as string,
      is_active: formData.get("is_active") === "on",
    };
    saveMutation.mutate(data);
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Search and Categories Bar */}
      <div className="p-6 border-b bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "crm-tab-trigger",
                activeCategory === cat.id && "bg-muted text-primary font-bold shadow-none border border-primary/20"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar em templates..." 
              className="pl-9 h-10 text-sm bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/20" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setEditingTemplate(null); }}>
            <DialogTrigger asChild>
              <button className="crm-button-primary">
                <Plus className="h-4 w-4" /> Novo Template
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl crm-enterprise-layout">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold tracking-tight">
                    {editingTemplate ? "Configurar Template" : "Criar Novo Template"}
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Defina mensagens padronizadas para comunicações empresariais rápidas.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider opacity-70">Nome Interno</Label>
                      <Input id="name" name="name" defaultValue={editingTemplate?.name} required placeholder="Ex: Protocolo Suporte" className="h-11 bg-muted/20 border-border/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider opacity-70">Categoria</Label>
                      <select 
                        id="category" 
                        name="category" 
                        defaultValue={editingTemplate?.category || "general"}
                        className="flex h-11 w-full rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
                      >
                        <option value="welcome">Boas-vindas</option>
                        <option value="support">Suporte</option>
                        <option value="sales">Vendas</option>
                        <option value="marketing">Marketing</option>
                        <option value="closing">Finalização</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content" className="text-xs font-bold uppercase tracking-wider opacity-70">Mensagem WhatsApp</Label>
                    <Textarea id="content" name="content" defaultValue={editingTemplate?.body} required rows={8} placeholder="Digite o conteúdo da mensagem..." className="bg-muted/20 border-border/50 resize-none leading-relaxed" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border/50">
                    <div className="space-y-0.5">
                      <Label htmlFor="is_active" className="text-sm font-bold">Template Disponível</Label>
                      <p className="text-xs text-muted-foreground">Define se o template aparecerá para a equipe de atendimento.</p>
                    </div>
                    <Switch id="is_active" name="is_active" defaultChecked={editingTemplate ? editingTemplate.is_active : true} />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-11 font-bold">Cancelar</Button>
                  <button type="submit" className="crm-button-primary h-11 px-8" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                    {editingTemplate ? "Salvar Alterações" : "Publicar Template"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 p-6 crm-scrollbar overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full opacity-40">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <span className="text-sm font-bold uppercase tracking-widest">Sincronizando Biblioteca...</span>
          </div>
        ) : filteredTemplates?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-muted rounded-2xl py-20 px-10 text-center max-w-2xl mx-auto">
            <FileText className="h-16 w-16 text-muted mb-6" />
            <h4 className="text-xl font-bold tracking-tight mb-2">Sem templates cadastrados</h4>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">Sua biblioteca de mensagens está vazia. Comece criando um template padrão para agilizar as respostas da equipe.</p>
            <button className="crm-button-primary" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Criar Primeiro Template
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTemplates?.map((t: any) => (
              <div key={t.id} className="crm-card group flex flex-col h-[320px] hover:shadow-lg hover:border-primary/20 transition-all duration-300">
                <div className="p-5 border-b shrink-0 flex items-start justify-between">
                  <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold truncate tracking-tight text-foreground">{t.name}</h4>
                      {t.is_active ? (
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-muted" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] font-bold uppercase px-1.5 py-0 border-border bg-muted/20 text-muted-foreground">{t.category}</Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleEdit(t)} className="font-medium text-xs"><Edit3 className="h-3.5 w-3.5 mr-2" /> Configurar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(t)} className="font-medium text-xs"><Copy className="h-3.5 w-3.5 mr-2" /> Duplicar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive font-medium text-xs" onClick={() => { if(confirm("Confirmar exclusão definitiva do template?")) deleteMutation.mutate(t.id); }}><Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="p-5 flex-1 overflow-hidden relative">
                  <div className="text-[13px] text-muted-foreground leading-relaxed italic whitespace-pre-wrap line-clamp-6">
                    "{t.body}"
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
                </div>

                <div className="p-3 border-t bg-muted/10 flex gap-2 shrink-0">
                  <button 
                    className="crm-button-secondary flex-1 h-9 text-[11px] font-bold uppercase tracking-wider" 
                    onClick={() => { setPreviewContent(t.body); setIsPreviewOpen(true); }}
                  >
                    <Eye className="h-3.5 w-3.5" /> Visualizar
                  </button>
                  <button className="crm-button-primary flex-1 h-9 text-[11px] font-bold uppercase tracking-wider">
                    <Send className="h-3.5 w-3.5" /> Enviar Teste
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-sm p-0 bg-transparent border-none shadow-none crm-enterprise-layout">
          <div className="bg-[#E5DDD5] w-full h-[600px] rounded-[40px] border-[10px] border-[#1C1C1C] overflow-hidden flex flex-col relative shadow-2xl">
            {/* WhatsApp Header Mockup */}
            <div className="bg-[#075E54] p-4 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-bold">Afidelize Oficial</div>
                <div className="text-white/70 text-[10px]">Empresarial</div>
              </div>
            </div>

            <div className="flex-1 p-4 flex flex-col justify-end gap-2 overflow-y-auto crm-scrollbar">
              <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-sm max-w-[90%] animate-in slide-in-from-left-4 duration-300">
                <p className="text-[13px] whitespace-pre-wrap text-[#111] leading-relaxed">{previewContent}</p>
                <div className="text-[9px] text-[#667781] text-right mt-1.5 flex items-center justify-end gap-1">
                  14:30 <span className="text-[#53bdeb]">✓✓</span>
                </div>
              </div>
            </div>

            <div className="bg-[#F0F0F0] p-3 flex items-center gap-2 shrink-0">
              <div className="flex-1 h-10 bg-white rounded-full border border-border/50 px-4 text-[13px] flex items-center text-muted-foreground shadow-sm">
                Mensagem
              </div>
              <div className="h-10 w-10 bg-[#075E54] rounded-full flex items-center justify-center text-white shadow-md">
                <Send className="h-4 w-4" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
