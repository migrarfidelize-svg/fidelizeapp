import { createFileRoute } from "@tanstack/react-router";
import { VoiceStudioCard } from "@/components/VoiceStudioCard";
import { PageHero } from "@/components/PageHero";
import { Mic } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/app/studio")({
  head: () => ({ meta: [{ title: "Studio de Voz — Fidelize" }] }),
  component: StudioPage,
});

function StudioPage() {
  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships, isLoading } = useQuery({ 
    queryKey: ["memberships"], 
    queryFn: () => getEsts() 
  });

  if (isLoading) return <LoadingSkeleton variant="page" />;
  
  const establishmentId = memberships?.[0]?.establishment?.id;

  return (
    <div className="space-y-6">
      <PageHero 
        icon={Mic}
        eyebrow="Configuração de Voz"
        title="Studio de Voz"
        subtitle="Configure a identidade sonora do seu estabelecimento e como a IA interage com seus clientes."
      />
      <VoiceStudioCard scope="merchant" establishmentId={establishmentId} />
    </div>
  );
}
