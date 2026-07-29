import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ShowcaseKind } from "@/lib/showcase";

type Template = { label: string; build: (name: string) => string };

const MENU_SHORT: Template[] = [
  { label: "Apetitosa", build: (n) => `${n || "Nosso destaque"}: preparado na hora com ingredientes selecionados, sabor marcante que conquista no primeiro pedido.` },
  { label: "Artesanal", build: (n) => `${n || "Receita artesanal"} feito com carinho, receita da casa e temperos frescos que fazem toda a diferença.` },
  { label: "Clássico", build: (n) => `${n || "Um clássico"} do cardápio — do jeito que você gosta, na medida certa e sempre bem servido.` },
  { label: "Premium", build: (n) => `${n || "Experiência premium"} com ingredientes nobres e apresentação impecável para quem busca o melhor.` },
  { label: "Curto (delivery)", build: (n) => `${n || "Peça já"} — quentinho, saboroso e pronto para chegar até você.` },
  { label: "Combo/porção", build: (n) => `${n || "Combo especial"} ideal para dividir: porção generosa que serve bem a mesa toda.` },
  { label: "Refrescante", build: (n) => `${n || "Refrescante"} e leve, perfeito para acompanhar sua refeição ou refrescar o dia.` },
];

const MENU_LONG: Template[] = [
  { label: "Detalhada", build: (n) => `${n || "Este prato"} é preparado diariamente com ingredientes frescos e selecionados. Combinamos temperos da casa e técnica de preparo cuidadosa para entregar uma experiência de sabor equilibrada, aromática e memorável. Acompanha sugestão de harmonização e pode ser adaptado ao seu gosto — basta pedir ao atendente.` },
  { label: "Ingredientes", build: (n) => `${n || "O prato"} leva ingredientes principais [descreva aqui], finalizados com [molho/tempero]. Servido [quente/gelado], acompanha [guarnição]. Ideal para [ocasião/porção].` },
  { label: "História da casa", build: (n) => `Uma receita que faz parte da história da nossa casa. ${n || "Este prato"} nasceu da vontade de oferecer algo autêntico, com o toque especial de quem cozinha com paixão. Cada detalhe é pensado para você sentir o cuidado em cada mordida.` },
  { label: "Sensorial", build: (n) => `${n || "Prepare-se"}: aroma envolvente logo na chegada, textura na medida e um sabor que se desenvolve a cada garfada. Uma combinação pensada para agradar do primeiro ao último pedaço.` },
];

const CATALOG_SHORT: Template[] = [
  { label: "Benefício claro", build: (n) => `${n || "Produto"} pensado para facilitar seu dia a dia — qualidade comprovada e ótimo custo-benefício.` },
  { label: "Premium", build: (n) => `${n || "Linha premium"} com acabamento superior, materiais nobres e design que impressiona.` },
  { label: "Presente", build: (n) => `${n || "Opção perfeita"} para presentear: elegante, prático e sempre bem recebido.` },
  { label: "Best-seller", build: (n) => `Um dos queridinhos da loja — ${n || "este produto"} já conquistou centenas de clientes pela qualidade e entrega rápida.` },
  { label: "Curto (marketplace)", build: (n) => `${n || "Produto"} original, entrega rápida e garantia de satisfação.` },
  { label: "Promocional", build: (n) => `Oferta especial: ${n || "este produto"} por tempo limitado, com preço que não volta mais.` },
  { label: "Ecológico", build: (n) => `${n || "Produto"} sustentável, feito com materiais que respeitam o planeta sem abrir mão da qualidade.` },
];

const CATALOG_LONG: Template[] = [
  { label: "Ficha técnica", build: (n) => `${n || "Este produto"} foi desenvolvido para oferecer o melhor equilíbrio entre qualidade, durabilidade e preço.\n\n• Material: [descreva]\n• Dimensões: [descreva]\n• Cor: [descreva]\n• Conteúdo da embalagem: [descreva]\n\nGarantia e troca conforme o Código de Defesa do Consumidor. Dúvidas? Fale com a gente pelo WhatsApp.` },
  { label: "Benefícios", build: (n) => `Por que escolher ${n || "este produto"}?\n\n1. Qualidade comprovada por centenas de clientes\n2. Ótimo custo-benefício\n3. Entrega rápida e segura\n4. Atendimento humanizado antes, durante e depois da compra\n\nExperimente e sinta a diferença.` },
  { label: "História da marca", build: (n) => `${n || "Este item"} faz parte de uma seleção cuidadosa feita pela nossa loja. Trabalhamos apenas com fornecedores de confiança, produtos originais e itens que realmente entregam o que prometem. Comprar aqui é ter a tranquilidade de ser bem atendido do início ao fim.` },
  { label: "Uso e cuidados", build: (n) => `Como usar ${n || "o produto"}: [descreva].\nCuidados: [limpeza, armazenamento].\nDicas: [combinações, acessórios que combinam].\nIdeal para: [público/ocasião].` },
];

export function DescriptionTemplates({
  kind,
  itemName,
  long,
  onPick,
}: {
  kind: ShowcaseKind;
  itemName: string;
  long?: boolean;
  onPick: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const templates =
    kind === "menu"
      ? long ? MENU_LONG : MENU_SHORT
      : long ? CATALOG_LONG : CATALOG_SHORT;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Usar modelo pronto
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] max-w-[90vw] p-2">
        <p className="px-2 pb-2 pt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          Modelos {long ? "de descrição completa" : "de descrição curta"}
        </p>
        <div className="grid gap-1">
          {templates.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                onPick(t.build(itemName.trim()));
                setOpen(false);
              }}
              className="group flex flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-primary/10"
            >
              <span className="text-sm font-medium text-foreground">{t.label}</span>
              <span className="line-clamp-2 text-[11px] text-muted-foreground group-hover:text-foreground/80">
                {t.build(itemName.trim() || (kind === "menu" ? "Nosso destaque" : "Este produto"))}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 px-2 pb-1 text-[10px] text-muted-foreground">
          O modelo substitui o texto atual. Você pode editá-lo depois.
        </p>
      </PopoverContent>
    </Popover>
  );
}
