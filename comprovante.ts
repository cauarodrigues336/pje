import { jsPDF } from "jspdf";
import { formatCNJ, formatBRL, formatDateTime, MATERIA_LABELS } from "@/lib/pje";

export interface ComprovanteData {
  numero: string;
  classe: string;
  assunto: string;
  materia: string;
  valor_causa: number;
  prioridade: boolean;
  segredo_justica: boolean;
  justica_gratuita: boolean;
  data_protocolo: string;
  partes: { nome: string; tipo: string; advogado_nome?: string | null; advogado_oab?: string | null }[];
  documentos: { nome: string; paginas?: number }[];
}

export function gerarComprovantePDF(d: ComprovanteData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  let y = 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PODER JUDICIÁRIO", W / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(11);
  doc.text("COMPROVANTE DE PROTOCOLO ELETRÔNICO", W / 2, y, { align: "center" });
  y += 4;
  doc.setDrawColor(0);
  doc.line(15, y, W - 15, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const row = (k: string, v: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, 15, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v || "—", 130);
    doc.text(lines, 65, y);
    y += 5 * lines.length + 1;
  };

  row("Número do processo:", formatCNJ(d.numero));
  row("Data/Hora do protocolo:", formatDateTime(d.data_protocolo));
  row("Classe processual:", d.classe);
  row("Assunto:", d.assunto);
  row("Matéria:", MATERIA_LABELS[d.materia] ?? d.materia);
  row("Valor da causa:", formatBRL(d.valor_causa || 0));
  row("Prioridade:", d.prioridade ? "Sim" : "Não");
  row("Segredo de justiça:", d.segredo_justica ? "Sim" : "Não");
  row("Justiça Gratuita:", d.justica_gratuita ? "Sim" : "Não");

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.text("Partes", 15, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  d.partes.forEach((p) => {
    const patrono = p.advogado_nome ? ` — Adv.: ${p.advogado_nome}${p.advogado_oab ? ` (OAB ${p.advogado_oab})` : ""}` : "";
    const l = doc.splitTextToSize(`• ${p.tipo.toUpperCase()}: ${p.nome}${patrono}`, W - 30);
    doc.text(l, 18, y);
    y += 5 * l.length;
  });

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.text("Documentos protocolados", 15, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  if (d.documentos.length === 0) {
    doc.text("• Nenhum documento anexado", 18, y);
    y += 5;
  } else {
    d.documentos.forEach((doc2) => {
      doc.text(`• ${doc2.nome}${doc2.paginas ? ` — ${doc2.paginas} página(s)` : ""}`, 18, y);
      y += 5;
    });
  }

  y += 6;
  doc.setDrawColor(180);
  doc.line(15, y, W - 15, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Este comprovante é gerado automaticamente pelo sistema PJe no ato do protocolo eletrônico, nos termos da Lei nº 11.419/2006.",
    15,
    y,
    { maxWidth: W - 30 },
  );

  return doc.output("blob");
}
