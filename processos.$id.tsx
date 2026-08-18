import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, Lock, Send, Scale, FileText, Upload, Clock, Gavel, Download, CalendarClock, X } from "lucide-react";
import { toast } from "sonner";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import {
  formatCNJ, formatBRL, formatDate, formatDateTime, TIPO_PARTE_LABELS, TIPO_MOV_LABELS, STATUS_LABELS, ROLE_LABELS, isInternalRole, isJulgadorRole, DESTINATARIO_LABELS, PRAZO_STATUS_LABELS } from "@/lib/pje";
import { gerarPdfAto, gerarAutosCompletos } from "@/lib/pdf-ato";

type Acao = "despacho" | "decisao" | "sentenca" | "urgente" | "minuta_pendente";

export const Route = createFileRoute("/_authenticated/processos/$id")({
  validateSearch: (s: Record<string, unknown>): { acao?: Acao } => (typeof s.acao === "string" ? { acao: s.acao as Acao } : {}),
  head: () => ({ meta: [{ title: "Autos — PJe" }] }),
  component: Detalhe,
});

interface Proc { id: string; numero: string; classe: string; assunto: string; valor_causa: number; orgao_julgador: string | null; comarca: string | null; estado_uf: string | null; segredo_justica: boolean; status: keyof typeof STATUS_LABELS; prioridade: boolean; data_distribuicao: string; fila_atual: string | null }
interface Parte { id: string; nome: string; documento: string | null; tipo: keyof typeof TIPO_PARTE_LABELS; user_id: string | null; advogado_nome: string | null; advogado_oab: string | null; advogado_cpf: string | null; representa_parte_id: string | null }
interface Mov { id: string; id_movimento: number | null; tipo: keyof typeof TIPO_MOV_LABELS; descricao: string; conteudo: string | null; autor_nome: string | null; autor_cargo: string | null; data_movimentacao: string }
interface Doc { id: string; tipo: string; titulo: string; conteudo_html: string | null; arquivo_url: string | null; autor_nome: string | null; autor_cargo: string | null; created_at: string }
interface Prazo { id: string; parte_nome: string; descricao: string | null; vence_em: string; cumprido: boolean; lancado_automatico: boolean; destinatario_tipo: string | null; parte_representada: string | null; ato_processual: string | null; inicio_em: string | null; dias: number | null; status: string | null }

/** Destinatários processuais possíveis para intimações e prazos. */
export interface DestOpt {
  key: string; label: string; nome: string; tipo: string;
  parteId: string | null; userId: string | null; parteRepresentada: string | null;
  temAdvogado?: boolean;
}

function buildDestinatarios(partes: Parte[]): DestOpt[] {
  const opts: DestOpt[] = [];
  const principais = partes.filter((p) => p.tipo === "autor" || p.tipo === "reu" || p.tipo === "terceiro");
  principais.forEach((p) => {
    const advRow = partes.find((a) => a.tipo === "advogado" && a.representa_parte_id === p.id);
    const advNome = p.advogado_nome ?? advRow?.advogado_nome ?? advRow?.nome ?? null;
    if (advNome) {
      opts.push({
        key: `adv:${p.id}`,
        label: `Adv. ${advNome}${p.advogado_oab ? ` (OAB ${p.advogado_oab})` : ""} — patrono de ${p.nome}`,
        nome: advNome, tipo: "advogado", parteId: p.id,
        userId: advRow?.user_id ?? null, parteRepresentada: p.nome,
      });
    }
    opts.push({
      key: `parte:${p.id}`,
      label: `${p.nome} (${TIPO_PARTE_LABELS[p.tipo]})${advNome ? " — representada por advogado" : ""}`,
      nome: p.nome, tipo: "parte", parteId: p.id, userId: p.user_id,
      parteRepresentada: p.nome, temAdvogado: !!advNome,
    });
  });
  opts.push({ key: "mp", label: "Ministério Público", nome: "Ministério Público", tipo: "mp", parteId: null, userId: null, parteRepresentada: null });
  opts.push({ key: "defensoria", label: "Defensoria Pública (instituição)", nome: "Defensoria Pública", tipo: "defensoria", parteId: null, userId: null, parteRepresentada: null });
  opts.push({ key: "defensor", label: "Defensor Público", nome: "Defensor Público", tipo: "defensor", parteId: null, userId: null, parteRepresentada: null });
  return opts;
}

const ACAO_LABELS: Record<Acao, string> = {
  despacho: "Despacho", decisao: "Decisão", sentenca: "Sentença",
  urgente: "Decisão urgente", minuta_pendente: "Minuta",
};

