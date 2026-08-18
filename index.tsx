import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, FileText, Gavel, Users, ShieldCheck, ArrowRight, Scale, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { supabase } from "@/integrations/supabase/client";
import { formatCNJ } from "@/lib/pje";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PJe — Processo Judicial Eletrônico" },
      { name: "description", content: "Portal oficial de tramitação de processos judiciais em meio eletrônico." },
    ],
  }),
  component: Home,
});

function Home() {
  const [numero, setNumero] = useState("");
  const [stats, setStats] = useState({ total: 0, em_tramitacao: 0, julgados: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    supabase.rpc("public_processos_stats").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        setStats({
          total: Number(row.total ?? 0),
          em_tramitacao: Number(row.em_tramitacao ?? 0),
          julgados: Number(row.julgados ?? 0),
        });
      }
    });
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/consulta", search: { q: numero } as never });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* HERO */}
        <section className="bg-gradient-to-b from-header to-primary text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 py-12 md:py-20 grid gap-8 md:grid-cols-[1.2fr_1fr] items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs bg-white/10 border border-white/15 px-3 py-1 rounded-full mb-4">
                <ShieldCheck className="size-3.5" /> Conforme Resolução CNJ nº 185/2013
              </div>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                Processo Judicial Eletrônico
              </h1>
              <p className="mt-4 text-base md:text-lg text-white/85 max-w-xl">
                Tramite processos, peticione, acompanhe intimações e consulte
                autos digitais 24 horas por dia, em todo o território nacional.
              </p>

              <form onSubmit={submit} className="mt-8 bg-card text-foreground p-3 rounded-lg shadow-lg flex flex-col sm:flex-row gap-2 max-w-2xl">
                <div className="flex-1 flex items-center gap-2 px-3 border border-input rounded">
                  <Search className="size-4 text-muted-foreground" />
                  <Input
                    value={numero}
                    onChange={(e) => setNumero(formatCNJ(e.target.value))}
                    placeholder="Número CNJ: 0000000-00.0000.0.00.0000"
                    className="border-0 shadow-none focus-visible:ring-0 px-0 h-11"
                  />
                </div>
                <Button type="submit" size="lg" className="h-11">
                  Consultar
                </Button>
              </form>
              <p className="text-xs text-white/70 mt-2">
                Princípio da publicidade — consulta gratuita conforme art. 5º, LX, CF.
              </p>
            </div>

            <div className="hidden md:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-white/5 rounded-2xl blur-2xl" />
                <div className="relative bg-card text-foreground rounded-lg shadow-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="size-9 rounded bg-primary text-primary-foreground flex items-center justify-center">
                        <Scale className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Autos digitais</div>
                        <div className="font-semibold text-sm">Exemplo de tramitação</div>
                      </div>
                    </div>
                    <span className="text-xs bg-info/15 text-info border border-info/30 px-2 py-0.5 rounded">Demonstração</span>
                  </div>
                  <div className="space-y-2 text-sm border-t border-border pt-3">
                    {[
                      { d: "—", t: "Despacho", c: "Será exibido quando houver movimentação." },
                      { d: "—", t: "Juntada", c: "Petições aparecerão aqui." },
                      { d: "—", t: "Distribuição", c: "Origem do processo." },
                    ].map((m, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="text-xs tabular-nums text-muted-foreground w-20 shrink-0">{m.d}</div>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-primary">{m.t}</div>
                          <div className="text-xs text-muted-foreground">{m.c}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PERFIS */}
        <section className="mx-auto max-w-7xl px-4 py-14">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-widest text-primary font-semibold">Perfis de acesso</div>
            <h2 className="text-2xl md:text-3xl font-bold mt-1">Acesso unificado para todos os perfis</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Um único ponto de entrada para magistrados, servidores, advogados,
              membros do Ministério Público e cidadãos. O sistema reconhece
              automaticamente o seu perfil após o login.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, t: "Advogado", d: "Peticione, anexe documentos e acompanhe intimações eletrônicas." },
              { icon: FileText, t: "Cidadão", d: "Consulte processos públicos e acompanhe demandas de seu interesse." },
              { icon: Building2, t: "Servidor", d: "Autue, distribua e movimente processos. Gerencie expedientes." },
              { icon: Gavel, t: "Magistrado", d: "Despache, decida e profira sentenças com assinatura digital." },
            ].map((p) => (
              <div key={p.t} className="bg-card border border-border rounded-lg p-5">
                <p.icon className="size-7 text-primary" />
                <div className="mt-3 font-semibold">{p.t}</div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Link to="/auth" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Entrar no sistema <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        {/* NÚMEROS */}
        <section className="bg-secondary border-y border-border">
          <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { n: stats.em_tramitacao.toLocaleString("pt-BR"), l: "Processos em tramitação" },
              { n: stats.total.toLocaleString("pt-BR"), l: "Processos no acervo" },
              { n: stats.julgados.toLocaleString("pt-BR"), l: "Processos julgados" },
              { n: "24/7", l: "Disponibilidade" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-2xl md:text-3xl font-bold text-primary tabular-nums">{s.n}</div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* AVISOS */}
        <section className="mx-auto max-w-7xl px-4 py-14">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-xs uppercase tracking-widest text-primary font-semibold">Comunicados</div>
            <h3 className="text-xl font-bold mt-1 mb-4">Avisos importantes</h3>
            <ul className="divide-y divide-border">
              {[
                { d: "03/06", t: "Manutenção programada", c: "Sábado, 07/06, das 02h às 04h." },
                { d: "28/05", t: "Nova versão 2.x liberada", c: "Melhorias de acessibilidade e desempenho." },
                { d: "15/05", t: "Atualização de credenciais", c: "Verifique periodicamente seus dados cadastrais." },
              ].map((a, i) => (
                <li key={i} className="py-3 flex gap-4">
                  <div className="text-xs tabular-nums text-muted-foreground w-12 shrink-0 pt-0.5">{a.d}</div>
                  <div>
                    <div className="font-semibold text-sm">{a.t}</div>
                    <div className="text-sm text-muted-foreground">{a.c}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
