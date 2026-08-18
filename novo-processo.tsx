import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ChevronLeft, Upload, FileText, Save, Send } from "lucide-react";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { TIPO_PARTE_LABELS, canCreateProcess, ROLE_LABELS, MATERIAS, INSTANCIAS, formatCNJ } from "@/lib/pje";
import { gerarComprovantePDF } from "@/lib/comprovante";

export const Route = createFileRoute("/_authenticated/novo-processo")({
  head: () => ({ meta: [{ title: "Novo processo — PJe" }] }),
  component: Novo,
  validateSearch: (s: Record<string, unknown>): { draft?: string } => (typeof s.draft === "string" && s.draft ? { draft: s.draft } : {}),
});

const schema = z.object({
  classe: z.string().min(2).max(120),
  assunto: z.string().min(2).max(200),
  estado_uf: z.string().length(2),
  comarca: z.string().optional(),
  materia: z.string().optional(),
  numero_origem: z.string().optional(),
  instancia: z.coerce.number().min(1).max(4).default(1),
  valor_causa: z.coerce.number().min(0).default(0),
  segredo_justica: z.boolean().default(false),
  prioridade: z.boolean().default(false),
  justica_gratuita: z.boolean().default(false),
}).refine(data => {
  // Se instância for 1, comarca é obrigatória. Nas outras (2, 3, 4) não pede.
  if (data.instancia === 1 && !data.comarca?.trim()) return false;
  return true;
}, {
  message: "Comarca é obrigatória para 1ª instância",
  path: ["comarca"]
}).refine(data => {
  // Se instância for 1 ou 2, matéria é obrigatória
  if (data.instancia <= 2 && !data.materia?.trim()) return false;
  return true;
}, {
  message: "Matéria é obrigatória para 1ª e 2ª instâncias",
  path: ["materia"]
}).refine(data => {
  // Recursos (2ª instância ou superior) exigem o número do processo de origem
  if (data.instancia >= 2 && (data.numero_origem ?? "").replace(/\D/g, "").length < 15) return false;
  return true;
}, {
  message: "Informe o número do processo de origem (recurso)",
  path: ["numero_origem"]
});


type Parte = { nome: string; documento: string; tipo: keyof typeof TIPO_PARTE_LABELS; advogado_nome?: string; advogado_oab?: string; advogado_cpf?: string; representa_idx?: number };
type Prova = { file: File; tipo: string };

const TIPOS_DOC_PROVA = [
  { v: "prova_documental", l: "Prova / Documento" },
  { v: "parecer", l: "Parecer" },
  { v: "laudo", l: "Laudo" },
  { v: "contrato", l: "Contrato" },
  { v: "certidao", l: "Certidão" },
  { v: "outros", l: "Outros" },
];

