import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCRMRealtime(establishmentId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!establishmentId) return;
    const tenantFilter = `establishment_id=eq.${establishmentId}`;
    const channel = supabase
      .channel(`crm_updates:${establishmentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_conversations', filter: tenantFilter }, () => {
        queryClient.invalidateQueries({ queryKey: ['crm-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages', filter: tenantFilter }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['crm-messages', payload.new.conversation_id] });
        queryClient.invalidateQueries({ queryKey: ['crm-conversations'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_internal_notes', filter: tenantFilter }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['crm-messages', payload.new.conversation_id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_support_tickets', filter: tenantFilter }, () => {
        queryClient.invalidateQueries({ queryKey: ['crm-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [establishmentId, queryClient]);
}
