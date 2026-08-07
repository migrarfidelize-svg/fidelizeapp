import { createFileRoute, Outlet, useNavigate, useLocation, Link } from "@tanstack/react-router";
import { PreviewSelector } from "@/components/crm/previews/PreviewSelector";
import { ArrowLeft, LayoutGrid, Briefcase, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/hash/atendimento/preview/")({
  component: CRMPreviewLayout,
});

function CRMPreviewLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Helper to determine active preview from path
  const pathParts = location.pathname.split("/");
  const currentPreview = pathParts[pathParts.length - 1];
  const isIndex = currentPreview === "preview" || currentPreview === "";

  if (isIndex) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 space-y-12 bg-muted/20 rounded-3xl border-2 border-dashed border-primary/20">
        <div className="text-center space-y-4 max-w-2xl">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-foreground italic">
            Escolha uma <span className="text-primary underline decoration-primary/30">Preview de UX</span>
          </h1>
          <p className="text-muted-foreground font-medium">
            Explore três visões completamente diferentes para o futuro do Atendimento Afidelize.
            Selecione uma proposta para testar a interface funcional com dados reais.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl">
          {[
            { 
              id: 'command', 
              name: '1 — Command Center', 
              desc: 'Afidelize Ops Center', 
              icon: LayoutGrid,
              color: 'from-blue-500/20 to-primary/20',
              border: 'border-blue-500/30'
            },
            { 
              id: 'workspace', 
              name: '2 — Premium Workspace', 
              desc: 'Afidelize Concierge', 
              icon: Briefcase,
              color: 'from-emerald-500/20 to-primary/20',
              border: 'border-emerald-500/30'
            },
            { 
              id: 'nexus', 
              name: '3 — Nexus', 
              desc: 'Afidelize Nexus', 
              icon: Zap,
              color: 'from-purple-500/20 to-primary/20',
              border: 'border-purple-500/30'
            },
          ].map((opt) => (
            <Card key={opt.id} className={`group relative overflow-hidden border-2 p-8 transition-all hover:scale-105 hover:shadow-2xl cursor-pointer ${opt.border} bg-card/50 backdrop-blur-sm`} onClick={() => navigate({ to: `/hash/atendimento/preview/${opt.id}` })}>
              <div className={`absolute inset-0 bg-gradient-to-br ${opt.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                  <opt.icon className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{opt.name}</h3>
                  <p className="text-sm text-muted-foreground font-medium mt-1">{opt.desc}</p>
                </div>
                <Button className="w-full rounded-2xl font-bold uppercase tracking-widest text-[10px] h-10">
                  Abrir Preview
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Button variant="ghost" asChild className="rounded-full">
          <Link to="/hash/atendimento">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Atendimento atual
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -m-8 relative">
      <div className="absolute top-4 right-4 z-[100] flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 mr-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 bg-muted/40 px-3 py-1.5 rounded-full border border-border/50">
          <CheckCircle2 className="h-3 w-3 text-primary" />
          Modo Preview Ativo
        </div>
        
        <PreviewSelector 
          current={currentPreview} 
          onChange={(val) => {
            const currentSubTab = new URLSearchParams(window.location.search).get('tab') || 'conversas';
            navigate({ to: `/hash/atendimento/preview/${val}`, search: { tab: currentSubTab } });
          }} 
        />
        
        <Button variant="secondary" size="sm" className="rounded-full h-8 text-[10px] font-bold uppercase border shadow-sm" asChild>
          <Link to="/hash/atendimento">
            <ArrowLeft className="h-3 w-3 mr-2" />
            Sair
          </Link>
        </Button>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
