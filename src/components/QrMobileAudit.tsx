import { useCallback, useEffect, useRef, useState } from "react";
import { Smartphone, RefreshCcw, X, AlertTriangle, CheckCircle2, Hand, MoveHorizontal, Type, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Modo de validação mobile (390px).
 * Abre a própria página dentro de um iframe de 390×844 (mesma origem) e roda
 * uma auditoria de acessibilidade tátil/visual: overflow horizontal, alvos de
 * toque pequenos, texto minúsculo, prévia fora do alcance e áreas de arraste
 * cobertas por elementos fixos.
 *
 * É puramente visual/diagnóstico — não altera nada da página real.
 */

const FRAME_W = 390;
const FRAME_H = 844;

type Severity = "error" | "warn";
type IssueKind = "overflow" | "touch" | "text" | "preview" | "drag";

type Issue = {
  id: number;
  kind: IssueKind;
  severity: Severity;
  title: string;
  detail: string;
};

const KIND_META: Record<IssueKind, { label: string; icon: typeof Hand }> = {
  overflow: { label: "Corte horizontal", icon: MoveHorizontal },
  touch: { label: "Alvo de toque", icon: Hand },
  text: { label: "Texto pequeno", icon: Type },
  preview: { label: "Prévia", icon: Eye },
  drag: { label: "Arraste", icon: Hand },
};

const AUDIT_STYLE_ID = "fidelize-mobile-audit-style";
const AUDIT_CSS = `
[data-qa-issue]{outline:2px dashed rgba(239,68,68,.95)!important;outline-offset:1px!important;}
[data-qa-issue="warn"]{outline-color:rgba(245,158,11,.95)!important;}
[data-qa-flash]{animation:qaFlash 1.2s ease-out 2;}
@keyframes qaFlash{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}30%{box-shadow:0 0 0 6px rgba(239,68,68,.45)}}
`;

function labelFor(el: Element) {
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
  if (text) return text.slice(0, 48);
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.slice(0, 48);
  return `<${el.tagName.toLowerCase()}>`;
}

function isVisible(el: Element, win: Window) {
  const cs = win.getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export function QrMobileAudit() {
  const [open, setOpen] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [ran, setRan] = useState(false);
  const [scale, setScale] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const elementsRef = useRef<Element[]>([]);

  // Não mostra o botão quando a própria página está sendo renderizada dentro do iframe de auditoria.
  const [isNested, setIsNested] = useState(false);
  useEffect(() => {
    setIsNested(typeof window !== "undefined" && window.self !== window.top);
  }, []);

  // Escala o frame para caber na viewport do avaliador.
  useEffect(() => {
    if (!open) return;
    const fit = () => {
      const availH = window.innerHeight - 130;
      const availW = Math.min(window.innerWidth - 420, 520);
      setScale(Math.min(1, availH / FRAME_H, availW / FRAME_W));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open]);

  const runAudit = useCallback(() => {
    const frame = iframeRef.current;
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    if (!doc || !win) return;

    // injeta CSS de destaque
    if (!doc.getElementById(AUDIT_STYLE_ID)) {
      const style = doc.createElement("style");
      style.id = AUDIT_STYLE_ID;
      style.textContent = AUDIT_CSS;
      doc.head.appendChild(style);
    }
    doc.querySelectorAll("[data-qa-issue]").forEach((el) => el.removeAttribute("data-qa-issue"));

    const found: Issue[] = [];
    const els: Element[] = [];
    let id = 0;
    const push = (el: Element | null, kind: IssueKind, severity: Severity, title: string, detail: string) => {
      if (el) el.setAttribute("data-qa-issue", severity);
      els[id] = el ?? doc.body;
      found.push({ id, kind, severity, title, detail });
      id += 1;
    };

    const all = Array.from(doc.body.querySelectorAll<HTMLElement>("*")).filter((el) => isVisible(el, win));

    // 1) Overflow horizontal — algo ultrapassa os 390px
    const seenOverflow = new Set<Element>();
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const overflowsRight = r.right > FRAME_W + 1;
      const overflowsLeft = r.left < -1;
      if (!overflowsRight && !overflowsLeft) continue;
      // evita reportar toda a cadeia de ancestrais: só o mais externo
      if (el.parentElement && seenOverflow.has(el.parentElement)) {
        seenOverflow.add(el);
        continue;
      }
      seenOverflow.add(el);
      const cs = win.getComputedStyle(el);
      if (cs.position === "fixed") continue;
      push(
        el,
        "overflow",
        "error",
        labelFor(el),
        `Ultrapassa a tela em ${Math.round(overflowsRight ? r.right - FRAME_W : -r.left)}px — conteúdo cortado no celular.`,
      );
      if (found.length > 40) break;
    }

    // 2) Alvos de toque menores que 44×44
    const interactive = all.filter((el) =>
      ["BUTTON", "A", "SELECT", "INPUT", "TEXTAREA"].includes(el.tagName) || el.getAttribute("role") === "button",
    );
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (r.height >= 40 && r.width >= 40) continue;
      if (r.height < 8 || r.width < 8) continue; // elementos decorativos/ocultos
      const severity: Severity = r.height < 32 || r.width < 32 ? "error" : "warn";
      push(
        el,
        "touch",
        severity,
        labelFor(el),
        `Área de toque ${Math.round(r.width)}×${Math.round(r.height)}px — o mínimo confortável é 44×44px.`,
      );
      if (found.length > 60) break;
    }

    // 3) Texto abaixo de 11px
    for (const el of all) {
      if (el.children.length > 0) continue;
      const txt = (el.textContent ?? "").trim();
      if (txt.length < 3) continue;
      const size = parseFloat(win.getComputedStyle(el).fontSize || "16");
      if (size >= 11) continue;
      push(el, "text", "warn", labelFor(el), `Fonte de ${size.toFixed(1)}px — difícil de ler no celular.`);
      if (found.length > 80) break;
    }

    // 4) Prévia acessível durante a edição
    const preview = doc.getElementById("qr-preview");
    const editor = doc.getElementById("qr-editor");
    if (!preview) {
      push(null, "preview", "error", "Prévia não encontrada", "O elemento #qr-preview não existe nesta etapa.");
    } else {
      const pTop = preview.getBoundingClientRect().top + win.scrollY;
      const eTop = editor ? editor.getBoundingClientRect().top + win.scrollY : 0;
      const gap = Math.round(pTop - eTop);
      if (gap > FRAME_H * 1.5) {
        push(
          preview,
          "preview",
          "warn",
          "Prévia distante do editor",
          `A prévia começa ${gap}px abaixo do editor (${(gap / FRAME_H).toFixed(1)} telas de rolagem). Use o atalho flutuante para alternar.`,
        );
      }
    }

    // 5) Superfície de arraste coberta por elementos fixos (barra de etapas / botão flutuante)
    const draggables = Array.from(
      doc.querySelectorAll<HTMLElement>("[data-draggable], [style*='touch-action']"),
    ).filter((el) => isVisible(el, win));
    const fixedBars = all.filter((el) => {
      const cs = win.getComputedStyle(el);
      return (cs.position === "fixed" || cs.position === "sticky") && el.getBoundingClientRect().height > 24;
    });
    for (const d of draggables) {
      const dr = d.getBoundingClientRect();
      if (dr.width < 16 && dr.height < 16) {
        push(d, "drag", "error", labelFor(d), `Alça de arraste de ${Math.round(dr.width)}×${Math.round(dr.height)}px — pequena demais para o dedo.`);
        continue;
      }
      const blocker = fixedBars.find((f) => {
        const fr = f.getBoundingClientRect();
        return !(fr.bottom < dr.top || fr.top > dr.bottom || fr.right < dr.left || fr.left > dr.right);
      });
      if (blocker) {
        push(d, "drag", "warn", labelFor(d), `Área de arraste sobreposta por "${labelFor(blocker)}" (barra fixa) — o toque pode não chegar ao elemento.`);
      }
    }
    if (draggables.length === 0) {
      push(null, "drag", "warn", "Modo de arraste inativo", "Ative “Editar posições” na etapa de layout e rode a validação de novo para checar as alças de arraste.");
    }

    // 6) Rolagem horizontal do documento
    if (doc.documentElement.scrollWidth > FRAME_W + 2) {
      push(
        doc.body,
        "overflow",
        "error",
        "Página rola na horizontal",
        `Largura total de ${doc.documentElement.scrollWidth}px contra ${FRAME_W}px de tela.`,
      );
    }

    elementsRef.current = els;
    setIssues(found);
    setRan(true);
  }, []);

  const focusIssue = (issue: Issue) => {
    const el = elementsRef.current[issue.id];
    const win = iframeRef.current?.contentWindow;
    if (!el || !win) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.setAttribute("data-qa-flash", "1");
    win.setTimeout(() => el.removeAttribute("data-qa-flash"), 2600);
  };

  if (isNested) return null;

  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.length - errors;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 border-primary/35 text-primary"
      >
        <Smartphone className="h-4 w-4" />
        Validar em 390px
      </Button>

      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-background/85 backdrop-blur-md">
          <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold">Modo de validação mobile · 390 × 844</h2>
                <p className="truncate text-xs text-muted-foreground">
                  Simulação real da página em um iPhone. Elementos com problema ficam contornados.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={runAudit}>
                <RefreshCcw className="h-4 w-4" />
                Reavaliar
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar validação">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
            {/* Device frame */}
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
              <div
                style={{ width: FRAME_W * scale, height: FRAME_H * scale }}
                className="shrink-0"
              >
                <div
                  style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
                  className="overflow-hidden rounded-[2rem] border-[6px] border-foreground/80 bg-background shadow-2xl"
                >
                  <iframe
                    ref={iframeRef}
                    title="Prévia 390px"
                    src={typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : ""}
                    width={FRAME_W}
                    height={FRAME_H - 12}
                    className="h-full w-full border-0"
                    onLoad={() => window.setTimeout(runAudit, 900)}
                  />
                </div>
              </div>
            </div>

            {/* Report */}
            <aside className="flex min-h-0 w-full flex-col rounded-2xl border border-border/60 bg-card/80 lg:w-[380px]">
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                {issues.length === 0 && ran ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
                <div className="text-sm font-bold">
                  {!ran ? "Analisando…" : issues.length === 0 ? "Nenhum problema encontrado" : `${errors} bloqueios · ${warns} avisos`}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {ran && issues.length === 0 && (
                  <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                    Tudo acessível em 390px: sem cortes, alvos de toque adequados e prévia ao alcance.
                  </p>
                )}
                {issues.map((issue) => {
                  const Icon = KIND_META[issue.kind].icon;
                  return (
                    <button
                      key={issue.id}
                      type="button"
                      onClick={() => focusIssue(issue)}
                      className="flex w-full gap-3 rounded-xl border border-border/60 bg-background/60 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span
                        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                          issue.severity === "error" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-500"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-xs font-bold">{issue.title}</span>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {KIND_META[issue.kind].label}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{issue.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
                Clique em um item para rolar até ele dentro do simulador.
              </p>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
