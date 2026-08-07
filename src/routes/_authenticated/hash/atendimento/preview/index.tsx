import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { PreviewSelector } from "@/components/crm/previews/PreviewSelector";

export const Route = createFileRoute("/_authenticated/hash/atendimento/preview/")({
  component: CRMPreviewLayout,
});

function CRMPreviewLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Helper to determine active preview from path
  const currentPreview = location.pathname.split("/").pop();

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -m-8 relative">
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
        <PreviewSelector 
          current={currentPreview || 'command'} 
          onChange={(val) => {
            const currentSubTab = new URLSearchParams(window.location.search).get('tab') || 'conversas';
            navigate({ to: `/hash/atendimento/preview/${val}`, search: { tab: currentSubTab } });
          }} 
        />
        <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg border-2 border-white animate-pulse">
          PREVIEW UX — NÃO É O DESIGN FINAL
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
