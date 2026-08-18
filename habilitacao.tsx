import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ChevronLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, formatCNJ } from "@/lib/pje";

export const Route = createFileRoute("/_authenticated/habilitacao")({
  head: () => ({ meta: [{ title: "Habilitação — PJe" }] }),
  component: Habilitacao,
});

const TIPOS = [
  { v: "advogado", l: "Advogado" },
  { v: "substabelecimento", l: "Substabelecimento" },
  { v: "representante", l: "Representante legal" },
  { v: "sucessao", l: "Sucessão processual" },
  { v: "outro", l: "Outro" },
];

const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-warning/20 text-warning-foreground",
  deferida: "bg-success/15 text-success",
  indeferida: "bg-destructive/15 text-destructive",
  cancelada: "bg-muted text-muted-foreground",
};

interface Hab {
  id: string; numero_processo: string; cpf_cnpj: string; tipo: string;
  justificativa: string; status: string; created_at: string; historico: unknown[];
}

function Habilitacao() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Hab[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ numero: "", cpf_cnpj: "", tipo: "advogado", justificativa: "" });
  const [procuracao, setProcuracao] = useState<File | null>(null);
  const [substab, setSubstab] = useState<File | null>(null);
  const [outros, setOutros] = useState<File[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("habilitacoes")
      .select("id,numero_processo,cpf_cnpj,tipo,justificativa,status,created_at,historico")
      .eq("solicitante_id", user.id).order("created_at", { ascending: false });
    setLista((data ?? []) as Hab[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const upload = async (file: File, id: string, sub: string) => {
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `habilitacoes/${id}/${sub}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from("processos-docs").upload(path, file);
    if (error) throw error;
    return { path, nome: file.name, tipo: sub };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      // tenta associar processo pelo número
      let processo_id: string | null = null;
      if (form.numero.trim()) {
        const soDigitos = form.numero.replace(/\D/g, "");
        const { data: procs } = await supabase.from("processos").select("id,numero");
        const match = (procs ?? []).find((p: { numero: string }) => p.numero.replace(/\D/g, "") === soDigitos);
        processo_id = match?.id ?? null;
      }
      const { data: h, error } = await supabase.from("habilitacoes").insert({
        processo_id, numero_processo: form.numero.trim() || null,
        solicitante_id: user.id, cpf_cnpj: form.cpf_cnpj || null,
        tipo: form.tipo, justificativa: form.justificativa || null,
        historico: [{ ts: new Date().toISOString(), evento: "Solicitação criada" }],
      }).select("id").maybeSingle();
      if (error || !h) throw error;

      const docs: unknown[] = [];
      if (procuracao) docs.push(await upload(procuracao, h.id, "procuracao"));
      if (substab) docs.push(await upload(substab, h.id, "substabelecimento"));
      for (const f of outros) docs.push(await upload(f, h.id, "outros"));
      if (docs.length) await supabase.from("habilitacoes").update({ documentos: docs }).eq("id", h.id);

      toast.success("Solicitação de habilitação enviada");
      setForm({ numero: "", cpf_cnpj: "", tipo: "advogado", justificativa: "" });
      setProcuracao(null); setSubstab(null); setOutros([]);
      load();
    } catch (e) {
      toast.error("Erro ao enviar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const cancelar = async (id: string) => {
    await supabase.from("habilitacoes").update({ status: "cancelada" }).eq("id", id);
    toast.success("Solicitação cancelada");
    load();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Link to="/painel" className="text-sm text-primary inline-flex items-center gap-1 hover:underline mb-3">
            <ChevronLeft className="size-4" /> Voltar
          </Link>
          <div className="flex items-center gap-2"><UserPlus className="size-6 text-primary" /><h1 className="text-2xl md:text-3xl font-bold">Habilitação em processo</h1></div>
          <p className="text-sm text-muted-foreground">Solicite habilitação em processos já existentes.</p>

          <form onSubmit={submit} className="mt-6 bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Número do processo *</Label>
                <Input required placeholder="0000000-00.0000.0.00.0000" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
              <div><Label>CPF/CNPJ da parte</Label>
                <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
              <div><Label>Tipo de habilitação *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Justificativa</Label>
              <Textarea rows={4} value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} /></div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div><Label className="flex items-center gap-1"><Upload className="size-3" /> Procuração (PDF)</Label>
                <Input type="file" accept="application/pdf" onChange={(e) => setProcuracao(e.target.files?.[0] ?? null)} />
                {procuracao && <p className="text-xs mt-1 text-muted-foreground">{procuracao.name}</p>}</div>
              <div><Label className="flex items-center gap-1"><Upload className="size-3" /> Substabelecimento (PDF)</Label>
                <Input type="file" accept="application/pdf" onChange={(e) => setSubstab(e.target.files?.[0] ?? null)} />
                {substab && <p className="text-xs mt-1 text-muted-foreground">{substab.name}</p>}</div>
              <div><Label className="flex items-center gap-1"><Upload className="size-3" /> Demais documentos</Label>
                <Input type="file" accept="application/pdf" multiple onChange={(e) => setOutros(Array.from(e.target.files ?? []))} />
                {outros.length > 0 && <p className="text-xs mt-1 text-muted-foreground">{outros.length} arquivo(s)</p>}</div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>{busy ? "Enviando…" : "Solicitar habilitação"}</Button>
            </div>
          </form>

          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-3">Minhas solicitações</h2>
            <div className="bg-card border border-border rounded-lg">
              {lista.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma solicitação enviada.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {lista.map((h) => (
                    <li key={h.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-sm font-semibold text-primary">{h.numero_processo ? formatCNJ(h.numero_processo) : "—"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Tipo: {TIPOS.find((t) => t.v === h.tipo)?.l ?? h.tipo} · Solicitada em {formatDateTime(h.created_at)}</div>
                          {h.justificativa && <div className="text-sm mt-2 text-foreground/80">{h.justificativa}</div>}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${STATUS_COLOR[h.status] ?? ""}`}>{h.status}</span>
                          {h.status === "pendente" && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelar(h.id)}>Cancelar</Button>
                          )}
                        </div>
                      </div>
                      {Array.isArray(h.historico) && h.historico.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:underline">Histórico ({h.historico.length})</summary>
                          <ul className="mt-2 space-y-1 text-xs text-muted-foreground pl-4">
                            {(h.historico as { ts: string; evento: string }[]).map((ev, i) => (
                              <li key={i}>• {formatDateTime(ev.ts)} — {ev.evento}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
