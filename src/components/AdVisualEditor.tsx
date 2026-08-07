import * as React from "react";
import { cn } from "@/lib/utils";

const adConfig = {
  premium: {
    container: "bg-gradient-to-br from-indigo-900 to-purple-900 border-indigo-500/30 text-white",
    cta: "bg-white text-indigo-900 hover:bg-white/90",
  },
  minimal: {
    container: "bg-white border-neutral-100 text-black",
    cta: "bg-black text-white hover:bg-neutral-800",
  },
  editorial: {
    container: "bg-neutral-50 border-neutral-200 text-neutral-900",
    cta: "border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white",
  }
};

export interface AdEditorState {
  title: string;
  description: string;
  theme: keyof typeof adConfig;
  imageUrl?: string;
  ctaText: string;
}

export function AdVisualEditor({ state, onChange }: { state: AdEditorState, onChange: (s: AdEditorState) => void }) {
  const config = adConfig[state.theme];

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* FERRAMENTAS */}
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Título</label>
          <input 
            className="w-full p-3 rounded-xl border border-border bg-card"
            value={state.title} 
            onChange={e => onChange({...state, title: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Tema Visual</label>
          <div className="flex gap-2">
            {(Object.keys(adConfig) as Array<keyof typeof adConfig>).map(t => (
              <button 
                key={t}
                onClick={() => onChange({...state, theme: t})}
                className={cn("px-4 py-2 rounded-xl border text-xs font-bold capitalize", state.theme === t ? "border-primary bg-primary/10" : "border-border")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PREVIEW */}
      <div className="flex-1 sticky top-24 h-fit">
        <div className={cn("p-6 rounded-3xl border shadow-xl aspect-[21/9] flex flex-col justify-end transition-all", config.container)}>
          <h3 className="text-2xl font-black">{state.title || "Seu título aqui"}</h3>
          <p className="text-sm opacity-80 mt-1">{state.description || "Descrição do seu anúncio"}</p>
          <button className={cn("mt-4 px-6 py-2 rounded-xl text-sm font-bold w-fit", config.cta)}>
            {state.ctaText || "Aproveitar"}
          </button>
        </div>
      </div>
    </div>
  );
}
