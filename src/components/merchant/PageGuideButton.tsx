import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { findPageGuide, isGuideSeen, openPageGuide } from "@/lib/page-guides";

/**
 * Botão discreto de ajuda no cabeçalho: abre o passo a passo da tela atual.
 * Ganha um ponto pulsante enquanto o lojista nunca viu o guia daquele módulo.
 */
export function PageGuideButton({ scope }: { scope: string }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const match = findPageGuide(pathname);
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    if (!match) { setUnseen(false); return; }
    setUnseen(!isGuideSeen(scope, match.module));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.module, scope]);

  if (!match) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ver passo a passo desta tela"
          className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
          onClick={() => { setUnseen(false); openPageGuide(); }}
        >
          <HelpCircle className="h-[18px] w-[18px]" />
          {unseen && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Passo a passo: {match.guide.title}</TooltipContent>
    </Tooltip>
  );
}
