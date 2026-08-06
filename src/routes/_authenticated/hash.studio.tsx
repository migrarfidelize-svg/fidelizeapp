import { createFileRoute } from "@tanstack/react-router";
import { VoiceStudioCard } from "@/components/VoiceStudioCard";
import { PageHero } from "@/components/PageHero";
import { Mic } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hash/studio")({
  head: () => ({ meta: [{ title: "Studio de Voz — Administrador" }] }),
  component: AdminStudioPage,
});

function AdminStudioPage() {
  return (
    <div className="space-y-6">
      <PageHero 
        icon={Mic}
        eyebrow="Configuração Global de Voz"
        title="Studio de Voz"
        subtitle="Gerencie as configurações de voz e locuções para todo o sistema Fidelize."
      />
      
      <div className="container mx-auto">
        <VoiceStudioCard scope="admin" />
      </div>
    </div>
  );
}