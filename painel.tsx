import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Gavel, Clock, AlertTriangle, Briefcase, Scale, Inbox, ShieldCheck, Flame, PenLine, FileSignature, Hourglass, Mail, MessageSquare, Layers, AlarmClock } from "lucide-react";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/hooks/use-auth";
import { formatCNJ, formatDateTime, ROLE_LABELS, isInternalRole, type AppRole, isJulgadorRole, isAdvocaciaRole } from "@/lib/pje";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel — PJe" }] }),
  component: Painel,
});

type FilaMag = "despacho" | "decisao" | "sentenca" | "urgente" | "minuta_pendente";
type FilaServ = "expedientes_pendentes" | "comunicacoes_pendentes" | "peticoes_pendentes" | "distribuicao_pendente" | "cumprimento_sentenca" | "prazo_vencido";

const FILA_MAG: { key: FilaMag; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { key: "despacho",        label: "Conclusos para despacho",  icon: PenLine,       tone: "text-info bg-info/10" },
  { key: "decisao",         label: "Conclusos para decisão",   icon: Gavel,         tone: "text-primary bg-primary/10" },
  { key: "sentenca",        label: "Conclusos para sentença",  icon: FileSignature, tone: "text-success bg-success/10" },
  { key: "urgente",         label: "Conclusos urgente",        icon: Flame,         tone: "text-destructive bg-destructive/10" },
  { key: "minuta_pendente", label: "Minutas pendentes",        icon: Hourglass,     tone: "text-warning-foreground bg-warning/20" },
];

const FILA_SERV: { key: FilaServ; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { key: "distribuicao_pendente",  label: "Distribuição pendente",  icon: Layers,        tone: "text-info bg-info/10" },
  { key: "peticoes_pendentes",     label: "Petições pendentes",     icon: FileText,      tone: "text-primary bg-primary/10" },
  { key: "expedientes_pendentes",  label: "Expedientes pendentes",  icon: Mail,          tone: "text-warning-foreground bg-warning/20" },
  { key: "comunicacoes_pendentes", label: "Comunicações pendentes", icon: MessageSquare, tone: "text-info bg-info/10" },
  { key: "cumprimento_sentenca",   label: "Cumprimento de sentença",icon: Gavel,         tone: "text-success bg-success/10" },
  { key: "prazo_vencido",          label: "Prazo vencido",          icon: AlarmClock,    tone: "text-destructive bg-destructive/10" },
];

interface ConclusoRow { id: string; numero: string; classe: string; quando: string; partes: string }

function Painel() {
  const { user, role, nome } = useAuth();
  const interno = isInternalRole(role);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-semibold">
                {interno ? "Painel de gestão" : "Meu painel"}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Bem-vindo(a), {nome ?? user?.email}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Perfil: <span className="font-medium text-foreground">{role ? ROLE_LABELS[role] : "—"}</span>
              </p>
            </div>
          </div>

          {interno ? <InternoView role={role} /> : <ExternoView role={role} />}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function InternoView({ role }: { role: AppRole | null }) {
  const isServ = role === "servidor" || role === "admin";
  const isMag = isJulgadorRole(role);
  const defs = isServ ? FILA_SERV : FILA_MAG;
  const kind: "servidor" | "magistrado" = isServ ? "servidor" : "magistrado";
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      {defs.map((f) => <FilaCard key={f.key} def={f} kind={kind} />)}
      {isServ && <AudienciaFila kind="proximas" scope="servidor" />}
      {isServ && <AudienciaFila kind="atas" scope="servidor" />}
      {isMag && <AudienciaFila kind="proximas" scope="magistrado" />}
      {isMag && <AudienciaFila kind="atas" scope="magistrado" />}
    </div>
  );
}


