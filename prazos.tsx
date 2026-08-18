import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { useAuth } from "@/hooks/use-auth";
import { formatCNJ, formatDate, formatDateTime, DESTINATARIO_LABELS, PRAZO_STATUS_LABELS } from "@/lib/pje";

export const Route = createFileRoute("/_authenticated/prazos")({
  head: () => ({
    meta: [
      { title: "Prazos processuais — PJe" },
      { name: "description", content: "Acompanhe seus prazos processuais pendentes, cumpridos, vencidos e encerrados no PJe." },
      { property: "og:title", content: "Prazos processuais — PJe" },
      { property: "og:description", content: "Painel de prazos processuais do advogado, Ministério Público e Defensoria Pública." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrazosPage,
});

interface PrazoRow {
  id: string;
  processo_id: string;
  parte_nome: string;
  parte_representada: string | null;
  ato_processual: string | null;
  descricao: string | null;
  destinatario_tipo: string;
  inicio_em: string;
  dias: number | null;
  vence_em: string;
  status: string;
  cumprido: boolean;
  processo?: { numero: string; classe: string; orgao_julgador: string | null } | null;
}

function situacao(p: PrazoRow): string {
  if (p.cumprido || p.status === "cumprido") return "cumprido";
  if (p.status === "encerrado") return "encerrado";
  if (new Date(p.vence_em) < new Date()) return "vencido";
  return "pendente";
}

function diasRestantes(vence: string): number {
  return Math.ceil((new Date(vence).getTime() - Date.now()) / 86400000);
}

const TONE: Record<string, string> = {
  pendente: "bg-info/15 text-info",
  cumprido: "bg-success/15 text-success",
  vencido: "bg-destructive/15 text-destructive",
  encerrado: "bg-muted text-muted-foreground",
};

function PrazosPage() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState<PrazoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("prazos")
      .select("id,processo_id,parte_nome,parte_representada,ato_processual,descricao,destinatario_tipo,inicio_em,dias,vence_em,status,cumprido")
      .order("vence_em", { ascending: true });
    const list = (data ?? []) as PrazoRow[];
    const ids = Array.from(new Set(list.map((p) => p.processo_id)));
    if (ids.length > 0) {
      const { data: procs } = await supabase.from("processos").select("id,numero,classe,orgao_julgador").in("id", ids);
      const map: Record<string, PrazoRow["processo"]> = {};
      ((procs ?? []) as Array<{ id: string; numero: string; classe: string; orgao_julgador: string | null }>).forEach((p) => { map[p.id] = p; });
      list.forEach((p) => { p.processo = map[p.processo_id] ?? null; });
    }
    setRows(list);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const cumprir = async (p: PrazoRow) => {
    const { error } = await supabase.from("prazos")
      .update({ cumprido: true, status: "cumprido", cumprido_em: new Date().toISOString() })
      .eq("id", p.id);
    if (error) return toast.error("Falha ao dar baixa", { description: error.message });
    toast.success("Prazo marcado como cumprido");
    load();
  };

  const filtradas = useMemo(() => {
    const q = busca.replace(/\D/g, "");
    return rows.filter((p) => {
      const st = situacao(p);
      if (filtro !== "todos" && filtro !== st) return false;
      if (busca.trim()) {
        const alvo = `${p.processo?.numero ?? ""}`.replace(/\D/g, "");
        const texto = `${p.parte_representada ?? ""} ${p.parte_nome} ${p.ato_processual ?? ""} ${p.processo?.classe ?? ""}`.toLowerCase();
        if (!(q && alvo.includes(q)) && !texto.includes(busca.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, busca, filtro]);

  const pendentes = rows.filter((p) => situacao(p) === "pendente").length;
  const vencidos = rows.filter((p) => situacao(p) === "vencido").length;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="size-10 rounded bg-primary text-primary-foreground flex items-center justify-center"><Clock className="size-5" /></div>
            <div className="flex-1 min-w-[240px]">
              <h1 className="text-2xl md:text-3xl font-bold">Prazos</h1>
              <p className="text-sm text-muted-foreground">
                Prazos processuais direcionados a você{role ? "" : ""} — {pendentes} pendente(s), {vencidos} vencido(s).
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">Buscar</Label>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Processo, parte ou ato" className="w-56" />
              </div>
              <div>
                <Label className="text-xs">Situação</Label>
                <Select value={filtro} onValueChange={setFiltro}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="cumprido">Cumprido</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-card border border-border rounded-lg overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : filtradas.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Inbox className="size-6 text-muted-foreground/60" /> Nenhum prazo encontrado.
              </div>
            ) : (
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Processo</th>
                    <th className="text-left px-4 py-2">Classe</th>
                    <th className="text-left px-4 py-2">Parte representada</th>
                    <th className="text-left px-4 py-2">Ato processual</th>
                    <th className="text-left px-4 py-2">Início</th>
                    <th className="text-left px-4 py-2">Prazo</th>
                    <th className="text-left px-4 py-2">Final</th>
                    <th className="text-left px-4 py-2">Restam</th>
                    <th className="text-left px-4 py-2">Situação</th>
                    <th className="text-left px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtradas.map((p) => {
                    const st = situacao(p);
                    const restam = diasRestantes(p.vence_em);
                    return (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <Link to="/processos/$id" params={{ id: p.processo_id }} className="font-mono text-primary hover:underline">
                            {formatCNJ(p.processo?.numero ?? "")}
                          </Link>
                          <div className="text-[11px] text-muted-foreground">{DESTINATARIO_LABELS[p.destinatario_tipo] ?? p.destinatario_tipo}</div>
                        </td>
                        <td className="px-4 py-3">{p.processo?.classe ?? "—"}</td>
                        <td className="px-4 py-3">{p.parte_representada ?? p.parte_nome}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.ato_processual ?? p.descricao ?? "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{formatDate(p.inicio_em)}</td>
                        <td className="px-4 py-3 tabular-nums">{p.dias ? `${p.dias} dia(s)` : "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{formatDateTime(p.vence_em)}</td>
                        <td className="px-4 py-3 tabular-nums font-semibold">
                          {st === "pendente" ? `${Math.max(restam, 0)} dia(s)` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${TONE[st]}`}>{PRAZO_STATUS_LABELS[st]}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(st === "pendente" || st === "vencido") && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => cumprir(p)}>
                              <CheckCircle2 className="size-3" /> Cumprir
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