function Novo() {
  const { user, role, nome } = useAuth();
  const navigate = useNavigate();
  const { draft } = Route.useSearch();
  const [partes, setPartes] = useState<Parte[]>([
    { nome: "", documento: "", tipo: "autor" },
    { nome: "", documento: "", tipo: "reu" },
  ]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [comarcas, setComarcas] = useState<string[]>([]);
  const [peticaoModo, setPeticaoModo] = useState<"texto" | "pdf">("texto");
  const [peticaoTexto, setPeticaoTexto] = useState("");
  const [peticaoPdf, setPeticaoPdf] = useState<File | null>(null);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, getValues, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { valor_causa: 0, segredo_justica: false, prioridade: false, justica_gratuita: false, estado_uf: "SP", materia: "civel", instancia: 1 },
  });
  const uf = watch("estado_uf");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orgaos_julgadores").select("uf").eq("ativo", true);
      const arr = ((data ?? []) as { uf: string }[]).map((r) => r.uf);
      setUfs(Array.from(new Set(arr)).sort());
    })();
  }, []);
  useEffect(() => {
    if (!uf) return setComarcas([]);
    (async () => {
      if (uf === "RJ") {
        const { data } = await supabase.from("comarcas").select("nome").eq("uf", "RJ").order("nome");
        setComarcas(((data ?? []) as { nome: string }[]).map((r) => r.nome));
      } else {
        const { data } = await supabase.from("orgaos_julgadores").select("comarca").eq("uf", uf).eq("ativo", true);
        const arr = ((data ?? []) as { comarca: string }[]).map((r) => r.comarca);
        setComarcas(Array.from(new Set(arr)).sort());
      }
    })();
  }, [uf]);

  // Carrega rascunho existente
  useEffect(() => {
    if (!draft || !user) return;
    (async () => {
      const { data: proc } = await supabase.from("processos").select("*").eq("id", draft).eq("criado_por", user.id).eq("is_rascunho", true).maybeSingle();
      if (!proc) return;
      reset({
        classe: proc.classe ?? "", assunto: proc.assunto ?? "", estado_uf: proc.estado_uf ?? "SP",
        comarca: proc.comarca ?? "", materia: proc.materia ?? "civel", instancia: Number(proc.instancia ?? 1), valor_causa: Number(proc.valor_causa ?? 0),
        segredo_justica: !!proc.segredo_justica, prioridade: !!proc.prioridade, justica_gratuita: !!proc.justica_gratuita,
      });
      const { data: pts } = await supabase.from("partes").select("*").eq("processo_id", draft);
      if (pts && pts.length) setPartes(pts.map((p: Record<string, unknown>) => ({
        nome: (p.nome as string) ?? "", documento: (p.documento as string) ?? "", tipo: p.tipo as never,
        advogado_nome: (p.advogado_nome as string) ?? "", advogado_oab: (p.advogado_oab as string) ?? "",
      })));
    })();
  }, [draft, user, reset]);

  if (role && !canCreateProcess(role)) {
    return (
      <div className="flex min-h-screen flex-col"><SiteHeader />
        <main className="flex-1 bg-secondary"><div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <Link to="/painel" className="text-primary text-sm hover:underline mt-4 inline-block">Voltar ao painel</Link>
        </div></main>
        <SiteFooter />
      </div>
    );
  }

  const uploadPdf = async (file: File, processoId: string, sub: string) => {
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${processoId}/${sub}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from("processos-docs").upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  };

  const calcPercentual = (data: Partial<z.infer<typeof schema>>) => {
    let done = 0, total = 6;
    if (data.classe) done++;
    if (data.assunto) done++;
    if (data.comarca) done++;
    if (data.materia) done++;
    if (partes.some((p) => p.nome.trim())) done++;
    if (peticaoTexto.trim() || peticaoPdf) done++;
    return Math.round((done / total) * 100);
  };

  const salvarRascunho = async () => {
    if (!user) return;
    setSalvandoRascunho(true);
    try {
      const data = getValues();
      const payload = {
        classe: data.classe || "Rascunho", assunto: data.assunto || "—",
        valor_causa: data.valor_causa || 0, estado_uf: data.estado_uf || "SP",
        comarca: data.comarca || "—", materia: data.materia || "civel", instancia: data.instancia || 1,
        segredo_justica: !!data.segredo_justica, prioridade: !!data.prioridade,
        justica_gratuita: !!data.justica_gratuita,
        is_rascunho: true, criado_por: user.id,
        percentual_preenchimento: calcPercentual(data),
        status: "em_tramitacao",
      };
      let procId = draft;
      if (procId) {
        const { error } = await supabase.from("processos").update(payload).eq("id", procId);
        if (error) throw error;
        await supabase.from("partes").delete().eq("processo_id", procId);
      } else {
        const { data: novo, error } = await supabase.from("processos").insert(payload).select("id").maybeSingle();
        if (error || !novo) throw error;
        procId = novo.id;
      }
      const partesValidas = partes.filter((p) => p.nome.trim());
      if (partesValidas.length > 0) {
        await supabase.from("partes").insert(partesValidas.map((p, i) => ({
          processo_id: procId, nome: p.nome.trim(), documento: p.documento || null, tipo: p.tipo,
          advogado_nome: p.advogado_nome || null, advogado_oab: p.advogado_oab || null,
          user_id: i === 0 ? user.id : null,
        })));
      }
      toast.success("Rascunho salvo em 'Não Protocolados'");
      navigate({ to: "/nao-protocolados" });
    } catch (e) {
      toast.error("Erro ao salvar rascunho", { description: (e as Error).message });
    } finally {
      setSalvandoRascunho(false);
    }
  };

  const onSubmit = async (data: z.infer<typeof schema>) => {
    if (!user) return;
    const cargo = role ? ROLE_LABELS[role] : null;
    let procId = draft;
    const payload = {
      classe: data.classe, assunto: data.assunto, valor_causa: data.valor_causa,
      estado_uf: data.estado_uf, comarca: data.comarca, materia: data.materia, instancia: data.instancia || 1,
      segredo_justica: data.segredo_justica, prioridade: data.prioridade,
      justica_gratuita: data.justica_gratuita,
      is_rascunho: false, criado_por: user.id, percentual_preenchimento: 100,
    };
    let proc: { id: string; numero: string; orgao_julgador: string | null } | null = null;
    if (procId) {
      const { data: up, error } = await supabase.from("processos").update(payload).eq("id", procId).select("id,numero,orgao_julgador").maybeSingle();
      if (error || !up) return toast.error("Falha ao protocolar", { description: error?.message });
      proc = up;
      await supabase.from("partes").delete().eq("processo_id", procId);
    } else {
      const { data: novo, error } = await supabase.from("processos").insert(payload).select("id,numero,orgao_julgador").maybeSingle();
      if (error || !novo) return toast.error("Falha ao protocolar", { description: error?.message });
      proc = novo;
    }
    procId = proc!.id;

    const partesValidas = partes.filter((p) => p.nome.trim());
    let autorNome = nome ?? user.email;
    if (partesValidas.length > 0) {
      // 1º passo: partes não-advogado (para ter IDs); 2º passo: advogados com representa_parte_id
      const naoAdv = partesValidas.map((p, i) => ({ p, i })).filter(({ p }) => p.tipo !== "advogado");
      const adv    = partesValidas.map((p, i) => ({ p, i })).filter(({ p }) => p.tipo === "advogado");
      const idxToId: Record<number, string> = {};
      if (naoAdv.length > 0) {
        const { data: ins } = await supabase.from("partes").insert(naoAdv.map(({ p, i }) => ({
          processo_id: procId, nome: p.nome.trim(), documento: p.documento || null, tipo: p.tipo,
          user_id: i === 0 ? user.id : null,
        }))).select("id");
        (ins ?? []).forEach((row: { id: string }, k: number) => { idxToId[naoAdv[k].i] = row.id; });
      }
      if (adv.length > 0) {
        await supabase.from("partes").insert(adv.map(({ p }) => ({
          processo_id: procId, nome: p.nome.trim(), documento: p.documento || null, tipo: "advogado" as const,
          advogado_nome: p.nome.trim(), advogado_oab: p.advogado_oab || null, advogado_cpf: p.documento || null,
          representa_parte_id: p.representa_idx !== undefined ? (idxToId[p.representa_idx] ?? null) : null,
        })));
      }
      autorNome = partesValidas[0].nome;
    }

    const documentosSalvos: { nome: string }[] = [];
    try {
      if (peticaoModo === "texto" && peticaoTexto.trim()) {
        await supabase.from("documentos_processo").insert({
          processo_id: procId, tipo: "peticao_inicial", titulo: "Petição inicial",
          conteudo_html: peticaoTexto, autor_id: user.id, autor_nome: autorNome, autor_cargo: cargo,
        });
        documentosSalvos.push({ nome: "Petição inicial (texto)" });
      } else if (peticaoModo === "pdf" && peticaoPdf) {
        const path = await uploadPdf(peticaoPdf, procId, "peticao");
        await supabase.from("documentos_processo").insert({
          processo_id: procId, tipo: "peticao_inicial", titulo: peticaoPdf.name,
          arquivo_url: path, autor_id: user.id, autor_nome: autorNome, autor_cargo: cargo,
        });
        documentosSalvos.push({ nome: peticaoPdf.name });
      }
      for (const p of provas) {
        const path = await uploadPdf(p.file, procId, "provas");
        await supabase.from("documentos_processo").insert({
          processo_id: procId, tipo: p.tipo, titulo: p.file.name,
          arquivo_url: path, autor_id: user.id, autor_nome: autorNome, autor_cargo: cargo,
        });
        documentosSalvos.push({ nome: p.file.name });
      }
    } catch (e) {
      toast.error("Falha ao anexar documentos", { description: (e as Error).message });
    }

    // Comprovante PDF
    try {
      const blob = gerarComprovantePDF({
        numero: proc!.numero, classe: data.classe, assunto: data.assunto,
        materia: data.materia || "Todas", valor_causa: data.valor_causa,
        prioridade: data.prioridade, segredo_justica: data.segredo_justica,
        justica_gratuita: data.justica_gratuita, data_protocolo: new Date().toISOString(),
        partes: partesValidas.map((p) => ({ nome: p.nome, tipo: p.tipo, advogado_nome: p.advogado_nome, advogado_oab: p.advogado_oab })),
        documentos: documentosSalvos,
      });
      const path = `${procId}/comprovante/protocolo_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("processos-docs").upload(path, blob, { upsert: true, contentType: "application/pdf" });
      if (!upErr) {
        await supabase.from("processos").update({ comprovante_url: path }).eq("id", procId);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `comprovante_${proc!.numero}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("comprovante", e);
    }

    // Recurso: lança certidão automática nos autos de origem
    const digitos = (data.numero_origem ?? "").replace(/\D/g, "");
    if (data.instancia >= 2 && digitos.length >= 15) {
      try {
        const { data: cands } = await supabase.from("processos").select("id,numero").not("numero", "is", null).limit(2000);
        const origem = (cands ?? []).find((c: { numero: string }) => (c.numero ?? "").replace(/\D/g, "") === digitos);
        if (origem) {
          await supabase.from("movimentacoes").insert({
            processo_id: origem.id, tipo: "juntada",
            descricao: `Interposto recurso — ${data.classe} — autuado sob o nº ${proc!.numero} (${data.instancia}ª instância).`,
            autor_id: user.id, autor_nome: autorNome, autor_cargo: cargo,
          });
          await supabase.from("movimentacoes").insert({
            processo_id: procId, tipo: "juntada",
            descricao: `Recurso interposto nos autos de origem nº ${origem.numero}.`,
            autor_id: user.id, autor_nome: autorNome, autor_cargo: cargo,
          });
        } else {
          toast.warning("Processo de origem não localizado", { description: "O recurso foi protocolado, mas não foi possível lançar a certidão nos autos de origem." });
        }
      } catch (e) {
        console.warn("origem", e);
      }
    }

    toast.success(`Processo protocolado: ${proc!.numero}`, { description: "Distribuído automaticamente por sorteio." });
    navigate({ to: "/processos/$id", params: { id: procId! } });
  };

  const onInvalid = (errs: Record<string, { message?: string }>) => {
    const first = Object.values(errs)[0]?.message;
    toast.error("Verifique os campos obrigatórios", { description: first ?? "Há campos pendentes no formulário." });
  };


  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Link to="/painel" className="text-sm text-primary inline-flex items-center gap-1 hover:underline mb-3">
            <ChevronLeft className="size-4" /> Voltar
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{draft ? "Editar rascunho" : "Novo processo"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O número CNJ é gerado no protocolo e o processo é distribuído por sorteio a um magistrado da comarca/matéria.
          </p>

          <form onSubmit={handleSubmit(onSubmit, onInvalid as never)} className="mt-6 space-y-6">
            <section className="bg-card border border-border rounded-lg p-5">
              <h2 className="font-semibold mb-4">Dados do processo</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Classe *</Label>
                  <Input placeholder="Ex.: Procedimento Comum Cível" {...register("classe")} />
                  {errors.classe && <p className="text-xs text-destructive mt-1">{errors.classe.message}</p>}
                </div>
                <div>
                  <Label>Assunto *</Label>
                  <Input placeholder="Ex.: Indenização por Dano Moral" {...register("assunto")} />
                </div>
                {Number(watch("instancia") ?? 1) <= 2 && (
                  <div>
                    <Label>Matéria *</Label>
                    <Select value={watch("materia")} onValueChange={(v) => setValue("materia", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MATERIAS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.materia && <p className="text-xs text-destructive mt-1">{errors.materia.message}</p>}
                  </div>
                )}
                <div>
                  <Label>Instância de distribuição *</Label>
                  <Select value={String(watch("instancia") ?? 1)} onValueChange={(v) => setValue("instancia", Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INSTANCIAS.map((i) => <SelectItem key={i.v} value={String(i.v)}>{i.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado (UF) *</Label>
                  <Select value={uf} onValueChange={(v) => { setValue("estado_uf", v); setValue("comarca", ""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {ufs.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {Number(watch("instancia") ?? 1) === 1 && (
                  <div>
                    <Label>Comarca *</Label>
                    <Select value={watch("comarca")} onValueChange={(v) => setValue("comarca", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {comarcas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.comarca && <p className="text-xs text-destructive mt-1">{errors.comarca.message}</p>}
                  </div>
                )}
                {Number(watch("instancia") ?? 1) >= 2 && (
                  <div className="sm:col-span-2">
                    <Label>Número do processo de origem (recurso) *</Label>
                    <Input
                      placeholder="0000000-00.0000.0.00.0000"
                      value={watch("numero_origem") ?? ""}
                      onChange={(e) => setValue("numero_origem", formatCNJ(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ao protocolar, será lançada automaticamente uma certidão nos autos de origem informando a interposição do recurso e o número gerado.
                    </p>
                    {errors.numero_origem && <p className="text-xs text-destructive mt-1">{errors.numero_origem.message}</p>}
                  </div>
                )}

                <div>
                  <Label>Valor da causa (R$)</Label>
                  <Input type="number" step="0.01" {...register("valor_causa")} />
                </div>
                <div className="flex items-center justify-between border border-border rounded px-3 h-10">
                  <Label className="cursor-pointer">Segredo de justiça</Label>
                  <Switch checked={watch("segredo_justica")} onCheckedChange={(v) => setValue("segredo_justica", v)} />
                </div>
                <div className="flex items-center justify-between border border-border rounded px-3 h-10">
                  <Label className="cursor-pointer">Justiça Gratuita</Label>
                  <Switch checked={watch("justica_gratuita")} onCheckedChange={(v) => setValue("justica_gratuita", v)} />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between border border-border rounded px-3 h-10">
                  <Label className="cursor-pointer">Prioridade legal (vai direto à fila urgente)</Label>
                  <Switch checked={watch("prioridade")} onCheckedChange={(v) => setValue("prioridade", v)} />
                </div>
              </div>
            </section>

            <section className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold">Partes</h2>
                  <p className="text-xs text-muted-foreground">Adicione autor, réu e advogados (advogado indica a parte que representa).</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setPartes([...partes, { nome: "", documento: "", tipo: "autor" }])}>
                  <Plus className="size-4" /> Adicionar parte
                </Button>
              </div>
              <div className="space-y-4">
                {partes.map((p, i) => {
                  const isAdv = p.tipo === "advogado";
                  const opcoesRepresenta = partes.map((x, j) => ({ j, x })).filter(({ x, j }) => j !== i && (x.tipo === "autor" || x.tipo === "reu" || x.tipo === "terceiro") && x.nome.trim());
                  return (
                    <div key={i} className="border border-border rounded p-3 space-y-2 bg-secondary/40">
                      <div className="grid sm:grid-cols-[160px_1fr_180px_auto] gap-2 items-end">
                        <div><Label className="text-xs">Tipo</Label>
                          <Select value={p.tipo} onValueChange={(v) => setPartes(partes.map((x, j) => j === i ? { ...x, tipo: v as never } : x))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(TIPO_PARTE_LABELS) as Array<keyof typeof TIPO_PARTE_LABELS>).map((k) => <SelectItem key={k} value={k}>{TIPO_PARTE_LABELS[k]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">{isAdv ? "Nome do advogado" : "Nome"}</Label>
                          <Input value={p.nome} onChange={(e) => setPartes(partes.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></div>
                        <div><Label className="text-xs">CPF/CNPJ</Label>
                          <Input value={p.documento} onChange={(e) => setPartes(partes.map((x, j) => j === i ? { ...x, documento: e.target.value } : x))} /></div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setPartes(partes.filter((_, j) => j !== i))}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                      {isAdv && (
                        <div className="grid sm:grid-cols-2 gap-2">
                          <div><Label className="text-xs">OAB</Label>
                            <Input placeholder="Ex.: RJ123456" value={p.advogado_oab ?? ""} onChange={(e) => setPartes(partes.map((x, j) => j === i ? { ...x, advogado_oab: e.target.value } : x))} /></div>
                          <div><Label className="text-xs">Representa</Label>
                            <Select value={p.representa_idx?.toString() ?? ""} onValueChange={(v) => setPartes(partes.map((x, j) => j === i ? { ...x, representa_idx: Number(v) } : x))}>
                              <SelectTrigger><SelectValue placeholder="Selecione a parte representada" /></SelectTrigger>
                              <SelectContent>
                                {opcoesRepresenta.map(({ j, x }) => <SelectItem key={j} value={String(j)}>{x.nome || `Parte ${j + 1}`} ({TIPO_PARTE_LABELS[x.tipo]})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-card border border-border rounded-lg p-5">
              <h2 className="font-semibold mb-1 flex items-center gap-2"><FileText className="size-4" /> Petição inicial</h2>
              <p className="text-xs text-muted-foreground mb-3">Escreva diretamente no sistema ou anexe um PDF.</p>
              <Tabs value={peticaoModo} onValueChange={(v) => setPeticaoModo(v as never)}>
                <TabsList>
                  <TabsTrigger value="texto">Escrever no sistema</TabsTrigger>
                  <TabsTrigger value="pdf">Anexar PDF</TabsTrigger>
                </TabsList>
                <TabsContent value="texto" className="mt-3">
                  <Textarea rows={10} value={peticaoTexto} onChange={(e) => setPeticaoTexto(e.target.value)} placeholder="Excelentíssimo(a) Senhor(a) Doutor(a) Juiz(a)…" />
                </TabsContent>
                <TabsContent value="pdf" className="mt-3">
                  <Input type="file" accept="application/pdf" onChange={(e) => setPeticaoPdf(e.target.files?.[0] ?? null)} />
                  {peticaoPdf && <p className="text-xs text-muted-foreground mt-2">Arquivo: {peticaoPdf.name}</p>}
                </TabsContent>
              </Tabs>
            </section>

            <section className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold flex items-center gap-2"><Upload className="size-4" /> Provas / Documentos</h2>
                  <p className="text-xs text-muted-foreground">Anexe quantos PDFs forem necessários.</p>
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => setProvas([...provas, ...Array.from(e.target.files ?? []).map((f) => ({ file: f, tipo: "prova_documental" }))])} />
                  <span className="inline-flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded"><Plus className="size-4" /> Anexar</span>
                </label>
              </div>
              {provas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma prova anexada.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {provas.map((p, i) => (
                    <li key={i} className="grid grid-cols-[1fr_180px_auto] gap-2 items-center bg-muted/30 rounded px-2 py-1">
                      <span className="truncate">{p.file.name}</span>
                      <Select value={p.tipo} onValueChange={(v) => setProvas(provas.map((x, j) => j === i ? { ...x, tipo: v } : x))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPOS_DOC_PROVA.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setProvas(provas.filter((_, j) => j !== i))}>
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <Link to="/painel"><Button type="button" variant="outline">Cancelar</Button></Link>
              <Button type="button" variant="secondary" className="gap-2" disabled={salvandoRascunho} onClick={salvarRascunho}>
                <Save className="size-4" /> {salvandoRascunho ? "Salvando…" : "Salvar rascunho"}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                <Send className="size-4" /> {isSubmitting ? "Protocolando…" : "Protocolar"}
              </Button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
