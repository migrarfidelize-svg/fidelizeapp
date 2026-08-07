import { createFileRoute } from "@tanstack/react-router";
import { NexusServiceHub } from "@/components/crm/previews/NexusServiceHub";

export const Route = createFileRoute("/_authenticated/hash/atendimento/preview/nexus")({
  component: NexusServiceHub,
});
