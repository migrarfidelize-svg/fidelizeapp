import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCRMTemplates, saveCRMTemplate, deleteCRMTemplate } from "@/lib/atendimento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { FileText, Plus, Search, MoreHorizontal, Edit3, Trash2, Copy, Eye, Send, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export function TemplateManager() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");

  const { data: templates, isLoading } = useQuery({ 
    queryKey: ["crm-templates"], 
    queryFn: () => getCRMTemplates() 
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => saveCRMTemplate({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-templates"] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      toast.success("Template salvo com sucesso");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) => deleteCRMTemplate({ data: { templateId } }),
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
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div className="space-y-1">
            <h3 className="text-lg font-bold">Templates de Mensagem</h3>
            <p className="text-xs text-muted-foreground">Padronize o atendimento com templates pré-definidos.</p>
         </div>
         
         <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar template..." 
                    className="pl-9 h-10 text-xs" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setEditingTemplate(null); }}>
                <DialogTrigger asChild>
                    <Button className="gradient-brand shadow-lg shadow-primary/20 h-10">
                        <Plus className="h-4 w-4 mr-2" /> Novo Template
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
                            <DialogDescription>
                                Crie mensagens padronizadas para agilizar seu atendimento.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome do Template</Label>
                                    <Input id="name" name="name" defaultValue={editingTemplate?.name} required placeholder="Ex: Boas-vindas" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Categoria</Label>
                                    <select 
                                        id="category" 
                                        name="category" 
                                        defaultValue={editingTemplate?.category || "general"}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="welcome">Boas-vindas (Geral)</option>
                                        <option value="support">Suporte</option>
                                        <option value="sales">Vendas</option>
                                        <option value="marketing">Marketing</option>
                                        <option value="transfer">Transferência</option>
                                        <option value="off_hours">Fora de Horário</option>
                                        <option value="closing">Finalização</option>
                                        <option value="followup">Retorno</option>
                                        <option value="finance">Financeiro</option>
                                        <option value="custom">Personalizado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="content">Conteúdo da Mensagem</Label>
                                <Textarea id="content" name="content" defaultValue={editingTemplate?.body} required rows={6} placeholder="Digite a mensagem aqui..." />
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch id="is_active" name="is_active" defaultChecked={editingTemplate ? editingTemplate.is_active : true} />
                                <Label htmlFor="is_active">Template Ativo</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="gradient-brand" disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                                {editingTemplate ? "Salvar Alterações" : "Criar Template"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
         </div>
       </div>

       <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
         <TabsList className="bg-muted/50 p-1 rounded-xl w-fit">
           <TabsTrigger value="all" className="text-[10px] uppercase font-bold px-4 py-1.5 h-auto">Todos</TabsTrigger>
            <TabsTrigger value="welcome" className="text-[10px] uppercase font-bold px-4 py-1.5 h-auto">Geral</TabsTrigger>
            <TabsTrigger value="support" className="text-[10px] uppercase font-bold px-4 py-1.5 h-auto">Suporte</TabsTrigger>
            <TabsTrigger value="sales" className="text-[10px] uppercase font-bold px-4 py-1.5 h-auto">Vendas</TabsTrigger>
            <TabsTrigger value="marketing" className="text-[10px] uppercase font-bold px-4 py-1.5 h-auto">Marketing</TabsTrigger>
            
         </TabsList>

         <div className="mt-6">
            {isLoading ? (
                <div className="text-center py-20 opacity-50">Carregando templates...</div>
            ) : filteredTemplates?.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl">
                    <FileText className="h-12 w-12 text-primary opacity-20 mx-auto mb-4" />
                    <h4 className="font-bold">Nenhum template encontrado</h4>
                    <p className="text-xs text-muted-foreground">Crie seu primeiro template clicando no botão acima.</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates?.map((t: any) => (
                        <Card key={t.id} className="dash-card overflow-hidden hover:border-primary/40 transition-all group flex flex-col">
                            <CardHeader className="p-4 flex flex-row justify-between items-start space-y-0">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-sm font-bold truncate max-w-[150px]">{t.name}</CardTitle>
                                        {t.is_active ? (
                                            <Badge variant="outline" className="text-[8px] uppercase text-green-600 border-green-200 bg-green-50">Ativo</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[8px] uppercase text-muted-foreground border-border">Inativo</Badge>
                                        )}
                                    </div>
                                    <Badge variant="secondary" className="text-[9px] uppercase px-1.5">{t.category}</Badge>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEdit(t)}><Edit3 className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDuplicate(t)}><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive" onClick={() => { if(confirm("Excluir este template?")) deleteMutation.mutate(t.id); }}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 flex-1">
                                <div className="bg-muted/30 p-3 rounded-xl border border-border/50 text-[11px] line-clamp-4 min-h-[80px] text-muted-foreground leading-relaxed italic">
                                    "{t.body}"
                                </div>
                            </CardContent>
                            <CardFooter className="p-2 border-t border-border/40 flex gap-2">
                                <Button 
                                    variant="ghost" 
                                    className="flex-1 text-[10px] h-8 font-bold" 
                                    onClick={() => { setPreviewContent(t.body); setIsPreviewOpen(true); }}
                                >
                                    <Eye className="h-3.5 w-3.5 mr-2" /> Preview
                                </Button>
                                <Button variant="ghost" className="flex-1 text-[10px] h-8 font-bold text-primary">
                                    <Send className="h-3.5 w-3.5 mr-2" /> Testar
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
         </div>
       </Tabs>

       <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-sm p-0 overflow-hidden bg-transparent border-0 shadow-none">
                <div className="bg-[#E5DDD5] p-6 h-[500px] flex flex-col relative rounded-3xl overflow-hidden border-8 border-black">
                    <div className="flex-1 flex flex-col justify-end">
                        <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-sm max-w-[85%] relative animate-in slide-in-from-left-4 duration-300">
                            <div className="absolute -left-2 top-0 w-0 h-0 border-t-[8px] border-t-white border-l-[8px] border-l-transparent"></div>
                            <p className="text-[12px] whitespace-pre-wrap text-black">{previewContent}</p>
                            <div className="text-[9px] text-muted-foreground text-right mt-1">10:45</div>
                        </div>
                    </div>
                    <div className="h-16 bg-[#F0F0F0] mt-4 -mx-6 -mb-6 flex items-center px-4 gap-3">
                        <div className="h-8 flex-1 bg-white rounded-full border border-border/50 px-4 text-[10px] flex items-center text-muted-foreground">Digite uma mensagem...</div>
                        <div className="h-9 w-9 bg-[#075E54] rounded-full flex items-center justify-center text-white shadow-md">
                            <Send className="h-4 w-4" />
                        </div>
                    </div>
                </div>
            </DialogContent>
       </Dialog>
    </div>
  );
}