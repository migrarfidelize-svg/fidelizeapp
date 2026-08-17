import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCRMRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('crm_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['crm-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_messages' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['crm-messages', payload.new.conversation_id] });
        queryClient.invalidateQueries({ queryKey: ['crm-conversations'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_internal_notes' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['crm-messages', payload.new.conversation_id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_support_tickets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['crm-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
}
