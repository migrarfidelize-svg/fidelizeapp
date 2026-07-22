import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_preview/qrcodes")({
  component: Preview,
});

function Preview() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500" />
            <div>
              <div className="text-sm font-semibold">QR Studio</div>
              <div className="text-xs text-white/50">Divulgação — Fidelize</div>
            </div>
          </div>
          <div className="flex gap-2">
            {["Story", "Feed", "Balcão A5"].map((f, i) => (
              <button key={f} className={`rounded-full px-3 py-1.5 text-xs border ${i === 0 ? "bg-white text-black border-white" : "border-white/15 text-white/70"}`}>{f}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-white/15 px-3 py-1.5 text-xs">Salvar</button>
            <button className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-black">Exportar</button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_360px] gap-4">
          <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,.15),transparent_60%),radial-gradient(circle_at_70%_80%,rgba(232,121,249,.12),transparent_60%)] p-10">
            <div className="mx-auto aspect-[9/16] w-[340px] rounded-2xl bg-gradient-to-b from-amber-50 to-orange-100 p-6 text-neutral-900 shadow-2xl">
              <div className="text-center text-xs uppercase tracking-widest text-orange-700">Cafeteria Aurora</div>
              <div className="mt-4 text-center text-2xl font-black leading-tight">Cada café te leva mais perto de um grátis.</div>
              <div className="mt-4 mx-auto h-40 w-40 rounded-xl bg-white p-2">
                <div className="h-full w-full bg-[conic-gradient(#000_25%,#fff_0_50%,#000_0_75%,#fff_0)] rounded-md" />
              </div>
              <div className="mt-4 text-center text-sm font-semibold">Aponte a câmera do celular</div>
              <div className="mt-2 flex justify-center gap-2 text-[10px]">
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-white">Wi-Fi grátis</span>
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-white">Sem app</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex gap-1 rounded-lg bg-white/5 p-1 text-xs">
              {["Conteúdo", "Estilo", "Fundo", "Mais"].map((t, i) => (
                <div key={t} className={`flex-1 rounded-md px-2 py-1.5 text-center ${i === 0 ? "bg-white text-black" : "text-white/60"}`}>{t}</div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 text-[11px] text-white/50">Título</div>
                <div className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm">Cada café te leva mais perto…</div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-white/50">Subtítulo</div>
                <div className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70">Cadastre-se em segundos…</div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-white/50">Emblemas</div>
                <div className="flex flex-wrap gap-1">
                  {["Wi-Fi grátis", "Sem app", "Rápido", "Recompensa"].map((b, i) => (
                    <span key={b} className={`rounded-full px-2 py-0.5 text-[10px] ${i < 2 ? "bg-cyan-400/20 text-cyan-200 border border-cyan-400/30" : "border border-white/10 text-white/50"}`}>{b}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-2 text-[11px] text-emerald-200">✓ Contraste OK · QR escaneável</div>
            </div>
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="mb-2 text-[11px] text-white/50">Variações</div>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-14 w-10 rounded border border-white/10 bg-gradient-to-b from-amber-100 to-orange-200" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-2 text-xs backdrop-blur w-fit mx-auto">
          {["PNG", "JPG", "PDF", "Imprimir", "SVG"].map(x => (
            <button key={x} className="rounded-full px-3 py-1 hover:bg-white/10">{x}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
