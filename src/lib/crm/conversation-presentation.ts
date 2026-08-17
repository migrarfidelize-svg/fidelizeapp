export type CRMOperationalTab = "open" | "assigned" | "queue" | "closed";

export function getCRMOperationalTab(conversation: { status?: string; metadata?: any }): CRMOperationalTab {
  if (conversation.status === "closed") return "closed";
  if (conversation.status === "assigned") return "assigned";
  if (conversation.status === "waiting" || conversation.metadata?.support?.active) return "queue";
  return "open";
}

export function getCRMConversationBadge(conversation: { status?: string; metadata?: any }) {
  const tab = getCRMOperationalTab(conversation);
  if (tab === "open") return { label: "IA ATENDENDO", tone: "success" as const };
  if (tab === "queue") return { label: "SUPORTE", tone: "danger" as const };
  if (tab === "assigned") return { label: "EM ATENDIMENTO", tone: "info" as const };
  return { label: "ENCERRADO", tone: "neutral" as const };
}
