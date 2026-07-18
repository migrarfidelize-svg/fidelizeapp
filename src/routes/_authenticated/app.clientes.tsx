import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments, searchCustomer } from "@/lib/loyalty.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPhone, formatDate } from "@/lib/format";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Fidelize" }] }),
  component: Clientes,
});

function Clientes() {
  const getEsts = useServerFn(getMyEstablishments);
  const search = useServerFn(searchCustomer);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string } | undefined;
  const [q, setQ] = useState("");
  const { data: customers } = useQuery({
    enabled: !!est,
    queryKey: ["customers", est?.id, q],
    queryFn: () => search({ data: { establishment_id: est!.id, query: q || " " } }).catch(() => []),
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Base</div>
        <h1 className="font-display text-3xl font-bold">Clientes</h1>
      </div>
      <Input placeholder="Buscar por nome, telefone, código ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card>
        <CardContent className="p-0">
          {!customers || customers.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Users className="mx-auto h-8 w-8 mb-3 opacity-50" />
              Nenhum cliente ainda. Compartilhe seu QR Code para começar.
            </div>
          ) : (
            <div className="divide-y">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{formatPhone(c.phone)} · código {c.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{c.visits_count} visitas</div>
                    <div className="text-xs text-muted-foreground">Última: {formatDate(c.last_visit_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
