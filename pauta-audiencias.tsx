import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatCNJ } from "@/lib/pje";
import { CalendarClock, MapPin, Video, Users2, Gavel } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pauta-audiencias")({
  head: () => ({ meta: [{ title: "Pauta de Audiências — PJe" }] }),
  component: Pauta,
});

const STATUS_COLOR: Record<string, string> = {
  designada: "bg-info/15 text-info",
  redesignada: "bg-warning/20 text-warning-foreground",
  cancelada: "bg-destructive/15 text-destructive",
  realizada: "bg-success/15 text-success",
};

const MOD_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  presencial: MapPin, virtual: Video, hibrida: Users2,
};

interface Audiencia {
  id: string; data_hora: string; modalidade: string; local: string | null;
  link: string | null; magistrado_nome: string | null; vara: string | null;
  status: string; observacoes: string | null;
  processo: { id: string; numero: string; classe: string; orgao_julgador: string | null } | null;
  partes: { nome: string; tipo: string; user_id: string | null }[];
}

function Pauta() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Audiencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Advogado só vê audiências onde é vinculado (partes.user_id = auth.uid)
      // ou onde tem habilitação deferida (numero_processo bate)
      const { data: aud } = await supabase.from("audiencias")
        .select(`id,data_hora,modalidade,local,link,magistrado_nome,vara,status,observacoes,
                 processo:processo_id (id,numero,classe,orgao_julgador)`)
        .order("data_hora", { ascending: true });

      const ids = ((aud ?? []) as Audiencia[]).map((a) => a.processo?.id).filter(Boolean) as string[];
      const partesMap: Record<string, Audiencia["partes"]> = {};
      if (ids.length) {
        const { data: pts } = await supabase.from("partes").select("processo_id,nome,tipo,user_id").in("processo_id", ids);
        (pts ?? []).forEach((p: { processo_id: string; nome: string; tipo: string; user_id: string | null }) => {
          (partesMap[p.processo_id] ||= []).push({ nome: p.nome, tipo: p.tipo, user_id: p.user_id });
        });
      }

      // Habilitações deferidas do usuário
      const { data: habs } = await supabase.from("habilitacoes")
        .select("processo_id").eq("solicitante_id", user.id).eq("status", "deferida");
      const procsHab = new Set(((habs ?? []) as { processo_id: string }[]).map((h) => h.processo_id));

      const out: Audiencia[] = ((aud ?? []) as Audiencia[])
        .map((a) => ({ ...a, partes: partesMap[a.processo?.id ?? ""] ?? [] }))
        .filter((a) => {
          if (!a.processo) return false;
          const vinculado = a.partes.some((p) => p.user_id === user.id);
          const habilitado = procsHab.has(a.processo.id);
          return vinculado || habilitado;
        });
      setRows(out);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center gap-2 mb-1"><CalendarClock className="size-6 text-primary" /><h1 className="text-2xl md:text-3xl font-bold">Pauta de Audiências</h1></div>
          <p className="text-sm text-muted-foreground">Apenas audiências dos processos em que você representa uma parte ou tem habilitação ativa.</p>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : rows.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
                Nenhuma audiência designada nos seus processos.
              </div>
            ) : (
              rows.map((a) => {
                const Icon = MOD_ICON[a.modalidade] ?? MapPin;
                const minhaParte = a.partes.find((p) => p.user_id === user?.id);
                return (
                  <div key={a.id} className="bg-card border border-border rounded-lg p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link to="/processos/$id" params={{ id: a.processo!.id }} className="font-mono text-sm font-semibold text-primary hover:underline">{formatCNJ(a.processo!.numero)}</Link>
                        <div className="text-sm mt-0.5">{a.processo!.classe}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Gavel className="size-3" /> {a.magistrado_nome ?? "—"} · {a.vara ?? a.processo!.orgao_julgador ?? "—"}</div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${STATUS_COLOR[a.status] ?? ""}`}>{a.status}</span>
                        <div className="text-sm font-semibold mt-1">{formatDateTime(a.data_hora)}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><Icon className="size-3.5" /> Modalidade: <span className="font-medium text-foreground capitalize">{a.modalidade}</span></div>
                      {a.local && <div><MapPin className="size-3.5 inline mr-1" /> {a.local}</div>}
                      {a.link && <div className="sm:col-span-2"><Video className="size-3.5 inline mr-1" /> <a className="text-primary hover:underline" href={a.link} target="_blank" rel="noreferrer">Link da videoconferência</a></div>}
                    </div>

                    <div className="mt-3 text-xs">
                      <div className="text-muted-foreground">Partes:</div>
                      <div className="mt-1">{a.partes.map((p) => `${p.nome} (${p.tipo})`).join(" × ") || "—"}</div>
                      {minhaParte && (
                        <div className="mt-2 inline-block bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold text-[11px]">
                          Você representa: {minhaParte.nome}
                        </div>
                      )}
                    </div>
                    {a.observacoes && <div className="mt-3 text-xs text-muted-foreground italic">{a.observacoes}</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
