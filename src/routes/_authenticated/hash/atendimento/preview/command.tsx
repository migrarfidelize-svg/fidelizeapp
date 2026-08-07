import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/crm/previews/CommandCenter";

export const Route = createFileRoute("/_authenticated/hash/atendimento/preview/command")({
  component: CommandCenter,
});
