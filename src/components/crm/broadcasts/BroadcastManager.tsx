import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Send, 
  Clock, 
  History, 
  Play, 
  Pause, 
  X, 
  ChevronRight, 
  Users, 
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useServerFn } from '@tanstack/react-start';
import { getBroadcasts, createBroadcast, startBroadcast, pauseBroadcast } from '@/lib/broadcasts.functions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function BroadcastManager() {
  const [activeTab, setActiveTab] = useState('list');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    message_template: '',
    allContacts: true
  });

  const fetchBroadcasts = useServerFn(getBroadcasts);
  const saveBroadcast = useServerFn(createBroadcast);
  const triggerBroadcast = useServerFn(startBroadcast);
  const stopBroadcast = useServerFn(pauseBroadcast);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchBroadcasts();
      setBroadcasts(data);
    } catch (err) {
      toast.error("Erro ao carregar disparos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!newCampaign.name || !newCampaign.message_template) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      await saveBroadcast({ 
        data: {
          name: newCampaign.name,
          message_template: newCampaign.message_template,
          filters: { allContacts: newCampaign.allContacts }
        }
      });
      toast.success("Campanha criada com sucesso");
      setIsCreateOpen(false);
      loadData();
    } catch (err) {
      toast.error("Erro ao criar campanha");
    }
  };

  const handleStart = async (id: string) => {
    try {
      await triggerBroadcast({ data: { id } });
      toast.success("Disparo iniciado");
      loadData();
    } catch (err) {
      toast.error("Erro ao iniciar disparo");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Rascunho</Badge>;
      case 'running': return <Badge className="bg-green-500">Em Execução</Badge>;
      case 'queued': return <Badge className="bg-blue-500">Na Fila</Badge>;
      case 'paused': return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pausado</Badge>;
      case 'completed': return <Badge className="bg-indigo-600">Concluído</Badge>;
      case 'failed': return <Badge variant="destructive">Falhou</Badge>;
      case 'cancelled': return <Badge variant="secondary">Cancelado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const calculateProgress = (b: any) => {
    if (b.total_contacts === 0) return 0;
    return Math.round(((b.sent_count + b.failed_count) / b.total_contacts) * 100);
  };

  return (
    <div className="flex flex-col h-full bg-background space-y-4 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Central de Disparos</h2>
          <p className="text-muted-foreground text-sm">Gerencie suas campanhas de WhatsApp em massa</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Disparo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="bg-card/50 backdrop-blur-sm border-indigo-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Send className="w-8 h-8 text-indigo-500 mb-2 opacity-50" />
            <span className="text-2xl font-bold">{broadcasts.filter(b => b.status === 'completed').length}</span>
            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Disparos Concluídos</span>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-green-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Play className="w-8 h-8 text-green-500 mb-2 opacity-50" />
            <span className="text-2xl font-bold">{broadcasts.filter(b => b.status === 'running').length}</span>
            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Em Execução</span>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-blue-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Users className="w-8 h-8 text-blue-500 mb-2 opacity-50" />
            <span className="text-2xl font-bold">{broadcasts.reduce((acc, b) => acc + b.total_contacts, 0)}</span>
            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Total Destinatários</span>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-red-500/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2 opacity-50" />
            <span className="text-2xl font-bold">{broadcasts.reduce((acc, b) => acc + b.failed_count, 0)}</span>
            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Falhas Totais</span>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 min-h-0 border-indigo-500/10">
        <Tabs defaultValue="all" className="h-full flex flex-col">
          <div className="px-4 py-2 border-b">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="running">Em Execução</TabsTrigger>
              <TabsTrigger value="scheduled">Agendadas</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="flex-1 m-0 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Métricas (E/F/L)</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && broadcasts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Carregando campanhas...
                      </TableCell>
                    </TableRow>
                  ) : broadcasts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Nenhuma campanha encontrada.
                      </TableCell>
                    </TableRow>
                  ) : broadcasts.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium">{b.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{b.message_template}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(b.status)}</TableCell>
                      <TableCell className="min-w-[150px]">
                        <div className="flex flex-col gap-1">
                          <Progress value={calculateProgress(b)} className="h-2" />
                          <span className="text-[10px] text-muted-foreground">{calculateProgress(b)}% ({b.sent_count + b.failed_count}/{b.total_contacts})</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[10px] border-green-500/20 text-green-600">{b.sent_count} E</Badge>
                          <Badge variant="outline" className="text-[10px] border-red-500/20 text-red-600">{b.failed_count} F</Badge>
                          <Badge variant="outline" className="text-[10px] border-blue-500/20 text-blue-600">{b.read_count} L</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(b.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.status === 'draft' && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-green-600 hover:text-green-700" onClick={() => handleStart(b.id)}>
                            <Play className="w-4 h-4 mr-1" /> Iniciar
                          </Button>
                        )}
                        {b.status === 'running' && (
                           <Button size="sm" variant="ghost" className="h-8 px-2 text-yellow-600 hover:text-yellow-700" onClick={() => toast("Ação indisponível")}>
                           <Pause className="w-4 h-4 mr-1" /> Pausar
                         </Button>
                        )}
                         <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Novo Disparo em Massa</DialogTitle>
            <DialogDescription>
              Personalize sua mensagem utilizando as variáveis disponiveis.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nome da Campanha</label>
              <Input 
                placeholder="Ex: Promoção Dia dos Pais" 
                value={newCampaign.name}
                onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
              />
            </div>
            
            <div className="grid gap-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Conteúdo da Mensagem</label>
                <div className="flex gap-2">
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => setNewCampaign({...newCampaign, message_template: newCampaign.message_template + '{{nome}}'})}>{"{{nome}}"}</Badge>
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => setNewCampaign({...newCampaign, message_template: newCampaign.message_template + '{{telefone}}'})}>{"{{telefone}}"}</Badge>
                </div>
              </div>
              <Textarea 
                className="min-h-[150px]"
                placeholder="Olá {{nome}}! Temos uma oferta para você..." 
                value={newCampaign.message_template}
                onChange={e => setNewCampaign({...newCampaign, message_template: e.target.value})}
              />
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-indigo-500/20">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> Preview WhatsApp
                </h4>
                <div className="text-sm italic text-muted-foreground bg-white/50 p-3 rounded shadow-sm border">
                    {newCampaign.message_template.replace('{{nome}}', 'João da Silva').replace('{{telefone}}', '5511999999999') || "Aguardando conteúdo..."}
                </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700">Criar e Enfileirar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
