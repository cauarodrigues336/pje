import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ExternalLink, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatCNJ, formatDate, STATUS_LABELS } from "@/lib/pje";
import { useAuth } from "@/hooks/use-auth";

interface Search { q?: string }

export const Route = createFileRoute("/consulta")({
  validateSearch: (s: Record<string, unknown>): Search => ({ q: typeof s.q === "string" ? s.q : undefined }),
  head: () => ({ meta: [{ title: "Consulta Pública — PJe" }] }),
  component: Consulta,
});

interface Row {
  id: string; numero: string; classe: string; assunto: string;
  orgao_julgador: string; status: keyof typeof STATUS_LABELS;
  data_distribuicao: string; segredo_justica: boolean;
}

function Consulta() {
  const { q } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState(q ?? "");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  const buscar = async (term: string) => {
    setLoading(true);
    const numero = term.replace(/\D/g, "");
    // #15: processos em segredo de justiça NÃO aparecem na consulta pública.
    let qb = supabase.from("processos")
      .select("id,numero,classe,assunto,orgao_julgador,status,data_distribuicao,segredo_justica")
      .eq("segredo_justica", false)
      .eq("is_rascunho", false)
      .limit(200).order("data_distribuicao", { ascending: false });
    if (!numero && term) qb = qb.or(`assunto.ilike.%${term}%,classe.ilike.%${term}%`);
    const { data } = await qb;
    // Filtro client-side pelo número CNJ (banco armazena formatado, entrada é só dígitos).
    let list = (data as Row[]) ?? [];
    if (numero) list = list.filter((p) => p.numero.replace(/\D/g, "").includes(numero));
    setRows(list.slice(0, 50));
    setLoading(false);
  };


  useEffect(() => { if (q) buscar(q); }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/consulta", search: { q: query } });
    buscar(query);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <nav className="text-xs text-muted-foreground mb-3">
            <Link to="/" className="hover:text-primary">Início</Link> / <span className="text-foreground">Consulta Pública</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-bold">Consulta processual</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pesquise por número CNJ, classe ou assunto. Processos sob segredo de justiça
            exigem autenticação com vínculo aos autos.
          </p>

          <form onSubmit={submit} className="mt-6 bg-card border border-border rounded-lg p-3 flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 border border-input rounded">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  const onlyDigits = e.target.value.replace(/\D/g, "");
                  setQuery(onlyDigits.length > 4 ? formatCNJ(e.target.value) : e.target.value);
                }}
                placeholder="Número CNJ ou termo (classe, assunto)"
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-11"
              />
            </div>
            <Button type="submit" size="lg" className="h-11" disabled={loading}>
              {loading ? "Buscando…" : "Pesquisar"}
            </Button>
          </form>

          <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="text-sm font-semibold">
                {rows === null ? "Aguardando pesquisa" : `${rows.length} resultado(s)`}
              </div>
              {!user && <div className="text-xs text-muted-foreground">Entre para ver detalhes completos</div>}
            </div>
            {rows === null ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Digite um termo e pressione Pesquisar para iniciar a consulta.
              </div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhum processo encontrado para o termo informado.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((p) => (
                  <li key={p.id} className="px-4 py-4 hover:bg-muted/30 transition">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={user ? "/processos/$id" : "/auth"}
                            params={user ? { id: p.id } : undefined as never}
                            className="font-mono text-sm font-semibold text-primary hover:underline"
                          >
                            {formatCNJ(p.numero)}
                          </Link>
                          <StatusBadge status={p.status} />
                          {p.segredo_justica && (
                            <span className="inline-flex items-center gap-1 text-xs bg-warning/15 text-warning-foreground border border-warning/40 px-2 py-0.5 rounded">
                              <Lock className="size-3" /> Segredo de justiça
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-medium">{p.classe} — {p.assunto}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.orgao_julgador} · Distribuído em {formatDate(p.data_distribuicao)}
                        </div>
                      </div>
                      <Link
                        to={user ? "/processos/$id" : "/auth"}
                        params={user ? { id: p.id } : undefined as never}
                        className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        Abrir autos <ExternalLink className="size-3" />
                      </Link>
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
