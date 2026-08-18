import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Inbox, ChevronRight } from "lucide-react";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/hooks/use-auth";
import { formatCNJ, formatDateTime } from "@/lib/pje";

export const Route = createFileRoute("/_authenticated/meus-processos")({
  head: () => ({ meta: [{ title: "Meus processos — PJe" }] }),
  component: Meus,
});

interface Row { id: string; numero: string; classe: string; assunto: string; data_distribuicao: string; orgao_julgador: string | null }

function Meus() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // 1. Como parte / advogado (partes.user_id)
      const { data: pt } = await supabase
        .from("partes")
        .select("processos:processo_id (id,numero,classe,assunto,data_distribuicao,orgao_julgador,is_rascunho)")
        .eq("user_id", user.id);
      // 2. Como criador (rascunhos e processos protocolados)
      const { data: cr } = await supabase
        .from("processos")
        .select("id,numero,classe,assunto,data_distribuicao,orgao_julgador,is_rascunho")
        .eq("criado_por", user.id);
      // 3. Como advogado (via OAB do perfil vs advogado_oab da parte)
      const { data: prof } = await supabase.from("profiles").select("oab").eq("id", user.id).maybeSingle();
      let byOab: Row[] = [];
      if (prof?.oab) {
        const { data: ptAdv } = await supabase
          .from("partes")
          .select("processos:processo_id (id,numero,classe,assunto,data_distribuicao,orgao_julgador,is_rascunho)")
          .eq("advogado_oab", prof.oab);
        byOab = ((ptAdv ?? []) as { processos: Row & { is_rascunho: boolean } | null }[])
          .map((r) => r.processos).filter(Boolean) as Row[];
      }
      const list1 = ((pt ?? []) as { processos: Row & { is_rascunho: boolean } | null }[]).map((r) => r.processos).filter(Boolean) as Row[];
      const list2 = ((cr ?? []) as Row[]).filter((p) => !(p as unknown as { is_rascunho: boolean }).is_rascunho);
      const merged = [...list1, ...list2, ...byOab.filter((p) => !(p as unknown as { is_rascunho: boolean }).is_rascunho)];
      const unique = Array.from(new Map(merged.map((p) => [p.id, p])).values());
      setRows(unique.sort((a, b) => +new Date(b.data_distribuicao) - +new Date(a.data_distribuicao)));
    })();
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-2xl md:text-3xl font-bold">Meus processos</h1>
          <p className="text-sm text-muted-foreground mt-1">Processos em que você figura como parte, advogado, promotor, interessado ou autor do protocolo.</p>

          <div className="mt-6 bg-card border border-border rounded-lg">
            {rows === null ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Inbox className="size-6 text-muted-foreground/60" />
                Nenhum processo vinculado ao seu usuário.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((p) => (
                  <li key={p.id}>
                    <Link to="/processos/$id" params={{ id: p.id }} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-semibold text-primary">{formatCNJ(p.numero)}</div>
                        <div className="text-sm font-medium mt-0.5">{p.classe} — {p.assunto}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{p.orgao_julgador ?? "—"} · {formatDateTime(p.data_distribuicao)}</div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
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
