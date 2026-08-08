import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveWhatsAppProvider } from "./otp.functions";
import { decryptSecret } from "./integrations/crypt.server";

/**
 * Motor Profissional de Disparos Server-Side
 * Responsável por processar a fila de destinatários em lotes,
 * respeitando limites de velocidade e atualizando o CRM.
 */
export async function processNextBroadcastBatch() {
  // 1. Localizar campanha ativa ou na fila
  const { data: broadcast, error: broadcastErr } = await supabaseAdmin
    .from("crm_broadcasts")
    .select("*")
    .in("status", ["queued", "running"])
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (broadcastErr || !broadcast) return;

  // 2. Marcar como em execução se estiver na fila
  if (broadcast.status === "queued") {
    await supabaseAdmin
      .from("crm_broadcasts")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", broadcast.id);
  }

  // 3. Pegar lote de destinatários (Batching: 20 por vez)
  const { data: recipients, error: recErr } = await supabaseAdmin
    .from("crm_broadcast_recipients")
    .select("*, contact:crm_contacts(name, phone)")
    .eq("broadcast_id", broadcast.id)
    .eq("status", "queued")
    .limit(20);

  if (recErr || !recipients || recipients.length === 0) {
    if (!recErr && (!recipients || recipients.length === 0)) {
      // Finalizar campanha
      await supabaseAdmin
        .from("crm_broadcasts")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", broadcast.id);
    }
    return;
  }

  // 4. Carregar Provedor WhatsApp
  const active = await getActiveWhatsAppProvider();
  if (!active) {
    await supabaseAdmin
      .from("crm_broadcasts")
      .update({ status: "failed", metadata: { ...((broadcast.metadata as any) || {}), last_error: "Nenhum provedor WhatsApp ativo" } })
      .eq("id", broadcast.id);
    return;
  }

  // Descriptografar credenciais
  const runtimeObj = active.runtime as any;
  const dbCredsEncrypted = runtimeObj.db_credentials || runtimeObj.credentials || {};
  const dbCreds: Record<string, string> = {};
  for (const [k, v] of Object.entries(dbCredsEncrypted)) {
    dbCreds[k] = typeof v === "string" && v.length > 20 ? await decryptSecret(v) : v as string;
  }
  const runtime = { ...active.runtime, db_credentials: dbCreds };
  const mergedEnv = { ...process.env } as Record<string, string | undefined>;
  const credentialsRef = runtime.credentials_ref as Record<string, string> || {};
  for (const [field, envName] of Object.entries(credentialsRef)) {
    const v = dbCreds[field];
    if (v) mergedEnv[envName] = v;
  }

  // 5. Processar o lote
  for (const recipient of recipients) {
    // Verificar se a campanha foi pausada ou cancelada entre mensagens
    const { data: currentStatus } = await supabaseAdmin
      .from("crm_broadcasts")
      .select("status")
      .eq("id", broadcast.id)
      .single();
    
    if (currentStatus?.status !== "running") break;

    try {
      // Personalização {{nome}}
      const contactName = (recipient.contact as any)?.name || "Cliente";
      const renderedMessage = broadcast.message_template
        .replace(/{{nome}}/g, contactName)
        .replace(/{{telefone}}/g, recipient.phone);

      // Atualizar destinatário para 'sending' (Idempotência/Bloqueio)
      await supabaseAdmin
        .from("crm_broadcast_recipients")
        .update({ status: "sending", rendered_message: renderedMessage })
        .eq("id", recipient.id);

      // Enviar via provider
      const res = await active.provider.sendTestMessage(
        runtime,
        mergedEnv,
        recipient.phone,
        renderedMessage
      );

      if (res.ok) {
        // Sucesso
        await supabaseAdmin
          .from("crm_broadcast_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: res.providerMessageId,
            attempts: (recipient.attempts || 0) + 1
          })
          .eq("id", recipient.id);

        // Incrementar contador da campanha
        await (supabaseAdmin.rpc as any)("mark_broadcast_recipient_sent", { p_recipient_id: recipient.id });

        // Registrar no histórico de mensagens (crm_messages)
        const { data: conv } = await supabaseAdmin
          .from("crm_conversations")
          .select("id")
          .eq("customer_phone", recipient.phone)
          .neq("status", "closed")
          .maybeSingle();
        
        let convId = conv?.id;
        if (!convId) {
          const { data: newConv } = await supabaseAdmin
            .from("crm_conversations")
            .insert({ 
                customer_phone: recipient.phone, 
                contact_id: recipient.contact_id as any,
                status: "waiting" 
            })
            .select("id")
            .single();
          convId = newConv?.id;
        }

        if (convId) {
          await supabaseAdmin.from("crm_messages").insert({
            conversation_id: convId,
            body: renderedMessage,
            direction: "outbound",
            provider: active.provider.meta.id,
            provider_message_id: res.providerMessageId,
            metadata: { source: "broadcast", broadcast_id: broadcast.id }
          });
        }

      } else {
        // Falha no provider
        await supabaseAdmin
          .from("crm_broadcast_recipients")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            last_error: res.message || "Erro desconhecido",
            attempts: (recipient.attempts || 0) + 1
          })
          .eq("id", recipient.id);
        
        await (supabaseAdmin.rpc as any)("mark_broadcast_recipient_failed", { p_recipient_id: recipient.id, p_error: res.message });
      }
    } catch (err) {
      console.error(`[BroadcastEngine] Error processing recipient ${recipient.id}:`, err);
      await supabaseAdmin
        .from("crm_broadcast_recipients")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          last_error: String(err),
          attempts: (recipient.attempts || 0) + 1
        })
        .eq("id", recipient.id);
    }

    // Intervalo entre mensagens (Rate Limit: 2s)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 6. Recursividade controlada (agendar próximo lote)
  // Em uma infra real, isso seria um cron ou queue trigger. 
  // Aqui disparamos novamente se ainda houver campanha rodando.
  setTimeout(() => processNextBroadcastBatch().catch(console.error), 1000);
}
