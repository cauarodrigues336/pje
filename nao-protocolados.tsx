import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime } from "@/lib/pje";
import { Edit3, Trash2, Copy, Send, FileSignature, FileStack, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nao-protocolados")({
  head: () => ({ meta: [{ title: "Não Protocolados — PJe" }] }),
  component: NaoProtocolados,
});

interface Rascunho {
  id: string; classe: string; assunto: string; created_at: string; updated_at: string;
  percentual_preenchimento: number; partes_nomes: string;
}

function statusFromPct(p: number): "Rascunho" | "Pendente de Assinatura" | "Pronto para Protocolar" {
  if (p >= 100) return "Pronto para Protocolar";
  if (p >= 70) return "Pendente de Assinatura";
  return "Rascunho";
}

function NaoProtocolados() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Rascunho[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroClasse, setFiltroClasse] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [ordem, setOrdem] = useState<"data_desc" | "data_asc" | "nome">("data_desc");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: procs } = await supabase.from("processos")
      .select("id,classe,assunto,created_at,updated_at,percentual_preenchimento")
      .eq("criado_por", user.id).eq("is_rascunho", true)
      .order("updated_at", { ascending: false });
    const ids = (procs ?? []).map((p: { id: string }) => p.id);
    const partesMap: Record<string, string[]> = {};
    if (ids.length) {
      const { data: pts } = await supabase.from("partes").select("processo_id,nome").in("processo_id", ids);
      (pts ?? []).forEach((p: { processo_id: string; nome: string }) => {
        (partesMap[p.processo_id] ||= []).push(p.nome);
      });
    }
    setRows((procs ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string, classe: (p.classe as string) ?? "—", assunto: (p.assunto as string) ?? "—",
      created_at: p.created_at as string, updated_at: p.updated_at as string,
      percentual_preenchimento: (p.percentual_preenchimento as number) ?? 0,
      partes_nomes: (partesMap[p.id as string] ?? []).join(" × ") || "—",
    })));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const classes = useMemo(() => Array.from(new Set(rows.map((r) => r.classe))), [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      out = out.filter((r) => r.classe.toLowerCase().includes(q) || r.assunto.toLowerCase().includes(q) || r.partes_nomes.toLowerCase().includes(q));
    }
    if (filtroClasse !== "todas") out = out.filter((r) => r.classe === filtroClasse);
    if (filtroStatus !== "todos") out = out.filter((r) => statusFromPct(r.percentual_preenchimento) === filtroStatus);
    if (ordem === "data_desc") out = [...out].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (ordem === "data_asc") out = [...out].sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    if (ordem === "nome") out = [...out].sort((a, b) => a.classe.localeCompare(b.classe));
    return out;
  }, [rows, busca, filtroClasse, filtroStatus, ordem]);

  const excluir = async (id: string) => {
    if (!confirm("Excluir este rascunho?")) return;
    await supabase.from("processos").delete().eq("id", id);
    toast.success("Rascunho excluído");
    load();
  };
  const duplicar = async (id: string) => {
    const { data: orig } = await supabase.from("processos").select("*").eq("id", id).maybeSingle();
    if (!orig) return;
    const { id: _, numero: __, created_at: ___, updated_at: ____, ...rest } = orig;
    const { data: novo, error } = await supabase.from("processos").insert({ ...rest, is_rascunho: true }).select("id").maybeSingle();
    if (error || !novo) return toast.error("Erro ao duplicar");
    const { data: pts } = await supabase.from("partes").select("*").eq("processo_id", id);
    if (pts && pts.length) await supabase.from("partes").insert(pts.map((p: Record<string, unknown>) => ({
      processo_id: novo.id, nome: p.nome, documento: p.documento, tipo: p.tipo,
      advogado_nome: p.advogado_nome, advogado_oab: p.advogado_oab,
    })));
    toast.success("Rascunho duplicado");
    load();
  };
  const assinar = async (id: string) => {
    await supabase.from("processos").update({ percentual_preenchimento: 90 }).eq("id", id);
    toast.success("Rascunho marcado como assinado — pronto para protocolar");
    load();
  };
  const protocolar = (id: string) => navigate({ to: "/novo-processo", search: { draft: id } });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center gap-2 mb-1"><FileStack className="size-6 text-primary" /><h1 className="text-2xl md:text-3xl font-bold">Não Protocolados</h1></div>
          <p className="text-sm text-muted-foreground">Seus rascunhos de processos. Edite, assine e protocole quando estiverem completos.</p>

          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_180px_180px_180px]">
            <div className="relative">
              <Search className="size-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por classe, assunto ou parte…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select value={filtroClasse} onValueChange={setFiltroClasse}>
              <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as classes</SelectItem>
                {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="Rascunho">Rascunho</SelectItem>
                <SelectItem value="Pendente de Assinatura">Pendente de Assinatura</SelectItem>
                <SelectItem value="Pronto para Protocolar">Pronto para Protocolar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="data_desc">Mais recentes</SelectItem>
                <SelectItem value="data_asc">Mais antigos</SelectItem>
                <SelectItem value="nome">Classe (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-5 bg-card border border-border rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhum rascunho encontrado. <Link to="/novo-processo" className="text-primary hover:underline">Iniciar novo processo</Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((r) => {
                  const st = statusFromPct(r.percentual_preenchimento);
                  return (
                    <li key={r.id} className="p-4 hover:bg-muted/20">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-[240px]">
                          <div className="font-mono text-xs text-muted-foreground">#{r.id.slice(0, 8)}</div>
                          <div className="font-semibold">{r.classe} — <span className="text-muted-foreground font-normal">{r.assunto}</span></div>
                          <div className="text-xs text-muted-foreground mt-1">Partes: {r.partes_nomes}</div>
                          <div className="text-xs text-muted-foreground mt-1">Criado em {formatDate(r.created_at)} · Modificado em {formatDateTime(r.updated_at)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 min-w-[160px]">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${st === "Pronto para Protocolar" ? "bg-success/15 text-success" : st === "Pendente de Assinatura" ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>{st}</span>
                          <div className="w-full h-1.5 bg-muted rounded overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${r.percentual_preenchimento}%` }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground">{r.percentual_preenchimento}% preenchido</span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => protocolar(r.id)} className="gap-1"><Edit3 className="size-3.5" /> Editar</Button>
                        <Button size="sm" variant="outline" onClick={() => duplicar(r.id)} className="gap-1"><Copy className="size-3.5" /> Duplicar</Button>
                        <Button size="sm" variant="outline" onClick={() => assinar(r.id)} className="gap-1"><FileSignature className="size-3.5" /> Assinar</Button>
                        <Button size="sm" onClick={() => protocolar(r.id)} className="gap-1"><Send className="size-3.5" /> Protocolar</Button>
                        <Button size="sm" variant="ghost" onClick={() => excluir(r.id)} className="gap-1 text-destructive hover:text-destructive"><Trash2 className="size-3.5" /> Excluir</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
