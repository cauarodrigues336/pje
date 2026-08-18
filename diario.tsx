import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Newspaper, Calendar, Download, Search, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase as _sb } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _sb;
import { formatCNJ, formatDate, formatDateTime } from "@/lib/pje";
import { jsPDF } from "jspdf";

export const Route = createFileRoute("/_authenticated/diario")({
  head: () => ({ meta: [{ title: "Diário Judicial Eletrônico — PJe" }] }),
  component: Diario,
});

const TIPO_LABEL: Record<string, string> = {
  decisao: "Decisão", despacho: "Despacho", sentenca: "Sentença", mandado: "Mandado",
};
const TIPOS_DJE = ["decisao", "despacho", "sentenca", "mandado"];

interface Row {
  id: string;
  tipo: string;
  titulo: string;
  conteudo_html: string | null;
  arquivo_url: string | null;
  autor_nome: string | null;
  autor_cargo: string | null;
  created_at: string;
  processo_id: string;
  processos: { numero: string; orgao_julgador: string } | null;
}

function Diario() {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [fNome, setFNome] = useState("");
  const [fCpf, setFCpf] = useState("");
  const [fOab, setFOab] = useState("");
  const [fNumero, setFNumero] = useState("");
  const [partesMap, setPartesMap] = useState<Record<string, { nome: string; documento: string | null; advogado_oab: string | null }[]>>({});

  useEffect(() => {
    (async () => {
      const start = new Date(data + "T00:00:00").toISOString();
      const end = new Date(data + "T23:59:59").toISOString();
      // #4: só decisões, despachos, sentenças e mandados
      const { data: res } = await supabase
        .from("documentos_processo")
        .select("id,tipo,titulo,conteudo_html,arquivo_url,autor_nome,autor_cargo,created_at,processo_id,processos(numero,orgao_julgador)")
        .in("tipo", TIPOS_DJE)
        .eq("publicado_dje", true)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (res ?? []) as Row[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.processo_id)));
      if (ids.length) {
        const { data: pts } = await supabase.from("partes").select("processo_id,nome,documento,advogado_oab").in("processo_id", ids);
        const map: Record<string, { nome: string; documento: string | null; advogado_oab: string | null }[]> = {};
        (pts ?? []).forEach((p: { processo_id: string; nome: string; documento: string | null; advogado_oab: string | null }) => {
          (map[p.processo_id] ||= []).push({ nome: p.nome, documento: p.documento, advogado_oab: p.advogado_oab });
        });
        setPartesMap(map);
      } else setPartesMap({});
    })();
  }, [data]);

  const filtered = useMemo(() => {
    const nomeQ = fNome.trim().toLowerCase();
    const cpfQ = fCpf.replace(/\D/g, "");
    const oabQ = fOab.trim().toLowerCase();
    const numQ = fNumero.replace(/\D/g, "");
    if (!nomeQ && !cpfQ && !oabQ && !numQ) return rows;
    return rows.filter((r) => {
      const pts = partesMap[r.processo_id] ?? [];
      if (nomeQ && !pts.some((p) => p.nome.toLowerCase().includes(nomeQ))) return false;
      if (cpfQ && !pts.some((p) => (p.documento ?? "").replace(/\D/g, "").includes(cpfQ))) return false;
      if (oabQ && !pts.some((p) => (p.advogado_oab ?? "").toLowerCase().includes(oabQ))) return false;
      if (numQ && !(r.processos?.numero ?? "").replace(/\D/g, "").includes(numQ)) return false;
      return true;
    });
  }, [rows, partesMap, fNome, fCpf, fOab, fNumero]);

  const clearFilters = () => { setFNome(""); setFCpf(""); setFOab(""); setFNumero(""); };
  const temFiltro = !!(fNome || fCpf || fOab || fNumero);

  // #5: baixar PDF individual do documento publicado
  const baixarDoc = async (r: Row) => {
    if (r.arquivo_url) {
      const { data: sig, error } = await supabase.storage.from("processos-docs").createSignedUrl(r.arquivo_url, 60);
      if (error || !sig) return toast.error("Não foi possível gerar o link", { description: error?.message });
      window.open(sig.signedUrl, "_blank");
      return;
    }
    // gera PDF a partir do texto
    if (!r.conteudo_html) return toast.error("Este documento não tem arquivo.");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("PODER JUDICIÁRIO", 105, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(r.processos?.orgao_julgador ?? "—", 105, 21, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`Autos nº ${formatCNJ(r.processos?.numero ?? "")}`, 105, 27, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(`${TIPO_LABEL[r.tipo] ?? r.tipo}: ${r.titulo}`, 15, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const lines = doc.splitTextToSize(r.conteudo_html, 180);
    doc.text(lines, 15, 48);
    const yFim = Math.min(48 + lines.length * 5, 275);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Assinado eletronicamente por ${r.autor_nome ?? "—"}${r.autor_cargo ? ` — ${r.autor_cargo}` : ""}`, 15, yFim + 8);
    doc.text(`Publicado no DJE em ${formatDateTime(r.created_at)}`, 15, yFim + 13);
    doc.save(`${r.tipo}_${(r.processos?.numero ?? "documento").replace(/\D/g, "")}.pdf`);
  };

  // #8: baixar edição do dia em PDF
  const baixarEdicao = () => {
    if (filtered.length === 0) return toast.error("Nenhuma publicação para baixar.");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("DIÁRIO JUDICIAL ELETRÔNICO", 105, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Edição de ${formatDate(data)} — ${filtered.length} publicação(ões)`, 105, 22, { align: "center" });
    doc.setDrawColor(0); doc.line(15, 26, 195, 26);
    let y = 32;
    filtered.forEach((r, i) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(`${i + 1}. ${TIPO_LABEL[r.tipo] ?? r.tipo} — ${formatCNJ(r.processos?.numero ?? "")}`, 15, y); y += 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(`${r.processos?.orgao_julgador ?? "—"} · ${formatDateTime(r.created_at)}`, 15, y); y += 5;
      doc.setTextColor(0);
      doc.text(doc.splitTextToSize(r.titulo, 180), 15, y); y += 5;
      if (r.conteudo_html) {
        const lines = doc.splitTextToSize(r.conteudo_html.slice(0, 800), 180);
        const shown = lines.slice(0, 8);
        doc.text(shown, 15, y); y += shown.length * 4;
        if (lines.length > 8) { doc.setTextColor(120); doc.text("[…] conteúdo integral disponível nos autos", 15, y); doc.setTextColor(0); y += 5; }
      }
      doc.setDrawColor(200); doc.line(15, y, 195, y); y += 6;
    });
    doc.save(`dje_${data}.pdf`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-secondary">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded bg-primary text-primary-foreground flex items-center justify-center">
              <Newspaper className="size-6" />
            </div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-primary font-semibold">CNJ</div>
              <h1 className="text-2xl md:text-3xl font-bold">Diário Judicial Eletrônico</h1>
              <p className="text-sm text-muted-foreground">
                Publicações oficiais dos atos processuais — Lei nº 11.419/2006.
              </p>
            </div>
          </div>

          <div className="mt-6 bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label htmlFor="data" className="text-xs">Edição</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-44" />
                </div>
              </div>
              <Button variant="outline" className="gap-2 ml-auto" onClick={baixarEdicao}>
                <Download className="size-4" /> Baixar edição (PDF)
              </Button>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase text-muted-foreground">
                <Search className="size-3" /> Filtrar publicações
              </div>
              <div className="grid sm:grid-cols-4 gap-2">
                <div><Label className="text-xs">Nome</Label><Input value={fNome} onChange={(e) => setFNome(e.target.value)} placeholder="Parte, advogado…" /></div>
                <div><Label className="text-xs">CPF / CNPJ</Label><Input value={fCpf} onChange={(e) => setFCpf(e.target.value)} placeholder="Somente números" /></div>
                <div><Label className="text-xs">OAB</Label><Input value={fOab} onChange={(e) => setFOab(e.target.value)} placeholder="Ex.: RJ123456" /></div>
                <div><Label className="text-xs">Número do processo</Label><Input value={fNumero} onChange={(e) => setFNumero(e.target.value)} placeholder="Somente números" /></div>
              </div>
              {temFiltro && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2 gap-1"><X className="size-3" /> Limpar filtros</Button>
              )}
            </div>
          </div>

          <div className="mt-4 bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <div className="font-semibold">Edição de {formatDate(data)}</div>
              <div className="text-xs text-muted-foreground">{filtered.length} publicação(ões){temFiltro && ` (filtrado de ${rows.length})`}</div>
            </div>
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhuma publicação encontrada.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="font-semibold uppercase text-primary">{TIPO_LABEL[r.tipo] ?? r.tipo}</span>
                          {r.processos && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              {/* #6: clique no número vai direto aos autos */}
                              <Link to="/processos/$id" params={{ id: r.processo_id }} className="font-mono text-primary hover:underline">
                                {formatCNJ(r.processos.numero)}
                              </Link>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground">{r.processos.orgao_julgador}</span>
                            </>
                          )}
                        </div>
                        <div className="text-sm font-medium mt-1">{r.titulo}</div>
                        {r.conteudo_html && <div className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{r.conteudo_html}</div>}
                        <div className="text-[11px] text-muted-foreground mt-1">{formatDateTime(r.created_at)}{r.autor_nome && <> · {r.autor_nome}</>}</div>
                      </div>
                      {/* #5: baixar PDF do documento */}
                      <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => baixarDoc(r)}>
                        <FileText className="size-3" /> PDF
                      </Button>
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
