import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, FileText } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { useAuth } from "@/hooks/use-auth";
import { formatCNJ, formatDateTime } from "@/lib/pje";

export const Route = createFileRoute("/_authenticated/intimacoes")({
  head: () => ({ meta: [{ title: "Minhas intimações — PJe" }] }),
  component: Intimacoes,
});

const TIPO_LABEL: Record<string, string> = {
  decisao: "Decisão", despacho: "Despacho", sentenca: "Sentença", mandado: "Mandado",
};

interface Row {
  id: string;
  tipo: string;
  titulo: string;
  arquivo_url: string | null;
  created_at: string;
  processo_id: string;
  processos: { numero: string; orgao_julgador: string | null } | null;
}

function Intimacoes() {
  const { user } = useAuth();
  const now = new Date();
  const [mes, setMes] = useState(now.toISOString().slice(0, 7)); // YYYY-MM
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // pega processos onde o usuário figura como parte OU patrono
      const { data: minhasPartes } = await supabase.from("partes").select("processo_id").eq("user_id", user.id);
      const ids = Array.from(new Set(((minhasPartes ?? []) as { processo_id: string }[]).map((p) => p.processo_id)));
      if (ids.length === 0) { setRows([]); setLoading(false); return; }
      const [ano, m] = mes.split("-").map(Number);
      const inicio = new Date(ano, m - 1, 1).toISOString();
      const fim = new Date(ano, m, 1).toISOString();
      const { data } = await supabase
        .from("documentos_processo")
        .select("id,tipo,titulo,arquivo_url,created_at,processo_id,processos(numero,orgao_julgador)")
        .in("tipo", ["decisao", "despacho", "sentenca", "mandado"])
        .eq("publicado_dje", true)
        .in("processo_id", ids)
        .gte("created_at", inicio)
        .lt("created_at", fim)
        .order("created_at", { ascending: false });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [user, mes]);

  const grupos = useMemo(() => {
    const g: Record<string, Row[]> = {};
    rows.forEach((r) => {
      const k = r.created_at.slice(0, 10);
      (g[k] ||= []).push(r);
    });
    return Object.entries(g).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  const baixar = async (r: Row) => {
    if (!r.arquivo_url) return toast.info("Sem PDF anexado. Consulte no Diário Judicial.");
    const { data, error } = await supabase.storage.from("processos-docs").createSignedUrl(r.arquivo_url, 60);
    if (error || !data) return toast.error("Falha ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded bg-primary text-primary-foreground flex items-center justify-center"><Bell className="size-5" /></div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold">Minhas intimações</h1>
              <p className="text-sm text-muted-foreground">Publicações do DJE em processos onde você figura como parte ou patrono habilitado.</p>
            </div>
            <div>
              <Label className="text-xs">Mês</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="text-center text-sm text-muted-foreground py-12">Carregando…</div>
            ) : grupos.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
                Nenhuma intimação no período.
              </div>
            ) : grupos.map(([dia, items]) => (
              <div key={dia} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Edição de {formatDateTime(dia + "T12:00:00").slice(0, 10)} — {items.length} publicação(ões)
                </div>
                <ul className="divide-y divide-border">
                  {items.map((r) => (
                    <li key={r.id} className="p-4 flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-semibold uppercase text-primary">{TIPO_LABEL[r.tipo] ?? r.tipo}</span>
                          <span className="text-muted-foreground">·</span>
                          <Link to="/processos/$id" params={{ id: r.processo_id }} className="font-mono text-primary hover:underline">
                            {formatCNJ(r.processos?.numero ?? "")}
                          </Link>
                          {r.processos?.orgao_julgador && (<><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{r.processos.orgao_julgador}</span></>)}
                        </div>
                        <div className="text-sm font-medium mt-1">{r.titulo}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{formatDateTime(r.created_at)}</div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => baixar(r)}>
                        <FileText className="size-3" /> PDF
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
