import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, UserCheck, Check, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { useAuth } from "@/hooks/use-auth";
import { formatCNJ, formatDateTime, isInternalRole } from "@/lib/pje";

export const Route = createFileRoute("/_authenticated/habilitacoes-pendentes")({
  head: () => ({ meta: [{ title: "Habilitações pendentes — PJe" }] }),
  component: Pendentes,
});

interface Hab {
  id: string; numero_processo: string | null; processo_id: string | null;
  cpf_cnpj: string | null; tipo: string; justificativa: string | null;
  status: string; created_at: string;
  documentos: { path: string; nome: string; tipo: string }[] | null;
  solicitante_id: string;
  profiles?: { nome_completo: string | null; oab: string | null; numero_usuario: string | null } | null;
}

const TIPOS_LBL: Record<string, string> = {
  advogado: "Advogado", substabelecimento: "Substabelecimento",
  representante: "Representante legal", sucessao: "Sucessão processual", outro: "Outro",
};

function Pendentes() {
  const { role, loading } = useAuth();
  const [lista, setLista] = useState<Hab[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("habilitacoes")
      .select("id,numero_processo,processo_id,cpf_cnpj,tipo,justificativa,status,created_at,documentos,solicitante_id,profiles:solicitante_id(nome_completo,oab,numero_usuario)")
      .eq("status", "pendente").order("created_at", { ascending: true });
    setLista((data ?? []) as Hab[]);
  };
  useEffect(() => { if (isInternalRole(role)) load(); }, [role]);

  const decidir = async (h: Hab, decisao: "deferida" | "indeferida") => {
    setBusy(h.id);
    try {
      const evento = decisao === "deferida"
        ? `Habilitação deferida pelo(a) servidor(a).`
        : `Habilitação indeferida pelo(a) servidor(a).`;
      const { data: atual } = await supabase.from("habilitacoes").select("historico").eq("id", h.id).maybeSingle();
      const hist = Array.isArray(atual?.historico) ? atual!.historico : [];
      await supabase.from("habilitacoes").update({
        status: decisao,
        historico: [...hist, { ts: new Date().toISOString(), evento }],
      }).eq("id", h.id);

      // Movimentação no processo (deferida também é feita via trigger, mas garantimos indeferida)
      if (h.processo_id && decisao === "indeferida") {
        await supabase.from("movimentacoes").insert({
          processo_id: h.processo_id, tipo: "peticao",
          descricao: `Habilitação (${TIPOS_LBL[h.tipo] ?? h.tipo}) do(a) ${h.profiles?.nome_completo ?? "solicitante"} — INDEFERIDA.`,
          autor_nome: "SISTEMA", autor_cargo: "Servidor(a)",
        });
      }
      toast.success(decisao === "deferida" ? "Habilitação deferida" : "Habilitação indeferida");
      load();
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    } finally { setBusy(null); }
  };

  const baixarDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("processos-docs").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Falha ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando…</div>;
  if (!isInternalRole(role)) {
    return (
      <div className="flex min-h-screen flex-col"><SiteHeader />
        <main className="flex-1 bg-secondary"><div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <Link to="/painel" className="text-primary text-sm hover:underline mt-4 inline-block">Voltar</Link>
        </div></main><SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Link to="/painel" className="text-sm text-primary inline-flex items-center gap-1 hover:underline mb-3">
            <ChevronLeft className="size-4" /> Voltar
          </Link>
          <div className="flex items-center gap-2"><UserCheck className="size-6 text-primary" /><h1 className="text-2xl md:text-3xl font-bold">Habilitações pendentes</h1></div>
          <p className="text-sm text-muted-foreground">Analise, defira ou indefira as habilitações solicitadas. Ao deferir, o solicitante entra automaticamente no polo do processo.</p>

          <div className="mt-6 bg-card border border-border rounded-lg">
            {lista.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma habilitação pendente.</div>
            ) : (
              <ul className="divide-y divide-border">
                {lista.map((h) => (
                  <li key={h.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-semibold uppercase text-primary">{TIPOS_LBL[h.tipo] ?? h.tipo}</span>
                          {h.processo_id ? (
                            <Link to="/processos/$id" params={{ id: h.processo_id }} className="font-mono text-primary hover:underline">
                              {formatCNJ(h.numero_processo ?? "")}
                            </Link>
                          ) : (
                            <span className="font-mono text-destructive">Processo não localizado ({h.numero_processo ?? "—"})</span>
                          )}
                          <span className="text-muted-foreground">· {formatDateTime(h.created_at)}</span>
                        </div>
                        <div className="text-sm font-medium mt-1">
                          {h.profiles?.nome_completo ?? "Solicitante"}
                          {h.profiles?.oab && <span className="text-xs text-muted-foreground ml-2">OAB {h.profiles.oab}</span>}
                          {h.profiles?.numero_usuario && <span className="text-xs text-muted-foreground ml-2">nº {h.profiles.numero_usuario}</span>}
                        </div>
                        {h.cpf_cnpj && <div className="text-xs text-muted-foreground">CPF/CNPJ da parte representada: <span className="font-mono">{h.cpf_cnpj}</span></div>}
                        {h.justificativa && <div className="text-sm text-foreground/80 mt-2">{h.justificativa}</div>}
                        {h.documentos && h.documentos.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {h.documentos.map((d, i) => (
                              <Button key={i} size="sm" variant="outline" className="gap-1 h-7" onClick={() => baixarDoc(d.path)}>
                                <FileText className="size-3" /> {d.nome}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => decidir(h, "indeferida")} disabled={busy === h.id || !h.processo_id}>
                          <X className="size-3" /> Indeferir
                        </Button>
                        <Button size="sm" className="gap-1" onClick={() => decidir(h, "deferida")} disabled={busy === h.id || !h.processo_id}>
                          <Check className="size-3" /> Deferir
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
