import { createFileRoute } from "@tanstack/react-router";
import { PremiumWorkspace } from "@/components/crm/previews/PremiumWorkspace";

export const Route = createFileRoute("/_authenticated/hash/atendimento/preview/workspace")({
  component: () => <PremiumWorkspace />,
});