function AudienciaFila({ kind, scope }: { kind: "proximas" | "atas"; scope: "servidor" | "magistrado" }) {
  const [rows, setRows] = useState<ConclusoRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const meta = kind === "proximas"
    ? { label: scope === "magistrado" ? "Minhas audiências (10 dias)" : "Audiências próximas (10 dias)", icon: AlarmClock, tone: "text-info bg-info/10" }
    : { label: scope === "magistrado" ? "Audiências de hoje" : "Ata de audiências (hoje)", icon: PenLine, tone: "text-warning-foreground bg-warning/20" };

  useEffect(() => {
    (async () => {
      const now = new Date();
      let start: Date, end: Date;
      if (kind === "proximas") {
        start = now;
        end = new Date(now.getTime() + 10 * 86400000);
      } else {
        start = new Date(now); start.setHours(0, 0, 0, 0);
        end = new Date(start); end.setHours(23, 59, 59, 999);
      }
      const { data: auds } = await supabase
        .from("audiencias")
        .select("id,processo_id,data_hora,status")
        .gte("data_hora", start.toISOString())
        .lte("data_hora", end.toISOString())
        .in("status", ["designada", "redesignada"])
        .order("data_hora", { ascending: true })
        .limit(50);
      const ids = (auds ?? []).map((a: { processo_id: string }) => a.processo_id);
      let procs: { id: string; numero: string; classe: string; magistrado_id: string | null }[] = [];
      if (ids.length > 0) {
        const { data } = await supabase.from("processos").select("id,numero,classe,magistrado_id").in("id", ids);
        procs = data ?? [];
      }
      // Magistrado só vê audiências dos processos dele
      let filteredProcs = procs;
      if (scope === "magistrado") {
        const { data: { user } } = await supabase.auth.getUser();
        filteredProcs = procs.filter((p) => p.magistrado_id === user?.id);
      }
      const pMap = Object.fromEntries(filteredProcs.map((p) => [p.id, p]));
      const filtered = (auds ?? []).filter((a: { processo_id: string }) => pMap[a.processo_id]);
      setRows(filtered.map((a: { processo_id: string; data_hora: string }) => {
        const p = pMap[a.processo_id];
        return {
          id: a.processo_id, numero: p?.numero ?? "—", classe: p?.classe ?? "—",
          quando: a.data_hora, partes: "Audiência designada",
        };
      }));
      setLoaded(true);
    })();
  }, [kind, scope]);


  return (
    <section className="bg-card border border-border rounded-lg flex flex-col">
      <header className="px-5 py-3 border-b border-border flex items-center gap-3">
        <div className={`size-9 rounded flex items-center justify-center ${meta.tone}`}><meta.icon className="size-5" /></div>
        <div className="flex-1">
          <h2 className="font-semibold text-sm">{meta.label}</h2>
          <div className="text-xs text-muted-foreground">{rows.length} audiência(s)</div>
        </div>
      </header>
      {!loaded ? <div className="p-6 text-center text-xs text-muted-foreground">Carregando…</div>
        : rows.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2"><Inbox className="size-5 text-muted-foreground/60" /> Nenhuma audiência.</div>
        : (
          <ol className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {rows.map((p, i) => (
              <li key={`${p.id}-${i}`}>
                <Link to="/processos/$id" params={{ id: p.id }} className="block px-5 py-3 hover:bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">#{String(i + 1).padStart(2, "0")} · {formatCNJ(p.numero)}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{formatDateTime(p.quando)}</span>
                  </div>
                  <div className="text-xs text-foreground/80 mt-1 line-clamp-1">{p.classe}</div>
                </Link>
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}

function FilaCard({ def, kind }: { def: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }; kind: "servidor" | "magistrado" }) {
  const [rows, setRows] = useState<ConclusoRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const col = kind === "servidor" ? "fila_servidor" : "fila_atual";
      const ordCol = kind === "servidor" ? "updated_at" : "conclusao_em";
      let qb = supabase
        .from("processos")
        .select(`id,numero,classe,${ordCol}`)
        .eq(col, def.key)
        .order(ordCol, { ascending: true })
        .limit(30);
      // #3: magistrado só enxerga na fila os processos distribuídos a ELE.
      if (kind === "magistrado" && user) qb = qb.eq("magistrado_id", user.id);
      const { data: procs } = await qb;

      const ids = (procs ?? []).map((p: { id: string }) => p.id);
      const partesMap: Record<string, string[]> = {};
      if (ids.length > 0) {
        const { data: pts } = await supabase
          .from("partes")
          .select("processo_id,nome,tipo")
          .in("processo_id", ids);
        (pts ?? []).forEach((p: { processo_id: string; nome: string; tipo: string }) => {
          (partesMap[p.processo_id] ||= []).push(`${p.nome} (${p.tipo})`);
        });
      }
      setRows((procs ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string, numero: p.numero as string, classe: p.classe as string,
        quando: (p[ordCol] as string) ?? "",
        partes: (partesMap[p.id as string] ?? []).slice(0, 3).join(" × ") || "—",
      })));
      setLoaded(true);
    })();
  }, [def.key, kind]);

  return (
    <section className="bg-card border border-border rounded-lg flex flex-col">
      <header className="px-5 py-3 border-b border-border flex items-center gap-3">
        <div className={`size-9 rounded flex items-center justify-center ${def.tone}`}>
          <def.icon className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-sm">{def.label}</h2>
          <div className="text-xs text-muted-foreground">{rows.length} aguardando</div>
        </div>
      </header>
      {!loaded ? (
        <div className="p-6 text-center text-xs text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Inbox className="size-5 text-muted-foreground/60" /> Fila vazia.
        </div>
      ) : (
        <ol className="divide-y divide-border max-h-[420px] overflow-y-auto">
          {rows.map((p, i) => (
            <li key={p.id}>
              <Link to="/processos/$id" params={{ id: p.id }} className="block px-5 py-3 hover:bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-primary">
                    #{String(i + 1).padStart(2, "0")} · {formatCNJ(p.numero)}
                  </span>
                  {p.quando && <span className="text-[11px] text-muted-foreground tabular-nums">{formatDateTime(p.quando)}</span>}
                </div>
                <div className="text-xs text-foreground/80 mt-1 line-clamp-1">{p.classe}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.partes}</div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ExternoView({ role }: { role: AppRole | null }) {
  const titulos: Partial<Record<AppRole, { t: string; d: string }>> = {
    advogado: { t: "Acompanhe seus processos", d: "Consulte seu acervo, peticione e acompanhe intimações." },
    promotor: { t: "Atuação ministerial", d: "Visualize processos com vista ao Ministério Público." },
    defensoria: { t: "Defensoria Pública", d: "Intimações e prazos direcionados à instituição." },
    defensor: { t: "Atuação da Defensoria", d: "Acompanhe processos, intimações e prazos." },
    cidadao: { t: "Consulta pública", d: "Consulte processos públicos e acompanhe demandas do seu interesse." },
  };
  const t = (role && titulos[role]) ?? { t: "Bem-vindo ao PJe", d: "Consulte processos e acompanhe movimentações." };

  const [meus, setMeus] = useState<{ id: string; numero: string; classe: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("partes")
        .select("processo_id, processos:processo_id (id,numero,classe)")
        .eq("user_id", user.id)
        .limit(8);
      type Row = { processos: { id: string; numero: string; classe: string } | null };
      setMeus(((data as unknown as Row[]) ?? []).map((r) => r.processos).filter(Boolean) as never);
    })();
  }, []);

  return (
    <>
      <div className="mt-6 bg-gradient-to-br from-primary to-header text-primary-foreground rounded-lg p-6 md:p-8">
        <Briefcase className="size-8" />
        <h2 className="text-xl md:text-2xl font-bold mt-3">{t.t}</h2>
        <p className="text-sm text-primary-foreground/85 mt-1 max-w-xl">{t.d}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="bg-card border border-border rounded-lg">
          <header className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Inbox className="size-4 text-primary" />
            <h2 className="font-semibold">Meus processos</h2>
          </header>
          {meus.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <AlertTriangle className="size-5 text-muted-foreground/60" />
              Você ainda não está vinculado a nenhum processo.
              <Link to="/meus-processos" className="text-primary text-xs hover:underline mt-1">Ver tudo</Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {meus.map((p) => (
                <li key={p.id} className="px-5 py-3 hover:bg-muted/30">
                  <Link to="/processos/$id" params={{ id: p.id }} className="block">
                    <div className="font-mono text-sm font-semibold text-primary">{formatCNJ(p.numero)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.classe}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 py-3 border-t border-border">
            <Link to="/meus-processos" className="text-sm text-primary font-medium hover:underline">Abrir aba "Meus processos" →</Link>
          </div>
        </section>

        <section className="bg-card border border-border rounded-lg p-5">
          <ShieldCheck className="size-7 text-primary" />
          <h3 className="font-semibold mt-2">Suas garantias</h3>
          <ul className="mt-3 text-sm text-muted-foreground space-y-2 leading-relaxed">
            <li>• Acesso 24h por dia, conforme art. 10 da Lei 11.419/2006.</li>
            <li>• Publicidade dos atos processuais (art. 5º, LX, CF).</li>
            <li>• Proteção de dados pessoais (Lei 13.709/2018 — LGPD).</li>
            <li>• Atendimento presencial em qualquer secretaria do tribunal.</li>
          </ul>
        </section>
      </div>

      {isAdvocaciaRole(role) && <PrazosPendentes />}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat icon={FileText} label="Acesse" value="Consulta pública" to="/consulta" />
        <Stat icon={Scale} label="Acompanhar" value="Meus processos" to="/meus-processos" />
        <Stat icon={Clock} label="Publicações" value="Diário Eletrônico" to="/diario" />
      </div>
    </>
  );
}

function PrazosPendentes() {
  const [rows, setRows] = useState<{ id: string; processo_id: string; numero: string; ato: string; vence_em: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("prazos")
        .select("id,processo_id,ato_processual,descricao,vence_em,status,cumprido")
        .eq("cumprido", false)
        .order("vence_em", { ascending: true })
        .limit(10);
      const list = (data ?? []) as { id: string; processo_id: string; ato_processual: string | null; descricao: string | null; vence_em: string }[];
      const ids = Array.from(new Set(list.map((p) => p.processo_id)));
      const nums: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: procs } = await supabase.from("processos").select("id,numero").in("id", ids);
        (procs ?? []).forEach((p: { id: string; numero: string }) => { nums[p.id] = p.numero; });
      }
      setRows(list.map((p) => ({ id: p.id, processo_id: p.processo_id, numero: nums[p.processo_id] ?? "—", ato: p.ato_processual ?? p.descricao ?? "Prazo processual", vence_em: p.vence_em })));
    })();
  }, []);

  return (
    <section className="mt-6 bg-card border border-border rounded-lg">
      <header className="px-5 py-3 border-b border-border flex items-center gap-2">
        <Clock className="size-4 text-primary" />
        <h2 className="font-semibold">Prazos pendentes</h2>
        <Link to="/prazos" className="ml-auto text-xs text-primary hover:underline">Ver todos →</Link>
      </header>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <Inbox className="size-5 text-muted-foreground/60" /> Nenhum prazo pendente.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((p) => {
            const restam = Math.ceil((new Date(p.vence_em).getTime() - Date.now()) / 86400000);
            return (
              <li key={p.id}>
                <Link to="/processos/$id" params={{ id: p.processo_id }} className="block px-5 py-3 hover:bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">{formatCNJ(p.numero)}</span>
                    <span className={`text-[11px] tabular-nums ${restam < 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                      {restam < 0 ? "vencido" : `restam ${restam} dia(s)`} · {formatDateTime(p.vence_em)}
                    </span>
                  </div>
                  <div className="text-xs text-foreground/80 mt-1 line-clamp-1">{p.ato}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stat({ icon: Icon, label, value, to }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; to: string }) {
  return (
    <Link to={to} className="bg-card border border-border rounded-lg p-4 hover:border-primary transition flex items-center gap-3">
      <div className="size-10 rounded bg-primary/10 text-primary flex items-center justify-center"><Icon className="size-5" /></div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold text-sm">{value}</div>
      </div>
    </Link>
  );
}
