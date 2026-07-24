import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  Download, Puzzle, FileText, Database, Server, Rocket, CheckCircle2,
  Copy, ExternalLink, ShieldCheck, Terminal, Globe, Sparkles, Users, Loader2,
  FolderArchive,
} from "lucide-react";
import { toast } from "sonner";
import { exportAuthUsersJson } from "@/lib/migration-export.functions";
import { listStorageForMigration } from "@/lib/migration-storage.functions";
import { zipSync, strToU8 } from "fflate";

export const Route = createFileRoute("/_authenticated/admin/migracao")({
  head: () => ({
    meta: [
      { title: "Migração & Downloads — Fidelize Admin" },
      { name: "description", content: "Baixe a extensão de migração, docs e siga o passo a passo para rodar 100% independente." },
    ],
  }),
  component: MigracaoPage,
});

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast.success(`${filename} baixado!`);
  } catch (e: any) {
    toast.error(`Falha: ${e.message}`);
  }
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado!`));
}

const DOWNLOADS = [
  {
    icon: Puzzle,
    title: "Extensão Fidelize Migrator",
    description: "Extensão Chrome que copia todos os dados do banco atual para o seu Supabase novo.",
    file: "fidelize-migrator.zip",
    size: "~18 KB",
    badge: "Essencial",
    tone: "from-cyan-500/20 to-blue-500/10",
  },
  {
    icon: FileText,
    title: "Guia de Migração Completo",
    description: "Passo a passo Ubuntu + Docker + Nginx + SSL + Google OAuth + troubleshooting.",
    file: "MIGRACAO-INDEPENDENTE.md",
    size: "~10 KB",
    badge: "Documentação",
    tone: "from-fuchsia-500/20 to-pink-500/10",
  },
  {
    icon: Database,
    title: "Script pg_cron (Automações)",
    description: "6 jobs automáticos: tiers, aniversários, past_due, tokens, reengajamento, limpeza.",
    file: "pg_cron-setup.sql",
    size: "~9 KB",
    badge: "SQL",
    tone: "from-emerald-500/20 to-teal-500/10",
  },
];

const EXTENSION_STEPS = [
  {
    n: 1,
    title: "Baixe e descompacte a extensão",
    body: "Clique em 'Baixar extensão' acima. Depois clique com o botão direito no arquivo `fidelize-migrator.zip` e escolha 'Extrair aqui'.",
  },
  {
    n: 2,
    title: "Abra o Chrome em modo desenvolvedor",
    body: "No Chrome (ou Edge/Brave), digite na barra de endereços: `chrome://extensions` — depois ative o toggle 'Modo do desenvolvedor' no canto superior direito.",
  },
  {
    n: 3,
    title: "Carregue a extensão",
    body: "Clique em 'Carregar sem compactação' (Load unpacked) e selecione a pasta que você acabou de extrair. A extensão 'Fidelize Migrator' vai aparecer.",
  },
  {
    n: 4,
    title: "Fixe no navegador",
    body: "Clique no ícone de peça de quebra-cabeça do Chrome (canto superior direito) e clique no alfinete ao lado de 'Fidelize Migrator' para deixá-la sempre visível.",
  },
  {
    n: 5,
    title: "Prepare seu novo Supabase",
    body: "Crie uma conta em supabase.com → Novo projeto → Aguarde provisionar (~2 min). Copie a URL do projeto e a chave `service_role` (Settings → API).",
  },
  {
    n: 6,
    title: "Execute a migração",
    body: "Clique no ícone da extensão. Cole a URL e a chave do novo Supabase. Clique em 'Iniciar migração'. Aguarde (~15-30 min dependendo do volume). Não feche a aba.",
  },
  {
    n: 7,
    title: "Valide os dados",
    body: "No painel do novo Supabase, vá em 'Table Editor' e confirme que as tabelas (`establishments`, `customers`, `loyalty_cards`, `stamps`) têm o mesmo número de linhas.",
  },
];

const VPS_STEPS = [
  { n: 1, title: "Contrate uma VPS", body: "Sugestões: Hetzner (€4/mês), DigitalOcean ($6/mês), Contabo ($5/mês). Escolha Ubuntu 22.04 LTS, 2 vCPU, 4 GB RAM." },
  { n: 2, title: "Aponte seu domínio", body: "No seu provedor de DNS (Registro.br, Cloudflare, Namecheap): crie um registro A apontando `fidelize.seudominio.com` para o IP da VPS." },
  { n: 3, title: "Conecte via SSH", body: "No terminal (Linux/Mac) ou PowerShell (Windows): `ssh root@SEU_IP_DA_VPS`" },
  { n: 4, title: "Instale Docker", body: "Cole no terminal: `curl -fsSL https://get.docker.com | sh && apt install -y docker-compose-plugin nginx certbot python3-certbot-nginx`" },
  { n: 5, title: "Baixe o guia detalhado", body: "Todos os arquivos (Dockerfile, docker-compose.yml, .env exemplo, nginx.conf, deploy.sh) estão no 'Guia de Migração Completo' acima. Baixe e siga." },
  { n: 6, title: "Configure SSL grátis", body: "Depois do Nginx rodando: `certbot --nginx -d fidelize.seudominio.com` — Certbot cuida do certificado e renovação automática." },
  { n: 7, title: "Rode as automações", body: "No SQL Editor do novo Supabase, cole todo o conteúdo do arquivo 'pg_cron-setup.sql' e execute. Os 6 jobs começam imediatamente." },
];

