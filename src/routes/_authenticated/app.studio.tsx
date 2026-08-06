import { createFileRoute } from "@tanstack/react-router";
import { VoiceStudioCard } from "@/components/VoiceStudioCard";
import { PageHero } from "@/components/PageHero";
import { Mic } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/studio")({
  component: () => (
    <div className="space-y-6">
      <PageHero 
        icon={Mic}
        title="Studio de Voz"
        subtitle="Configure a identidade sonora do seu estabelecimento."
      />
      <VoiceStudioCard scope="merchant" />
    </div>
  )
});
