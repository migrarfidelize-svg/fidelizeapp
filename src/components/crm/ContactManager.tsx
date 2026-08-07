import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCRMContacts, saveCRMTag } from "@/lib/atendimento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, User, Trash2, Tag, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function ContactManager() {
  const queryClient = useQueryClient();
  const { data: contacts, isLoading } = useQuery({ queryKey: ["crm-contacts"], queryFn: () => getCRMContacts() });
  
  return (
    <div className="space-y-4">
       <div className="flex justify-between items-center">
         <h3 className="font-bold">Contatos Cadastrados</h3>
         <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Novo Contato</Button>
       </div>
       <div className="border rounded-xl">
         <table className="w-full text-sm">
           <thead className="bg-muted/50">
             <tr>
               <th className="p-3 text-left">Nome/Telefone</th>
               <th className="p-3 text-left">Tags</th>
               <th className="p-3 text-right">Ações</th>
             </tr>
           </thead>
           <tbody>
             {contacts?.map((c: any) => (
               <tr key={c.id} className="border-b">
                 <td className="p-3 font-medium">{c.full_name || c.phone || 'Sem nome'}</td>
                 <td className="p-3">
                   <div className="flex gap-1">
                     {(c.tags || []).map((t: any) => <Badge key={t.id} variant="secondary">{t.name}</Badge>)}
                   </div>
                 </td>
                 <td className="p-3 text-right">
                   <Button variant="ghost" size="sm">WhatsApp</Button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}