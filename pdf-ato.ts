import { jsPDF } from "jspdf";
import { formatCNJ, formatDateTime } from "@/lib/pje";

export interface AtoContext {
  orgao: string | null;
  numero: string;
  titulo: string;
  texto: string;
  autor: string;
  cargo: string | null;
}

/** Gera um PDF padrão (cabeçalho + conteúdo + rodapé de assinatura) e devolve Blob. */
export function gerarPdfAto(ctx: AtoContext): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("PODER JUDICIÁRIO", 105, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(ctx.orgao ?? "—", 105, 21, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`Autos nº ${formatCNJ(ctx.numero)}`, 105, 27, { align: "center" });
  doc.line(15, 31, 195, 31);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(ctx.titulo.toUpperCase(), 105, 38, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const lines = doc.splitTextToSize(ctx.texto, 180);
  let y = 46;
  lines.forEach((l: string) => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(l, 15, y); y += 5;
  });
  y = Math.min(y + 10, 275);
  doc.setFontSize(9); doc.setTextColor(120);
  doc.text(`Assinado eletronicamente por ${ctx.autor}${ctx.cargo ? " — " + ctx.cargo : ""}`, 15, y);
  doc.text(`Emitido em ${formatDateTime(new Date().toISOString())}`, 15, y + 5);
  return doc.output("blob");
}

/** Gera capa + índice + conteúdo de todos os documentos textuais dos autos em um único PDF. */
export function gerarAutosCompletos(params: {
  numero: string; orgao: string | null; classe: string; assunto: string;
  partes: { nome: string; tipo: string; documento?: string | null }[];
  docs: { titulo: string; tipo: string; conteudo_html?: string | null; autor_nome?: string | null; created_at: string; arquivo_url?: string | null }[];
}): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  // Capa
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("PODER JUDICIÁRIO", 105, 25, { align: "center" });
  doc.setFontSize(11); doc.text(params.orgao ?? "—", 105, 32, { align: "center" });
  doc.setFontSize(16); doc.text("AUTOS DIGITAIS", 105, 55, { align: "center" });
  doc.setFontSize(12); doc.text(formatCNJ(params.numero), 105, 63, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Classe: ${params.classe}`, 15, 80);
  doc.text(`Assunto: ${params.assunto}`, 15, 87);
  doc.setFont("helvetica", "bold"); doc.text("Partes", 15, 100);
  doc.setFont("helvetica", "normal");
  let y = 107;
  params.partes.forEach((p) => {
    const line = `• ${p.nome} (${p.tipo})${p.documento ? " — " + p.documento : ""}`;
    doc.text(doc.splitTextToSize(line, 180) as string[], 15, y); y += 6;
    if (y > 275) { doc.addPage(); y = 20; }
  });

  // Documentos
  params.docs.forEach((d, i) => {
    doc.addPage();
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(`Documento ${i + 1} — ${d.titulo}`, 15, 20);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`${d.tipo} · ${d.autor_nome ?? "—"} · ${formatDateTime(d.created_at)}`, 15, 26);
    doc.setTextColor(0); doc.setFontSize(10);
    const conteudo = d.conteudo_html?.trim() || (d.arquivo_url ? "[Arquivo PDF anexo neste documento — baixe individualmente para visualizar.]" : "[Sem conteúdo textual.]");
    const lines = doc.splitTextToSize(conteudo, 180);
    let yy = 34;
    (lines as string[]).forEach((l) => {
      if (yy > 275) { doc.addPage(); yy = 20; }
      doc.text(l, 15, yy); yy += 5;
    });
  });
  return doc.output("blob");
}