function Detalhe() {
  const { id } = Route.useParams();
  const { acao } = Route.useSearch();
  const { user, role, nome } = useAuth();
  const interno = isInternalRole(role);
  const cargo = role ? ROLE_LABELS[role] : null;

  const [proc, setProc] = useState<Proc | null>(null);
  const [partes, setPartes] = useState<Parte[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [activeTab, setActiveTab] = useState<string>(acao ? "decidir" : "movimentacoes");

  const isMinhaParte = useMemo(() => partes.some((p) => p.user_id === user?.id), [partes, user]);
  const isRoleExterno = role === "advogado" || role === "promotor" || role === "cidadao";
  // Magistrado não protocola documentos
  const podeProtocolar = (interno && role !== "magistrado") || isMinhaParte;
  const bloqueadoSemHabilitacao = isRoleExterno && !isMinhaParte;

  const load = async () => {
    const [{ data: p }, { data: pts }, { data: ms }, { data: ds }, { data: pz }] = await Promise.all([
      supabase.from("processos").select("*").eq("id", id).maybeSingle(),
      supabase.from("partes").select("*").eq("processo_id", id),
      supabase.from("movimentacoes").select("*").eq("processo_id", id).order("data_movimentacao", { ascending: false }),
      supabase.from("documentos_processo").select("*").eq("processo_id", id).order("created_at", { ascending: false }),
      supabase.from("prazos").select("*").eq("processo_id", id).order("vence_em", { ascending: true }),
    ]);
    setProc(p as Proc | null);
    setPartes((pts as Parte[]) ?? []);
    setMovs((ms as Mov[]) ?? []);
    setDocs((ds as Doc[]) ?? []);
    setPrazos((pz as Prazo[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (!proc) {
    return (
      <div className="flex min-h-screen flex-col"><SiteHeader />
        <main className="flex-1 bg-secondary"><div className="mx-auto max-w-5xl px-4 py-12 text-center text-muted-foreground">Carregando autos…</div></main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Link to="/processos" className="text-sm text-primary inline-flex items-center gap-1 hover:underline mb-3">
            <ChevronLeft className="size-4" /> Voltar à lista
          </Link>

          <div className="bg-card border border-border rounded-lg p-5 md:p-6">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="size-12 rounded bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Scale className="size-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Autos digitais</div>
                <h1 className="font-mono text-xl md:text-2xl font-bold text-primary mt-0.5">{formatCNJ(proc.numero)}</h1>
                <div className="mt-1 text-sm font-medium">{proc.classe} — {proc.assunto}</div>
                <div className="text-xs text-muted-foreground mt-1">{proc.orgao_julgador}{proc.comarca && ` · ${proc.comarca}`}{proc.estado_uf && `/${proc.estado_uf}`}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={proc.status} />
                {proc.segredo_justica && <span className="inline-flex items-center gap-1 text-xs bg-warning/15 text-warning-foreground border border-warning/40 px-2 py-0.5 rounded"><Lock className="size-3" /> Segredo</span>}
                {proc.prioridade && <span className="text-xs bg-destructive/15 text-destructive border border-destructive/30 px-2 py-0.5 rounded font-semibold">PRIORIDADE</span>}
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-border pt-4">
              <Field label="Valor da causa" value={formatBRL(Number(proc.valor_causa) || 0)} />
              <Field label="Distribuído em" value={formatDateTime(proc.data_distribuicao)} />
              <Field label="Status" value={STATUS_LABELS[proc.status]} />
              <Field label="Fila" value={proc.fila_atual ? ACAO_LABELS[proc.fila_atual as Acao] ?? proc.fila_atual : "—"} />
            </dl>
            {(interno || isMinhaParte) && (
              <div className="mt-4 border-t border-border pt-3 flex justify-end">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                  const blob = gerarAutosCompletos({
                    numero: proc.numero, orgao: proc.orgao_julgador, classe: proc.classe, assunto: proc.assunto,
                    partes: partes.map((p) => ({ nome: p.nome, tipo: TIPO_PARTE_LABELS[p.tipo] ?? p.tipo, documento: p.documento })),
                    docs: docs.map((d) => ({ titulo: d.titulo, tipo: d.tipo, conteudo_html: d.conteudo_html, autor_nome: d.autor_nome, created_at: d.created_at, arquivo_url: d.arquivo_url })),
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `autos_${proc.numero.replace(/\D/g, "")}.pdf`; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="size-4" /> Baixar autos completos (PDF)
                </Button>
              </div>
            )}
          </div>

          {bloqueadoSemHabilitacao && (
            <div className="mt-4 bg-warning/15 border border-warning/40 text-warning-foreground rounded-lg p-4 text-sm">
              <strong>Habilitação necessária.</strong> Você não figura como parte neste processo.
              Para peticionar, solicite habilitação em <Link to="/habilitacao" className="underline font-medium">Habilitação em processo</Link>{' '}
              e aguarde o deferimento pela secretaria.
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="movimentacoes">Movimentações ({movs.length})</TabsTrigger>
              <TabsTrigger value="documentos">Documentos ({docs.length})</TabsTrigger>
              <TabsTrigger value="partes">Partes ({partes.length})</TabsTrigger>
              {(interno || isMinhaParte) && <TabsTrigger value="prazos">Prazos ({prazos.length})</TabsTrigger>}
              {podeProtocolar && <TabsTrigger value="protocolar">Protocolar documento</TabsTrigger>}
              {interno && isJulgadorRole(role) && <TabsTrigger value="decidir"><Gavel className="size-3 mr-1" /> Decidir</TabsTrigger>}
              {interno && isJulgadorRole(role) && <TabsTrigger value="audiencias"><CalendarClock className="size-3 mr-1" /> Audiências</TabsTrigger>}
              {interno && !isJulgadorRole(role) && <TabsTrigger value="despacho">Despacho</TabsTrigger>}

            </TabsList>

            <TabsContent value="movimentacoes" className="mt-4">
              <MovList movs={movs} />
            </TabsContent>

            <TabsContent value="documentos" className="mt-4">
              <DocList docs={docs} podeBaixar={interno || isMinhaParte} />
            </TabsContent>

            <TabsContent value="partes" className="mt-4">
              <PartesPanel partes={partes} />
            </TabsContent>

            {(interno || isMinhaParte) && (
              <TabsContent value="prazos" className="mt-4">
                <PrazosPanel processoId={id} partes={partes} prazos={prazos} interno={interno} onChange={load} />
              </TabsContent>
            )}

            {podeProtocolar && (
              <TabsContent value="protocolar" className="mt-4">
                <ProtocolarPanel processoId={id} userId={user!.id} autorNome={nome ?? user!.email!} autorCargo={cargo} partes={partes} proc={proc} onSaved={load} />
              </TabsContent>
            )}

            {interno && isJulgadorRole(role) && (
              <TabsContent value="decidir" className="mt-4">
                <DecisaoEditor proc={proc} acao={acao ?? "despacho"} userId={user!.id} autorNome={nome ?? user!.email!} cargo={cargo!} onSaved={load} />
              </TabsContent>
            )}

            {interno && isJulgadorRole(role) && (
              <TabsContent value="audiencias" className="mt-4">
                <AudienciasPanel processoId={id} magistradoNome={nome ?? user!.email!} orgao={proc.orgao_julgador} />
              </TabsContent>
            )}

            {interno && !isJulgadorRole(role) && (
              <TabsContent value="despacho" className="mt-4">
                <DespachoServidor proc={proc} userId={user!.id} autorNome={nome ?? user!.email!} cargo={cargo!} onSaved={load} />
              </TabsContent>
            )}

          </Tabs>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase text-muted-foreground tracking-wide">{label}</dt><dd className="font-medium mt-0.5">{value}</dd></div>;
}

function MovList({ movs }: { movs: Mov[] }) {
  return (
    <div className="bg-card border border-border rounded-lg">
      {movs.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Sem movimentações.</div>
      ) : (
        <ol className="divide-y divide-border">
          {movs.map((m) => (
            <li key={m.id} className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {m.id_movimento != null && <span className="text-xs font-mono font-bold text-muted-foreground">ID.{String(m.id_movimento).padStart(2, "0")}</span>}
                  <span className="text-xs font-semibold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded">{TIPO_MOV_LABELS[m.tipo] ?? m.tipo}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(m.data_movimentacao)}</span>
              </div>
              <div className="mt-2 text-sm font-medium whitespace-pre-wrap">{m.descricao}</div>
              {m.conteudo && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.conteudo}</div>}
              {m.autor_nome && (
                <div className="text-xs text-muted-foreground mt-2">
                  Por <span className="font-medium text-foreground">{m.autor_nome}</span>
                  {m.autor_cargo && <> — {m.autor_cargo}</>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DocList({ docs, podeBaixar }: { docs: Doc[]; podeBaixar: boolean }) {
  const baixar = async (path: string) => {
    const { data, error } = await supabase.storage.from("processos-docs").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Falha ao gerar link");
    window.open(data.signedUrl, "_blank");
  };
  return (
    <div className="bg-card border border-border rounded-lg">
      {docs.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Sem documentos.</div>
      ) : (
        <ol className="divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded">{d.tipo}</span>
                    <span className="text-sm font-medium">{d.titulo}</span>
                  </div>
                  {d.conteudo_html && <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-6">{d.conteudo_html}</div>}
                  {d.autor_nome && <div className="text-xs text-muted-foreground mt-2">Por <span className="font-medium text-foreground">{d.autor_nome}</span>{d.autor_cargo && <> — {d.autor_cargo}</>} · {formatDateTime(d.created_at)}</div>}
                </div>
                {d.arquivo_url && podeBaixar && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => baixar(d.arquivo_url!)}>
                    <Download className="size-3" /> PDF
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DecisaoEditor({ proc, acao, userId, autorNome, cargo, onSaved }:
  { proc: Proc; acao: Acao; userId: string; autorNome: string; cargo: string; onSaved: () => void }) {
  const tipoInicial: Acao = acao === "urgente" || acao === "minuta_pendente" ? "decisao" : acao;
  const [tipo, setTipo] = useState<"despacho" | "decisao" | "sentenca">(tipoInicial as "despacho" | "decisao" | "sentenca");
  const titulo = ACAO_LABELS[tipo as Acao];
  const modelo = `PODER JUDICIÁRIO\n${(proc.orgao_julgador ?? "—").toUpperCase()}\nAutos nº ${formatCNJ(proc.numero)}\n\n${titulo.toUpperCase()}\n\n`;
  const [texto, setTexto] = useState(modelo + "Vistos.\n\n");
  const [enviando, setEnviando] = useState(false);

  const publicar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      // #10: gera PDF do ato e anexa como arquivo do documento
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("PODER JUDICIÁRIO", 105, 15, { align: "center" });
      doc.setFontSize(10);
      doc.text(proc.orgao_julgador ?? "—", 105, 21, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(`Autos nº ${formatCNJ(proc.numero)}`, 105, 27, { align: "center" });
      doc.line(15, 31, 195, 31);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(titulo.toUpperCase(), 105, 38, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      const lines = doc.splitTextToSize(texto, 180);
      let y = 46;
      lines.forEach((l: string) => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(l, 15, y); y += 5;
      });
      y = Math.min(y + 10, 275);
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text(`Assinado eletronicamente por ${autorNome} — ${cargo}`, 15, y);
      doc.text(`Publicado no DJE em ${formatDateTime(new Date().toISOString())}`, 15, y + 5);
      const blob = doc.output("blob");
      const path = `${proc.id}/atos/${tipo}_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("processos-docs").upload(path, blob, { contentType: "application/pdf", upsert: true });
      const arquivo_url = upErr ? null : path;

      // O trigger no banco cria automaticamente a movimentação "publicado no DJE" e ajusta filas.
      const { error: errDoc } = await supabase.from("documentos_processo").insert({
        processo_id: proc.id, tipo, titulo, conteudo_html: texto, arquivo_url,
        autor_id: userId, autor_nome: autorNome, autor_cargo: cargo,
        publico: true,
      });
      if (errDoc) throw errDoc;
      toast.success(`${titulo} publicado(a) no DJE`);
      onSaved();
    } catch (e) {
      toast.error("Falha ao publicar", { description: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="text-center border-b border-border pb-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Editor</div>
          <div className="font-bold text-lg mt-1">PODER JUDICIÁRIO</div>
          <div className="font-semibold">{proc.orgao_julgador}</div>
          <div className="font-mono text-sm text-primary">{formatCNJ(proc.numero)}</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as never)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="despacho">Despacho</SelectItem>
              <SelectItem value="decisao">Decisão</SelectItem>
              <SelectItem value="sentenca">Sentença</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea rows={16} value={texto} onChange={(e) => setTexto(e.target.value)} className="font-serif leading-relaxed" />
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">Assinatura eletrônica: <span className="font-medium text-foreground">{autorNome} — {cargo}</span></div>
          <Button onClick={publicar} disabled={enviando} className="gap-2">
            <Gavel className="size-4" /> {enviando ? "Publicando…" : "Assinar e publicar no DJE"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">O sistema gera o PDF automaticamente e publica no Diário Judicial Eletrônico. O ato fica permanente nos autos.</p>
      </div>

      <LancarAndamento proc={proc} userId={userId} autorNome={autorNome} cargo={cargo} onSaved={onSaved} />
    </div>
  );
}

function DespachoServidor({ proc, userId, autorNome, cargo, onSaved }:
  { proc: Proc; userId: string; autorNome: string; cargo: string; onSaved: () => void }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      // #10: gera PDF do despacho e anexa
      const blob = gerarPdfAto({ orgao: proc.orgao_julgador, numero: proc.numero, titulo: "Despacho de cumprimento", texto, autor: autorNome, cargo });
      const path = `${proc.id}/atos/despacho_servidor_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("processos-docs").upload(path, blob, { contentType: "application/pdf", upsert: true });
      const arquivo_url = upErr ? null : path;

      await supabase.from("documentos_processo").insert({
        processo_id: proc.id, tipo: "despacho", titulo: "Despacho de cumprimento", conteudo_html: texto, arquivo_url,
        autor_id: userId, autor_nome: autorNome, autor_cargo: cargo, publico: false,
      });
      await supabase.from("movimentacoes").insert({
        processo_id: proc.id, tipo: "despacho",
        descricao: "Despacho de cumprimento",
        conteudo: texto, autor_id: userId, autor_nome: autorNome, autor_cargo: cargo,
      });
      setTexto("");
      toast.success("Despacho registrado");
      onSaved();
    } catch (e) {
      toast.error("Falha ao registrar", { description: (e as Error).message });
    } finally { setEnviando(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h3 className="font-semibold">Despacho do(a) servidor(a)</h3>
        <Textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva o despacho…" />
        <Button onClick={enviar} disabled={enviando || !texto.trim()} className="gap-2">
          <Send className="size-4" /> {enviando ? "Registrando…" : "Registrar"}
        </Button>
      </div>

      <LancarAndamento proc={proc} userId={userId} autorNome={autorNome} cargo={cargo} onSaved={onSaved} />
    </div>
  );
}

type AndamentoPreset = {
  label: string;
  descricao: string;
  filaServ?: string | null;
  filaMag?: string | null;
  status?: string;
};

const ANDAMENTOS: AndamentoPreset[] = [
  { label: "Autos encaminhados para secretaria — Expedientes pendentes", descricao: "Autos encaminhados à secretaria para expedição de mandados/ofícios/cartas/editais.", filaServ: "expedientes_pendentes", filaMag: null },
  { label: "Autos encaminhados para secretaria — Comunicações pendentes", descricao: "Autos encaminhados à secretaria para citações/intimações/notificações.", filaServ: "comunicacoes_pendentes", filaMag: null },
  { label: "Autos encaminhados para cumprimento de sentença", descricao: "Autos encaminhados ao cumprimento de sentença.", filaServ: "cumprimento_sentenca", filaMag: null },
  { label: "Conclusos ao magistrado — Despacho", descricao: "Autos conclusos ao(à) magistrado(a) para despacho.", filaServ: null, filaMag: "despacho" },
  { label: "Conclusos ao magistrado — Decisão", descricao: "Autos conclusos ao(à) magistrado(a) para decisão.", filaServ: null, filaMag: "decisao" },
  { label: "Conclusos ao magistrado — Sentença", descricao: "Autos conclusos ao(à) magistrado(a) para sentença.", filaServ: null, filaMag: "sentenca" },
  { label: "Remetidos os autos em grau de recurso", descricao: "Autos remetidos à 2ª instância — distribuição por sorteio a Desembargador(a) da matéria.", filaServ: null, filaMag: null },
  { label: "Arquivar processo", descricao: "Determinado o arquivamento dos autos.", filaServ: null, filaMag: null, status: "arquivado" },
];

function LancarAndamento({ proc, userId, autorNome, cargo, onSaved }:
  { proc: Proc; userId: string; autorNome: string; cargo: string; onSaved: () => void }) {
  const [sel, setSel] = useState<string>("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);

  const lancar = async () => {
    const preset = ANDAMENTOS.find((a) => a.label === sel);
    if (!preset) return toast.error("Escolha um andamento");
    setEnviando(true);
    // Caminho especial: remessa em grau de recurso — sorteia desembargador via RPC
    if (preset.label === "Remetidos os autos em grau de recurso") {
      const { error } = await supabase.rpc("remeter_em_grau_de_recurso", { _processo_id: proc.id, _observacao: obs || null });
      setEnviando(false);
      if (error) return toast.error("Falha ao remeter", { description: error.message });
      setSel(""); setObs("");
      toast.success("Autos remetidos em grau de recurso");
      onSaved();
      return;
    }
    const descricao = obs.trim() ? `${preset.descricao}\n\nObs.: ${obs.trim()}` : preset.descricao;
    await supabase.from("movimentacoes").insert({
      processo_id: proc.id, tipo: "juntada", descricao,
      autor_id: userId, autor_nome: autorNome, autor_cargo: cargo,
    });
    const upd: Record<string, unknown> = {};
    if (preset.filaServ !== undefined) upd.fila_servidor = preset.filaServ;
    if (preset.filaMag !== undefined) {
      upd.fila_atual = preset.filaMag;
      upd.conclusao_em = preset.filaMag ? new Date().toISOString() : null;
    }
    if (preset.status) upd.status = preset.status;
    if (Object.keys(upd).length) await supabase.from("processos").update(upd).eq("id", proc.id);
    setEnviando(false);
    setSel(""); setObs("");
    toast.success("Andamento lançado");
    onSaved();
  };


  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><Send className="size-4" /> Lançar andamento</h3>
      <p className="text-xs text-muted-foreground">Andamentos pré-prontos. A movimentação fica permanente nos autos e roteia o processo para a fila correta.</p>
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger><SelectValue placeholder="Selecione um andamento" /></SelectTrigger>
        <SelectContent>
          {ANDAMENTOS.map((a) => <SelectItem key={a.label} value={a.label}>{a.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação opcional" />
      <Button onClick={lancar} disabled={enviando || !sel} className="gap-2">
        {enviando ? "Lançando…" : "Lançar"}
      </Button>
    </div>
  );
}

const TIPOS_DOC = [
  { v: "peticao", l: "Petição" },
  { v: "peticao_inicial", l: "Petição inicial" },
  { v: "contestacao", l: "Contestação" },
  { v: "replica", l: "Réplica" },
  { v: "prova_documental", l: "Prova / Documento" },
  { v: "parecer", l: "Parecer" },
  { v: "laudo", l: "Laudo" },
  { v: "manifestacao_mp", l: "Manifestação do MP" },
  { v: "despacho", l: "Despacho" },
  { v: "decisao", l: "Decisão" },
  { v: "sentenca", l: "Sentença" },
  { v: "oficio", l: "Ofício" },
  { v: "mandado", l: "Mandado" },
  { v: "certidao", l: "Certidão" },
  { v: "outros", l: "Outros" },
];

const MANDADO_SUBTIPOS = [
  { v: "intimacao", l: "Intimação" },
  { v: "citacao", l: "Citação" },
  { v: "prisao", l: "Prisão (envia para o BNMP)" },
  { v: "busca_apreensao", l: "Busca e apreensão" },
  { v: "conducao", l: "Condução coercitiva" },
];

function PartesPanel({ partes }: { partes: Parte[] }) {
  const polos: { titulo: string; tipos: (keyof typeof TIPO_PARTE_LABELS)[] }[] = [
    { titulo: "Polo ativo", tipos: ["autor"] },
    { titulo: "Polo passivo", tipos: ["reu"] },
    { titulo: "Terceiros / Interessados", tipos: ["terceiro", "mp"] },
    { titulo: "Advogados / Patronos", tipos: ["advogado"] },
  ];
  const nomeParte = (id: string | null) => partes.find((x) => x.id === id)?.nome ?? "—";
  if (partes.length === 0) {
    return <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">Nenhuma parte cadastrada.</div>;
  }
  return (
    <div className="space-y-4">
      {polos.map((polo) => {
        const list = partes.filter((p) => polo.tipos.includes(p.tipo));
        if (list.length === 0) return null;
        return (
          <div key={polo.titulo} className="bg-card border border-border rounded-lg">
            <header className="px-4 py-2 border-b border-border bg-muted/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">{polo.titulo}</div>
            </header>
            <ul className="divide-y divide-border">
              {list.map((p) => (
                <li key={p.id} className="p-4 flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{p.nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                      {p.documento && <span>CPF/CNPJ: <span className="font-mono">{p.documento}</span></span>}
                      {p.tipo === "advogado" && p.advogado_oab && <span>OAB: <span className="font-mono">{p.advogado_oab}</span></span>}
                      {p.tipo === "advogado" && p.representa_parte_id && <span>Representa: <span className="text-foreground">{nomeParte(p.representa_parte_id)}</span></span>}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest bg-accent text-accent-foreground px-2 py-0.5 rounded">{TIPO_PARTE_LABELS[p.tipo]}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ProtocolarPanel({ processoId, userId, autorNome, autorCargo, partes, proc, onSaved }:
  { processoId: string; userId: string; autorNome: string; autorCargo: string | null; partes: Parte[]; proc: Proc; onSaved: () => void }) {
  const [modo, setModo] = useState<"texto" | "pdf">("texto");
  const [tipoDoc, setTipoDoc] = useState<string>("");
  const [titulo, setTitulo] = useState("Petição");
  const [texto, setTexto] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mandadoSubtipo, setMandadoSubtipo] = useState("intimacao");
  const [mandadoDestId, setMandadoDestId] = useState("");
  const [prazoDias, setPrazoDias] = useState("");
  const isMandado = tipoDoc === "mandado";
  const todosDest = useMemo(() => buildDestinatarios(partes), [partes]);
  // Prisão/busca/condução só recaem sobre a própria parte; demais atos seguem a representação processual.
  const destsDisponiveis = useMemo(() => {
    if (mandadoSubtipo === "prisao" || mandadoSubtipo === "busca_apreensao" || mandadoSubtipo === "conducao") {
      return todosDest.filter((d) => d.tipo === "parte");
    }
    return todosDest;
  }, [todosDest, mandadoSubtipo]);
  const destSel = destsDisponiveis.find((d) => d.key === mandadoDestId);

  const enviar = async () => {
    if (!tipoDoc) return toast.error("Selecione o tipo do documento");
    if (isMandado && !destSel) return toast.error("Selecione o destinatário do mandado");
    if (isMandado && destSel && destSel.tipo === "parte" && destSel.temAdvogado
        && (mandadoSubtipo === "intimacao" || mandadoSubtipo === "citacao")) {
      return toast.error("Parte representada por advogado", {
        description: "A intimação deve ser dirigida ao advogado constituído nos autos.",
      });
    }
    setEnviando(true);
    try {
      let arquivo_url: string | null = null;
      if (modo === "pdf" && pdf) {
        const safe = pdf.name.replace(/[^\w.\-]/g, "_");
        const path = `${processoId}/peticoes/${Date.now()}_${safe}`;
        const { error } = await supabase.storage.from("processos-docs").upload(path, pdf);
        if (error) throw error;
        arquivo_url = path;
      } else if (modo === "texto") {
        if (!texto.trim()) { setEnviando(false); return toast.error("Escreva o conteúdo"); }
        // #10: gera PDF automaticamente para petições/atos escritos
        const tituloPdf = isMandado ? `Mandado de ${MANDADO_SUBTIPOS.find((s) => s.v === mandadoSubtipo)?.l ?? mandadoSubtipo}` : (titulo || (TIPOS_DOC.find((t) => t.v === tipoDoc)?.l ?? "Documento"));
        const blob = gerarPdfAto({ orgao: proc.orgao_julgador, numero: proc.numero, titulo: tituloPdf, texto, autor: autorNome, cargo: autorCargo });
        const path = `${processoId}/peticoes/${Date.now()}_${tipoDoc}.pdf`;
        const { error: upErr } = await supabase.storage.from("processos-docs").upload(path, blob, { contentType: "application/pdf", upsert: true });
        if (!upErr) arquivo_url = path;
      }
      const metadata = isMandado
        ? {
            subtipo: mandadoSubtipo,
            destinatario_parte_id: destSel?.tipo === "parte" ? destSel.parteId : null,
            destinatario_tipo: destSel?.tipo ?? null,
            destinatario_nome: destSel?.nome ?? null,
          }
        : {};
      const tituloFinal = isMandado
        ? `Mandado de ${MANDADO_SUBTIPOS.find((s) => s.v === mandadoSubtipo)?.l ?? mandadoSubtipo}`
        : titulo;
      await supabase.from("documentos_processo").insert({
        processo_id: processoId, tipo: tipoDoc, titulo: tituloFinal,
        conteudo_html: modo === "texto" ? texto : null, arquivo_url,
        autor_id: userId, autor_nome: autorNome, autor_cargo: autorCargo,
        metadata,
      });
      // Só cria movimentação de "peticao" quando NÃO é mandado (mandado já gera movimentação via trigger).
      if (!isMandado) {
        await supabase.from("movimentacoes").insert({
          processo_id: processoId, tipo: "peticao",
          descricao: `Documento protocolado: ${tituloFinal} (${TIPOS_DOC.find((t) => t.v === tipoDoc)?.l ?? tipoDoc})`,
          autor_id: userId, autor_nome: autorNome, autor_cargo: autorCargo,
        });
      }
      // Intimação com prazo: encaminha automaticamente à aba "Prazos" do destinatário
      if (isMandado && destSel && Number(prazoDias) > 0) {
        const venc = new Date();
        venc.setDate(venc.getDate() + Number(prazoDias));
        venc.setHours(23, 59, 59, 0);
        await supabase.from("prazos").insert({
          processo_id: processoId,
          parte_nome: destSel.nome,
          parte_representada: destSel.parteRepresentada,
          ato_processual: tituloFinal,
          descricao: tituloFinal,
          destinatario_tipo: destSel.tipo,
          destinatario_user_id: destSel.userId,
          inicio_em: new Date().toISOString(),
          dias: Number(prazoDias),
          vence_em: venc.toISOString(),
          status: "pendente",
        });
      }
      toast.success(isMandado ? "Mandado expedido e publicado no DJE" : "Documento protocolado");
      setTexto(""); setPdf(null); setTipoDoc(""); setMandadoDestId(""); setPrazoDias("");
      onSaved();
    } catch (e) {
      toast.error("Falha ao protocolar", { description: (e as Error).message });
    } finally { setEnviando(false); }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><FileText className="size-4" /> Protocolar documento</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Tipo do documento *</Label>
          <Select value={tipoDoc} onValueChange={setTipoDoc}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {TIPOS_DOC.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!isMandado && (
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
        )}
      </div>
      {isMandado && (
        <div className="grid sm:grid-cols-2 gap-3 p-3 bg-warning/10 border border-warning/30 rounded">
          <div>
            <Label>Tipo de mandado *</Label>
            <Select value={mandadoSubtipo} onValueChange={setMandadoSubtipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MANDADO_SUBTIPOS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Destinatário *</Label>
            <Select value={mandadoDestId} onValueChange={setMandadoDestId}>
              <SelectTrigger><SelectValue placeholder="Parte, advogado, MP ou Defensoria" /></SelectTrigger>
              <SelectContent>
                {destsDisponiveis.map((d) => (
                  <SelectItem
                    key={d.key}
                    value={d.key}
                    disabled={d.tipo === "parte" && !!d.temAdvogado && (mandadoSubtipo === "intimacao" || mandadoSubtipo === "citacao")}
                  >
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {destSel?.tipo === "parte" && destSel.temAdvogado && (
              <p className="text-[11px] text-destructive mt-1">Parte com advogado habilitado — intime o patrono.</p>
            )}
          </div>
          {mandadoSubtipo !== "prisao" && (
            <div>
              <Label>Prazo gerado (dias)</Label>
              <Input type="number" min={0} value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)} placeholder="Ex.: 15 (opcional)" />
              <p className="text-[11px] text-muted-foreground mt-1">Se preenchido, o prazo vai para a aba "Prazos" do destinatário.</p>
            </div>
          )}
          {mandadoSubtipo === "prisao" && (
            <p className="sm:col-span-2 text-xs text-destructive">Mandado de prisão será registrado automaticamente no BNMP.</p>
          )}
        </div>
      )}
      <Tabs value={modo} onValueChange={(v) => setModo(v as never)}>
        <TabsList>
          <TabsTrigger value="texto">Escrever</TabsTrigger>
          <TabsTrigger value="pdf">Anexar PDF</TabsTrigger>
        </TabsList>
        <TabsContent value="texto" className="mt-3">
          <Textarea rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={isMandado ? "Conteúdo do mandado…" : "Conteúdo da petição…"} />
        </TabsContent>
        <TabsContent value="pdf" className="mt-3">
          <Input type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
          {pdf && <p className="text-xs text-muted-foreground mt-2">Arquivo: {pdf.name}</p>}
        </TabsContent>
      </Tabs>
      <Button onClick={enviar} disabled={enviando} className="gap-2">
        <Upload className="size-4" /> {enviando ? "Enviando…" : "Protocolar"}
      </Button>
    </div>
  );
}

function PrazosPanel({ processoId, partes, prazos, interno, onChange }:
  { processoId: string; partes: Parte[]; prazos: Prazo[]; interno: boolean; onChange: () => void }) {
  const dests = useMemo(() => buildDestinatarios(partes), [partes]);
  const [destKey, setDestKey] = useState("");
  const [ato, setAto] = useState("Intimação — cumprimento de determinação judicial");
  const [inicio, setInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [dias, setDias] = useState("15");

  const dest = dests.find((d) => d.key === destKey);
  const venceEm = useMemo(() => {
    const n = Number(dias);
    if (!inicio || !n) return null;
    const d = new Date(`${inicio}T23:59:59`);
    d.setDate(d.getDate() + n);
    return d;
  }, [inicio, dias]);

  const lancar = async () => {
    if (!dest) return toast.error("Selecione o destinatário do prazo");
    if (!venceEm) return toast.error("Informe a data de início e a quantidade de dias");
    if (dest.tipo === "parte" && dest.temAdvogado) {
      return toast.error("Parte representada por advogado", {
        description: "O prazo deve ser dirigido ao advogado constituído nos autos.",
      });
    }
    const { error } = await supabase.from("prazos").insert({
      processo_id: processoId,
      parte_nome: dest.nome,
      parte_representada: dest.parteRepresentada,
      ato_processual: ato,
      descricao: ato,
      destinatario_tipo: dest.tipo,
      destinatario_user_id: dest.userId,
      inicio_em: new Date(`${inicio}T00:00:00`).toISOString(),
      dias: Number(dias),
      vence_em: venceEm.toISOString(),
      status: "pendente",
    });
    if (error) return toast.error("Falha", { description: error.message });
    await supabase.from("movimentacoes").insert({
      processo_id: processoId, tipo: "intimacao",
      descricao: `Aberto prazo de ${dias} dia(s) para ${dest.nome}${dest.parteRepresentada && dest.tipo === "advogado" ? ` (patrono de ${dest.parteRepresentada})` : ""} — ${ato}. Termo final: ${formatDateTime(venceEm)}`,
      autor_nome: "SISTEMA", autor_cargo: "Automático",
    });
    toast.success("Prazo lançado e encaminhado ao destinatário");
    setDestKey("");
    onChange();
  };

  const encerrar = async (id: string) => {
    const { error } = await supabase.from("prazos").update({ status: "encerrado", cumprido: true, cumprido_em: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error("Falha", { description: error.message });
    toast.success("Prazo encerrado");
    onChange();
  };

  const situacao = (p: Prazo) => {
    if (p.cumprido || p.status === "cumprido") return "cumprido";
    if (p.status === "encerrado") return "encerrado";
    if (new Date(p.vence_em) < new Date()) return "vencido";
    return "pendente";
  };
  const TONE: Record<string, string> = {
    pendente: "bg-info/15 text-info", cumprido: "bg-success/15 text-success",
    vencido: "bg-destructive/15 text-destructive", encerrado: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      {interno && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Clock className="size-4" /> Lançar prazo</h3>
          <p className="text-xs text-muted-foreground">
            O prazo é encaminhado automaticamente à aba "Prazos" do destinatário (advogado, Ministério Público ou Defensoria Pública).
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Destinatário do prazo *</Label>
              <Select value={destKey} onValueChange={setDestKey}>
                <SelectTrigger><SelectValue placeholder="Selecione o destinatário" /></SelectTrigger>
                <SelectContent>
                  {dests.map((d) => (
                    <SelectItem key={d.key} value={d.key} disabled={d.tipo === "parte" && d.temAdvogado}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Ato processual que gerou o prazo</Label>
              <Input value={ato} onChange={(e) => setAto(e.target.value)} />
            </div>
            <div>
              <Label>Início do prazo</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <Label>Prazo (dias)</Label>
              <Input type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} />
            </div>
          </div>
          {venceEm && <p className="text-xs text-muted-foreground">Termo final: <strong>{formatDateTime(venceEm)}</strong></p>}
          <Button onClick={lancar}>Lançar prazo</Button>
        </div>
      )}
      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        {prazos.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum prazo registrado.</div>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Destinatário</th>
                <th className="text-left px-4 py-2">Parte representada</th>
                <th className="text-left px-4 py-2">Ato processual</th>
                <th className="text-left px-4 py-2">Início</th>
                <th className="text-left px-4 py-2">Prazo</th>
                <th className="text-left px-4 py-2">Termo final</th>
                <th className="text-left px-4 py-2">Situação</th>
                {interno && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {prazos.map((p) => {
                const st = situacao(p);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      {p.parte_nome}
                      <div className="text-[11px] text-muted-foreground">{DESTINATARIO_LABELS[p.destinatario_tipo ?? "parte"] ?? p.destinatario_tipo}</div>
                    </td>
                    <td className="px-4 py-3">{p.parte_representada ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.ato_processual ?? p.descricao ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{p.inicio_em ? formatDate(p.inicio_em) : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{p.dias ? `${p.dias} dia(s)` : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDateTime(p.vence_em)}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${TONE[st]}`}>{PRAZO_STATUS_LABELS[st]}</span></td>
                    {interno && (
                      <td className="px-4 py-3 text-right">
                        {st !== "encerrado" && st !== "cumprido" && (
                          <Button size="sm" variant="ghost" onClick={() => encerrar(p.id)}>Encerrar</Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface AudienciaRow { id: string; data_hora: string; modalidade: string; local: string | null; status: string; vara: string | null }

function AudienciasPanel({ processoId, magistradoNome, orgao }: { processoId: string; magistradoNome: string; orgao: string | null }) {
  const [rows, setRows] = useState<AudienciaRow[]>([]);
  const [data, setData] = useState("");
  const [modalidade, setModalidade] = useState<"presencial" | "virtual" | "hibrida">("presencial");
  const [local, setLocal] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("audiencias").select("id,data_hora,modalidade,local,status,vara").eq("processo_id", processoId).order("data_hora", { ascending: false });
    setRows((data ?? []) as AudienciaRow[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [processoId]);

  const marcar = async () => {
    if (!data) return toast.error("Informe a data e hora");
    setBusy(true);
    const { error } = await supabase.from("audiencias").insert({
      processo_id: processoId, data_hora: new Date(data).toISOString(), modalidade,
      local: local || null, vara: orgao, magistrado_nome: magistradoNome,
      status: "designada", observacoes: obs || null,
    });
    setBusy(false);
    if (error) return toast.error("Falha ao marcar audiência", { description: error.message });
    setData(""); setLocal(""); setObs("");
    toast.success("Audiência designada");
    load();
  };

  const cancelar = async (id: string) => {
    const { error } = await supabase.from("audiencias").update({ status: "cancelada" }).eq("id", id);
    if (error) return toast.error("Falha ao cancelar", { description: error.message });
    toast.success("Audiência cancelada");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><CalendarClock className="size-4" /> Marcar audiência</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Data e hora *</Label>
            <Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><Label>Modalidade</Label>
            <Select value={modalidade} onValueChange={(v) => setModalidade(v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="virtual">Virtual</SelectItem>
                <SelectItem value="hibrida">Híbrida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label>Local / sala</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Sala de Audiências 2 — Fórum de Teresópolis" /></div>
          <div className="sm:col-span-2"><Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <Button onClick={marcar} disabled={busy} className="gap-2"><CalendarClock className="size-4" /> {busy ? "Marcando…" : "Marcar audiência"}</Button>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <header className="px-5 py-3 border-b border-border font-semibold text-sm">Audiências deste processo</header>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma audiência marcada.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((a) => (
              <li key={a.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{formatDateTime(a.data_hora)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.modalidade}{a.local ? ` · ${a.local}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-semibold ${a.status === "cancelada" ? "bg-destructive/15 text-destructive" : a.status === "realizada" ? "bg-success/15 text-success" : "bg-info/15 text-info"}`}>{a.status}</span>
                  {a.status !== "cancelada" && a.status !== "realizada" && (
                    <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => cancelar(a.id)}>
                      <X className="size-3" /> Cancelar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