function MigracaoPage() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [exportingUsers, setExportingUsers] = useState(false);
  const [exportingStorage, setExportingStorage] = useState(false);
  const [storageProgress, setStorageProgress] = useState<{ done: number; total: number } | null>(null);
  const exportUsersFn = useServerFn(exportAuthUsersJson);
  const listStorageFn = useServerFn(listStorageForMigration);

  async function handleExportUsers() {
    setExportingUsers(true);
    try {
      const res = await exportUsersFn();
      const blob = new Blob([JSON.stringify(res.users, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `auth-users-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`${res.count} usuários exportados!`);
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    } finally {
      setExportingUsers(false);
    }
  }

  async function handleExportStorage() {
    setExportingStorage(true);
    setStorageProgress(null);
    try {
      toast.info("Listando arquivos do Storage...");
      const { files, count, totalBytes } = await listStorageFn();
      if (!count) {
        toast.warning("Nenhum arquivo encontrado nos buckets.");
        return;
      }
      toast.info(`${count} arquivos (${(totalBytes / 1024 / 1024).toFixed(1)} MB). Baixando...`);
      setStorageProgress({ done: 0, total: count });

      // Baixa em paralelo (concorrência 6) para não sufocar
      const zipEntries: Record<string, Uint8Array> = {};
      let done = 0;
      const concurrency = 6;
      let idx = 0;
      async function worker() {
        while (idx < files.length) {
          const i = idx++;
          const f = files[i];
          try {
            const res = await fetch(f.signedUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = new Uint8Array(await res.arrayBuffer());
            zipEntries[`${f.bucket}/${f.path}`] = buf;
          } catch (e: any) {
            console.warn(`Falha em ${f.bucket}/${f.path}:`, e.message);
          }
          done++;
          setStorageProgress({ done, total: files.length });
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker));

      // Manifest para a extensão saber o que tem
      zipEntries["_manifest.json"] = strToU8(JSON.stringify({
        generated_at: new Date().toISOString(),
        count,
        totalBytes,
        files: files.map((f) => ({ bucket: f.bucket, path: f.path, size: f.size })),
      }, null, 2));

      toast.info("Compactando ZIP...");
      const zipped = zipSync(zipEntries, { level: 0 }); // store-only (já são binários)
      const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `storage-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`ZIP com ${count} arquivos baixado!`);
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    } finally {
      setExportingStorage(false);
      setStorageProgress(null);
    }
  }



  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-cyan-500/10 p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="rounded-2xl bg-primary/15 p-4 text-primary">
            <Rocket className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <Badge variant="outline" className="mb-2">Independência total</Badge>
            <h1 className="font-display text-3xl font-bold">Central de Migração</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Tudo o que você precisa para rodar o Fidelize em seu próprio servidor, sem depender da Lovable.
              Baixe a extensão, siga os passos e migre em poucas horas.
            </p>
          </div>
        </div>
      </div>

      {/* DOWNLOADS */}
      <section>
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" /> Downloads
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {DOWNLOADS.map((d) => (
            <Card key={d.file} className="relative overflow-hidden group hover:shadow-lg transition-shadow">
              <div className={`absolute inset-0 bg-gradient-to-br ${d.tone} opacity-40 group-hover:opacity-60 transition-opacity`} />
              <CardContent className="relative p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-background/60 backdrop-blur p-3 border">
                    <d.icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="secondary">{d.badge}</Badge>
                </div>
                <div>
                  <h3 className="font-semibold">{d.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{d.file}</span>
                  <span>{d.size}</span>
                </div>
                <Button className="w-full" onClick={() => downloadFile(`/${d.file}`, d.file)}>
                  <Download className="mr-2 h-4 w-4" /> Baixar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* EXPORT AUTH USERS */}
      <section>
        <Card className="relative overflow-hidden border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-cyan-500/10">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <CardHeader className="relative">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-fuchsia-500/15 p-3 text-fuchsia-500">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  Exportar usuários (auth.users)
                  <Badge variant="secondary">Recomendado</Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  Gera um <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">.json</code> com todos os
                  usuários (email, telefone, metadata e hash de senha). Sem este arquivo, ninguém consegue logar no destino.
                  Alimente-o na aba <b>2. Arquivos</b> da extensão.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <Button
              onClick={handleExportUsers}
              disabled={exportingUsers}
              className="w-full md:w-auto bg-fuchsia-500 hover:bg-fuchsia-600 text-white"
            >
              {exportingUsers ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando JSON...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Exportar auth.users como JSON</>
              )}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              🔒 Apenas super admin. O hash bcrypt é preservado — os usuários continuarão logando com a mesma senha no destino.
            </p>
          </CardContent>
        </Card>
      </section>



      {/* PASSO A PASSO */}
      <section>
        <Tabs defaultValue="extensao" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="extensao"><Puzzle className="mr-2 h-4 w-4" />Usar a Extensão</TabsTrigger>
            <TabsTrigger value="vps"><Server className="mr-2 h-4 w-4" />Rodar em VPS</TabsTrigger>
          </TabsList>

          <TabsContent value="extensao" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> Passo a passo — Extensão de Migração
                </CardTitle>
                <CardDescription>
                  Copia todos os dados do banco atual (empresas, clientes, carimbos, avaliações) para o seu Supabase novo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {EXTENSION_STEPS.map((s) => (
                    <li key={s.n} className="flex gap-4 rounded-xl border p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-sm">
                        {s.n}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{s.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1" dangerouslySetInnerHTML={{
                          __html: s.body.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-primary">$1</code>')
                        }} />
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <strong>Pronto!</strong> Com os dados migrados, você já pode subir a aplicação em uma VPS e apontar para o novo banco. Veja a aba "Rodar em VPS".
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vps" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" /> Passo a passo — Hospedar em VPS
                </CardTitle>
                <CardDescription>
                  Custo estimado: $10-40/mês. Tempo total: 4-6 horas na primeira vez.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {VPS_STEPS.map((s) => (
                    <li key={s.n} className="flex gap-4 rounded-xl border p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-sm">
                        {s.n}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{s.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1" dangerouslySetInnerHTML={{
                          __html: s.body.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-primary">$1</code>')
                        }} />
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-6 rounded-lg border bg-muted/30 p-4">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Terminal className="h-4 w-4" /> Comandos essenciais (copie e cole)
                  </h4>
                  <div className="space-y-2">
                    {[
                      { label: "Conectar SSH", cmd: "ssh root@SEU_IP_DA_VPS" },
                      { label: "Instalar Docker", cmd: "curl -fsSL https://get.docker.com | sh" },
                      { label: "Certificado SSL", cmd: "certbot --nginx -d fidelize.seudominio.com" },
                      { label: "Subir aplicação", cmd: "docker compose up -d --build" },
                    ].map((c) => (
                      <div key={c.label} className="flex items-center gap-2 rounded-md bg-background border p-2">
                        <span className="text-xs font-medium text-muted-foreground w-32 flex-shrink-0">{c.label}</span>
                        <code className="flex-1 text-xs font-mono text-primary truncate">{c.cmd}</code>
                        <Button size="sm" variant="ghost" onClick={() => { copyToClipboard(c.cmd, c.label); setCopiedCmd(c.cmd); }}>
                          {copiedCmd === c.cmd ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Perguntas frequentes
        </h2>
        <Card>
          <CardContent className="p-2">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="q1">
                <AccordionTrigger className="px-4">Preciso saber programar para migrar?</AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Não. A extensão faz o trabalho pesado. Para a VPS, os comandos estão prontos — é só copiar e colar. Se travar em algum passo, consulte o guia completo (seção "Troubleshooting").
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger className="px-4">O que acontece com os dados antigos?</AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Nada. A extensão só **lê** do banco atual e **copia** para o novo. Nenhum dado é alterado ou apagado no ambiente Lovable.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger className="px-4">Posso migrar em partes?</AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Sim. Você pode manter o Lovable no ar enquanto testa a VPS. Só troque o DNS quando estiver 100% seguro.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger className="px-4">E o Google Login?</AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Você precisa criar seu próprio app OAuth no Google Cloud Console (guia detalhado no PDF). Alternativa: deixe só WhatsApp + Email/senha.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q5">
                <AccordionTrigger className="px-4">Como funciona o suporte após migrar?</AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  O sistema é 100% seu. Você tem controle total. Para dúvidas técnicas, o código-fonte é padrão TanStack Start + Supabase — qualquer desenvolvedor consegue dar manutenção.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* CTA final */}
      <Card className="bg-gradient-to-br from-primary/10 to-fuchsia-500/5 border-primary/30">
        <CardContent className="p-6 flex flex-col md:flex-row items-center gap-4 justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">Precisa de links úteis?</h3>
            <p className="text-sm text-muted-foreground mt-1">Contas e ferramentas recomendadas para hospedar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><a href="https://supabase.com" target="_blank" rel="noopener noreferrer">Supabase <ExternalLink className="ml-1.5 h-3 w-3" /></a></Button>
            <Button variant="outline" asChild><a href="https://hetzner.com" target="_blank" rel="noopener noreferrer">Hetzner VPS <ExternalLink className="ml-1.5 h-3 w-3" /></a></Button>
            <Button variant="outline" asChild><a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud <ExternalLink className="ml-1.5 h-3 w-3" /></a></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
