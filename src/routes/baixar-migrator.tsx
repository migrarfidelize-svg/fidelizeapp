import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/baixar-migrator")({
  head: () => ({
    meta: [
      { title: "Baixar Fidelize Migrator" },
      { name: "description", content: "Extensão Chrome para migrar o Fidelize para seu Supabase próprio." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DownloadPage,
});

function DownloadPage() {
  const [status, setStatus] = useState<string>("");

  const download = () => {
    setStatus("Baixando...");
    fetch("/fidelize-migrator.zip")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "fidelize-migrator.zip";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus("✅ Download iniciado. Verifique sua pasta de Downloads.");
      })
      .catch((err) => setStatus("❌ Erro: " + err.message));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">🚀 Fidelize Migrator</h1>
          <p className="text-slate-400 text-sm mt-1">
            Extensão Chrome (MV3) para migrar seu banco, usuários e arquivos para o Supabase da VPS.
          </p>
        </div>

        <button
          onClick={download}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl transition"
        >
          ⬇️  Baixar extensão (.zip)
        </button>

        {status && <div className="text-sm text-cyan-300">{status}</div>}

        <div className="text-sm text-slate-300 space-y-2">
          <p className="font-semibold text-slate-100">Como instalar:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            <li>Descompacte o arquivo <code className="text-cyan-300">fidelize-migrator.zip</code>.</li>
            <li>Abra <code className="text-cyan-300">chrome://extensions</code> no Chrome/Edge/Brave.</li>
            <li>Ative o <b>Modo do desenvolvedor</b> (canto superior direito).</li>
            <li>Clique em <b>Carregar sem compactação</b> e selecione a pasta descompactada.</li>
            <li>Clique no ícone 🚀 na barra do navegador.</li>
          </ol>
        </div>

        <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          Tudo roda localmente na sua máquina — nenhum dado passa por servidores externos.
        </div>
      </div>
    </div>
  );
}
