import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

export const Route = createFileRoute("/_authenticated/app/qrcodes")({
  head: () => ({ meta: [{ title: "QR Codes — Fidelize" }] }),
  component: QRCodes,
});

function QRCodes() {
  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { slug: string; name: string; primary_color: string } | undefined;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const url = est ? `${typeof window !== "undefined" ? window.location.origin : ""}/l/${est.slug}` : "";

  useEffect(() => {
    if (!est || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 320, margin: 2, color: { dark: est.primary_color || "#000000", light: "#ffffff" } });
    QRCode.toDataURL(url, { width: 800, margin: 2, color: { dark: est.primary_color || "#000000", light: "#ffffff" } }).then(setDataUrl);
  }, [est, url]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Divulgação</div>
        <h1 className="font-display text-3xl font-bold">Seu QR Code</h1>
        <p className="text-sm text-muted-foreground mt-1">Imprima e cole no balcão. Cada cliente que escanear entra no seu programa.</p>
      </div>
      <Card>
        <CardContent className="p-8 grid md:grid-cols-2 gap-8 items-center">
          <div className="flex justify-center">
            <canvas ref={canvasRef} className="rounded-2xl border shadow-sm" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Link público</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted p-3 text-sm break-all">{url}</code>
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            {dataUrl && (
              <Button asChild variant="outline"><a href={dataUrl} download={`qrcode-${est?.slug}.png`}><Download className="h-4 w-4 mr-2" />Baixar imagem</a></Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
