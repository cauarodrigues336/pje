import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { formatCNJ, formatDate, STATUS_LABELS, canCreateProcess } from "@/lib/pje";

export const Route = createFileRoute("/_authenticated/processos/")({
  head: () => ({ meta: [{ title: "Processos — PJe" }] }),
  component: Lista,
});

interface Row { id: string; numero: string; classe: string; assunto: string; orgao_julgador: string; status: keyof typeof STATUS_LABELS; data_distribuicao: string; prioridade: boolean }

function Lista() {
  const { role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const canCreate = canCreateProcess(role);

  const load = async (term?: string) => {
    let qb = supabase.from("processos").select("id,numero,classe,assunto,orgao_julgador,status,data_distribuicao,prioridade").order("data_distribuicao", { ascending: false }).limit(100);
    if (term) {
      const n = term.replace(/\D/g, "");
      qb = n ? qb.ilike("numero", `%${n}%`) : qb.or(`assunto.ilike.%${term}%,classe.ilike.%${term}%`);
    }
    const { data } = await qb;
    setRows((data as Row[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-semibold">Acervo</div>
              <h1 className="text-2xl md:text-3xl font-bold">Processos</h1>
            </div>
            {canCreate && (
              <Link to="/novo-processo">
                <Button className="gap-2"><Plus className="size-4" /> Autuar processo</Button>
              </Link>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="mt-5 bg-card border border-border rounded-lg p-3 flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 border border-input rounded">
              <Search className="size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por número, classe ou assunto" className="border-0 shadow-none focus-visible:ring-0 px-0 h-10" />
            </div>
            <Button type="submit">Pesquisar</Button>
          </form>

          <div className="mt-5 bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Número</th>
                    <th className="text-left px-4 py-3">Classe / Assunto</th>
                    <th className="text-left px-4 py-3">Órgão</th>
                    <th className="text-left px-4 py-3">Distribuição</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhum processo cadastrado.</td></tr>
                  ) : rows.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to="/processos/$id" params={{ id: p.id }} className="font-mono text-primary font-semibold hover:underline">
                          {formatCNJ(p.numero)}
                        </Link>
                        {p.prioridade && <div className="text-[10px] font-semibold text-warning-foreground bg-warning/20 inline-block px-1.5 mt-1 rounded">PRIORIDADE</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.classe}</div>
                        <div className="text-xs text-muted-foreground">{p.assunto}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{p.orgao_julgador}</td>
                      <td className="px-4 py-3 text-xs tabular-nums">{formatDate(p.data_distribuicao)}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
