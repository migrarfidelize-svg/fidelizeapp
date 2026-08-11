import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicSeo, saveSeoConfig } from "@/lib/seo.functions";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Globe, 
  Search, 
  Share2, 
  Smartphone, 
  Map, 
  ShieldAlert, 
  Save, 
  Eye, 
  RefreshCw,
  Plus,
  Trash2,
  Check,
  X,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/hash/seo")({
  component: SeoAdmin,
});

function SeoAdmin() {
  const getSeo = useServerFn(getPublicSeo);
  const saveSeo = useServerFn(saveSeoConfig);
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["seo-config"],
    queryFn: () => getSeo(),
  });

  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (config) {
      setFormData(JSON.parse(JSON.stringify(config)));
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (data: any) => saveSeo({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-config"] });
      toast.success("Configurações de SEO salvas com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message);
    }
  });

  if (isLoading || !formData) return <div className="p-8">Carregando...</div>;

  const handleGeneralChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleRouteChange = (path: string, field: string, value: any) => {
    setFormData((prev: any) => {
      const routes = { ...prev.routes };
      if (!routes[path]) routes[path] = {};
      routes[path] = { ...routes[path], [field]: value };
      return { ...prev, routes };
    });
  };

  const addNewRoute = () => {
    const path = prompt("Digite o caminho da rota (ex: /sobre):");
    if (path && path.startsWith("/")) {
      handleRouteChange(path, "title", "");
    }
  };

  const removeRoute = (path: string) => {
    if (confirm(`Remover configurações da rota ${path}?`)) {
      setFormData((prev: any) => {
        const routes = { ...prev.routes };
        delete routes[path];
        return { ...prev, routes };
      });
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">SEO & Identidade</h2>
          <p className="text-muted-foreground">
            Central de controle para presença no Google, redes sociais e PWA.
          </p>
        </div>
        <Button 
          className="gradient-brand" 
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(formData)}
        >
          {mutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Alterações
        </Button>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-sm text-amber-600 dark:text-amber-400">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <p>
          Essas configurações definem os metadados fornecidos pelo Afidelize. 
          Navegadores e mecanismos de busca podem manter cache ou apresentar variações.
        </p>
      </div>

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="geral"><Globe className="mr-2 h-4 w-4" />Geral</TabsTrigger>
          <TabsTrigger value="rotas"><Map className="mr-2 h-4 w-4" />Rotas</TabsTrigger>
          <TabsTrigger value="pwa"><Smartphone className="mr-2 h-4 w-4" />PWA</TabsTrigger>
          <TabsTrigger value="preview"><Eye className="mr-2 h-4 w-4" />Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/60 bg-card/50">
              <CardHeader>
                <CardTitle>Configurações Principais</CardTitle>
                <CardDescription>Identidade básica da plataforma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Plataforma</Label>
                  <Input 
                    value={formData.platformName} 
                    onChange={e => handleGeneralChange("platformName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Título Padrão (Fallback)</Label>
                  <Input 
                    value={formData.defaultTitle} 
                    onChange={e => handleGeneralChange("defaultTitle", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição Padrão</Label>
                  <Textarea 
                    value={formData.defaultDescription} 
                    onChange={e => handleGeneralChange("defaultDescription", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Principal</Label>
                  <Input 
                    value={formData.siteUrl} 
                    onChange={e => handleGeneralChange("siteUrl", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/50">
              <CardHeader>
                <CardTitle>Visual & Assets</CardTitle>
                <CardDescription>Links para ícones e imagens sociais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Favicon URL</Label>
                  <Input 
                    value={formData.faviconUrl} 
                    onChange={e => handleGeneralChange("faviconUrl", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Logo (SEO)</Label>
                  <Input 
                    value={formData.logoUrl} 
                    onChange={e => handleGeneralChange("logoUrl", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Imagem de Compartilhamento (OG)</Label>
                  <Input 
                    value={formData.socialImageUrl} 
                    onChange={e => handleGeneralChange("socialImageUrl", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor do Tema (Hex)</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={formData.themeColor} 
                      onChange={e => handleGeneralChange("themeColor", e.target.value)}
                    />
                    <div 
                      className="w-10 h-10 rounded border" 
                      style={{ backgroundColor: formData.themeColor }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rotas" className="space-y-6">
          <Card className="border-border/60 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>SEO por Rota</CardTitle>
                <CardDescription>Controle individual para cada página pública</CardDescription>
              </div>
              <Button onClick={addNewRoute} size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Adicionar Rota
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(formData.routes).map(([path, data]: [string, any]) => (
                  <div key={path} className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-sm font-bold text-primary">
                        <Map className="h-4 w-4" /> {path}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Indexar</Label>
                          <Switch 
                            checked={!data.noindex} 
                            onCheckedChange={val => handleRouteChange(path, "noindex", !val)}
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeRoute(path)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Título da Página</Label>
                        <Input 
                          placeholder="Usar padrão..."
                          value={data.title || ""} 
                          onChange={e => handleRouteChange(path, "title", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Descrição</Label>
                        <Input 
                          placeholder="Usar padrão..."
                          value={data.description || ""} 
                          onChange={e => handleRouteChange(path, "description", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pwa" className="space-y-6">
          <Card className="border-border/60 bg-card/50 max-w-2xl">
            <CardHeader>
              <CardTitle>PWA & Manifest</CardTitle>
              <CardDescription>Como o Afidelize aparece quando instalado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Curto (Short Name)</Label>
                <Input 
                  value={formData.shortName} 
                  onChange={e => handleGeneralChange("shortName", e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Usado abaixo do ícone na tela inicial.</p>
              </div>
              <Separator />
              <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong>Nota técnica:</strong> O Service Worker atual será preservado. 
                  O manifest utilizará esses valores dinâmicos para novas instalações.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/60 bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4" /> Preview Google
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-[#1a0dab] text-xl hover:underline cursor-pointer truncate">
                    {formData.routes["/"]?.title || formData.defaultTitle}
                  </div>
                  <div className="text-[#006621] text-sm flex items-center gap-1">
                    {formData.siteUrl} <span className="text-[10px] transform rotate-90">▼</span>
                  </div>
                  <div className="text-[#545454] text-sm line-clamp-2">
                    {formData.routes["/"]?.description || formData.defaultDescription}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Share2 className="h-4 w-4" /> Preview WhatsApp / Social
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-xl overflow-hidden bg-white dark:bg-zinc-900 max-w-sm mx-auto">
                  <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                    <img 
                      src={formData.socialImageUrl} 
                      alt="Preview" 
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="p-3 bg-[#f0f2f5] dark:bg-zinc-800 text-left space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {new URL(formData.siteUrl || "https://afidelize.app").hostname}
                    </div>
                    <div className="font-bold text-sm line-clamp-1">
                      {formData.routes["/"]?.title || formData.defaultTitle}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {formData.routes["/"]?.description || formData.defaultDescription}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Preview Navegador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-9 w-full bg-muted/40 rounded-t-lg border-x border-t flex items-center px-3 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="ml-4 h-6 w-48 bg-card rounded-md border flex items-center px-2 gap-2 overflow-hidden shadow-sm">
                    <img src={formData.faviconUrl} className="h-3 w-3" alt="Favicon" />
                    <span className="text-[10px] font-medium truncate">
                      {formData.routes["/"]?.title || formData.defaultTitle}
                    </span>
                  </div>
                </div>
                <div className="h-20 w-full border-x border-b bg-card rounded-b-lg flex items-center justify-center text-xs text-muted-foreground italic">
                   Conteúdo da página...
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </div>
    </div>
  );
}
